import { corsHeaders } from "./trend-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function apiError(request, env, status, code, message, details) {
  return json({ success: false, error: { code, message, details } }, env, request, status);
}

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function getAuthUserId(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(normalized)).sub || null;
  } catch {
    return null;
  }
}

async function supabaseRequest(env, path, init = {}) {
  if (!hasSupabase(env)) throw new Error("Supabase service environment variables are not configured.");
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    }
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

function clampRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 10000) / 10000;
}

function clampCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function detailFromDraft(row) {
  return row?.score_detail || {};
}

function extractPattern(draft, rates) {
  const detail = detailFromDraft(draft);
  return {
    hook: detail.hook || draft?.text?.split("\n")[0] || "",
    trigger: detail.emotionalTrigger || draft?.hook_type || "empathy",
    category: detail.trendCategory || draft?.category || "threads",
    persona: detail.persona || draft?.persona || "Viral OS",
    commentBait: detail.bestCommentBait || detail.commentHook || "",
    totalScore: detail.totalScore || draft?.score_total || 0,
    engagementRate: rates.engagementRate,
    commentRate: rates.commentRate,
    saveRate: rates.saveRate,
    recordedAt: new Date().toISOString()
  };
}

function mergePatterns(existing, next, max = 12) {
  const list = Array.isArray(existing) ? existing : [];
  const deduped = [next, ...list].filter((item, index, all) => {
    const key = `${item.hook || ""}|${item.trigger || ""}|${item.category || ""}`;
    return all.findIndex((candidate) => `${candidate.hook || ""}|${candidate.trigger || ""}|${candidate.category || ""}` === key) === index;
  });
  return deduped.slice(0, max);
}

function calculateRates(metrics) {
  const impressions = Math.max(0, metrics.impressions);
  const denominator = impressions || 1;
  const commentRate = impressions ? metrics.comments / denominator : 0;
  const saveRate = impressions ? metrics.saves / denominator : 0;
  const shareRate = impressions ? metrics.shares / denominator : 0;
  const engagementRate = impressions ? (metrics.likes + metrics.comments + metrics.shares + metrics.saves) / denominator : 0;
  return {
    commentRate: clampRate(commentRate),
    saveRate: clampRate(saveRate),
    shareRate: clampRate(shareRate),
    engagementRate: clampRate(engagementRate)
  };
}

function clientMemory(row) {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    topicCategory: row.topic_category,
    persona: row.persona,
    avgEngagement: Number(row.avg_engagement || 0),
    avgSaveRate: Number(row.avg_save_rate || 0),
    avgCommentRate: Number(row.avg_comment_rate || 0),
    winningPatterns: row.winning_patterns || [],
    losingPatterns: row.losing_patterns || [],
    updatedAt: row.updated_at
  };
}

function summarizeLearning(memories) {
  const rows = (memories || []).map(clientMemory);
  const topByEngagement = [...rows].sort((a, b) => b.avgEngagement - a.avgEngagement)[0] || null;
  const topCategory = [...rows].sort((a, b) => b.avgCommentRate + b.avgSaveRate - (a.avgCommentRate + a.avgSaveRate))[0] || topByEngagement;
  const averageEngagement = rows.length ? rows.reduce((sum, row) => sum + row.avgEngagement, 0) / rows.length : 0;
  const winningPatterns = rows.flatMap((row) => row.winningPatterns || []);
  const winningHooks = winningPatterns.map((pattern) => pattern.hook).filter(Boolean).slice(0, 10);
  const winningEmotionalTriggers = [...new Set(rows.map((row) => row.triggerType).filter(Boolean))].slice(0, 10);
  const winningPersonas = [...new Set(rows.map((row) => row.persona).filter(Boolean))].slice(0, 10);
  return {
    topPerformingTrigger: topByEngagement?.triggerType || "not enough data",
    topPerformingCategory: topCategory?.topicCategory || "not enough data",
    averageEngagement: Math.round(averageEngagement * 10000) / 100,
    winningHooks,
    winningEmotionalTriggers,
    winningPersonas
  };
}

async function upsertLearningMemory(env, draft, rates) {
  const detail = detailFromDraft(draft);
  const triggerType = detail.emotionalTrigger || draft.hook_type || "empathy";
  const topicCategory = detail.trendCategory || draft.category || "threads";
  const persona = detail.persona || draft.persona || "Viral OS";
  const encoded = `trigger_type=eq.${encodeURIComponent(triggerType)}&topic_category=eq.${encodeURIComponent(topicCategory)}&persona=eq.${encodeURIComponent(persona)}`;
  const existingRows = await supabaseRequest(env, `learning_memory?${encoded}&select=*`, { method: "GET" });
  const existing = existingRows?.[0];
  const pattern = extractPattern(draft, rates);
  const strongPerformance = rates.engagementRate >= 0.05 || rates.commentRate >= 0.01 || rates.saveRate >= 0.01;
  const payload = {
    trigger_type: triggerType,
    topic_category: topicCategory,
    persona,
    avg_engagement: existing ? clampRate((Number(existing.avg_engagement || 0) + rates.engagementRate) / 2) : rates.engagementRate,
    avg_save_rate: existing ? clampRate((Number(existing.avg_save_rate || 0) + rates.saveRate) / 2) : rates.saveRate,
    avg_comment_rate: existing ? clampRate((Number(existing.avg_comment_rate || 0) + rates.commentRate) / 2) : rates.commentRate,
    winning_patterns: strongPerformance ? mergePatterns(existing?.winning_patterns, pattern) : existing?.winning_patterns || [],
    losing_patterns: strongPerformance ? existing?.losing_patterns || [] : mergePatterns(existing?.losing_patterns, pattern)
  };
  const rows = await supabaseRequest(env, "learning_memory?on_conflict=trigger_type,topic_category,persona", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([payload])
  });
  return rows?.[0] || payload;
}

export async function loadLearningRows(env, limit = 20) {
  if (!hasSupabase(env)) return [];
  try {
    return await supabaseRequest(env, `learning_memory?select=*&order=avg_engagement.desc&limit=${limit}`, { method: "GET" });
  } catch (error) {
    console.error("load learning rows failed", error);
    return [];
  }
}

export async function loadLearningContext(env) {
  const rows = await loadLearningRows(env, 20);
  const memories = rows.map(clientMemory);
  return {
    memories,
    summary: summarizeLearning(rows),
    preferredTriggers: memories.filter((row) => row.avgEngagement > 0).map((row) => row.triggerType),
    preferredCategories: memories.filter((row) => row.avgEngagement > 0).map((row) => row.topicCategory),
    winningPatterns: memories.flatMap((row) => row.winningPatterns || []),
    losingPatterns: memories.flatMap((row) => row.losingPatterns || [])
  };
}

export async function handlePostPerformance(request, env) {
  if (!hasSupabase(env)) return apiError(request, env, 503, "supabase_not_configured", "Supabase is not configured.");
  const userId = getAuthUserId(request);
  if (!userId) return apiError(request, env, 401, "unauthorized", "A Supabase session is required.");

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = body.draftId || body.draft_id;
    if (!isUuid(draftId)) return apiError(request, env, 400, "invalid_draft_id", "draftId must be a valid draft id.");

    const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" });
    const draft = rows?.[0];
    if (!draft) return apiError(request, env, 404, "draft_not_found", "Draft was not found for this operator.");

    const metrics = {
      impressions: clampCount(body.impressions),
      likes: clampCount(body.likes),
      comments: clampCount(body.comments),
      shares: clampCount(body.shares),
      saves: clampCount(body.saves)
    };
    const rates = calculateRates(metrics);
    const platform = String(body.platform || "threads").toLowerCase() === "threads" ? "threads" : "threads";
    const performanceRows = await supabaseRequest(env, "post_performance", {
      method: "POST",
      body: JSON.stringify([{
        draft_id: draftId,
        platform,
        ...metrics,
        engagement_rate: rates.engagementRate,
        posted_at: body.postedAt || body.posted_at || new Date().toISOString()
      }])
    });
    const memory = await upsertLearningMemory(env, draft, rates);
    return json({
      success: true,
      performance: performanceRows?.[0] || null,
      rates,
      learning: clientMemory(memory)
    }, env, request);
  } catch (error) {
    console.error("post performance failed", error);
    return apiError(request, env, 500, "performance_failed", "Could not save performance data.", String(error?.message || error));
  }
}

export async function handleLearning(request, env) {
  if (!hasSupabase(env)) {
    return json({ success: true, memories: [], summary: summarizeLearning([]) }, env, request);
  }
  try {
    const rows = await loadLearningRows(env, 50);
    return json({
      success: true,
      memories: rows.map(clientMemory),
      summary: summarizeLearning(rows)
    }, env, request);
  } catch (error) {
    console.error("learning summary failed", error);
    return apiError(request, env, 500, "learning_failed", "Could not load learning memory.", String(error?.message || error));
  }
}
