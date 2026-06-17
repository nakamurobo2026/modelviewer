import { handleDraftGenerateV2 } from "./draft-v2-engine.js";
import { loadLearningContext } from "./learning-engine.js";
import { rewriteDraftsToThreadsNative } from "./threads-post-writer-v2.js";

function hasSupabase(env) {
  return Boolean((env.SUPABASE_URL || env.SUPABASE_REST_URL || env.SUPABASE_PROJECT_REF) && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
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

class SupabasePersistenceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SupabasePersistenceError";
    this.details = details;
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSupabaseRestBaseUrl(env) {
  const configured = String(env.SUPABASE_REST_URL || env.SUPABASE_URL || "").trim();
  const projectRef = String(env.SUPABASE_PROJECT_REF || "").trim();
  let value = configured || (projectRef ? `https://${projectRef}.supabase.co` : "");
  if (!value) throw new SupabasePersistenceError("Supabase URL is not configured.", { operation: "config" });
  if (!/^https?:\/\//i.test(value)) value = /^[a-z0-9-]+$/i.test(value) ? `https://${value}.supabase.co` : `https://${value}`;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new SupabasePersistenceError("Supabase URL is invalid.", { operation: "config", cause: String(error?.message || error) });
  }
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = (pathname.endsWith("/rest/v1") ? pathname : `${pathname}/rest/v1`).replace(/\/+/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function errorDetails(error) {
  if (error instanceof SupabasePersistenceError) return error.details;
  return { cause: String(error?.message || error) };
}

function isSchemaMismatch(error) {
  const details = errorDetails(error);
  const body = typeof details.response === "string" ? details.response : JSON.stringify(details.response || {});
  return /PGRST204|column|schema cache|Could not find|does not exist/i.test(body);
}

async function supabaseRequest(env, path, init = {}, operation = path) {
  if (!hasSupabase(env)) return null;
  const baseUrl = normalizeSupabaseRestBaseUrl(env);
  const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;
  const endpoint = new URL(url);
  let response;
  let raw = "";
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(init.headers || {})
      }
    });
    raw = await response.text();
  } catch (error) {
    throw new SupabasePersistenceError("Supabase fetch failed before an HTTP response was returned.", {
      operation,
      method: init.method || "GET",
      host: endpoint.hostname,
      path: endpoint.pathname,
      cause: String(error?.message || error)
    });
  }
  if (!response.ok) {
    const parsed = safeJsonParse(raw);
    const cloudflareCode = raw.match(/error\s+code:\s*(\d+)/i)?.[1] || raw.match(/code\s*[:=]\s*(\d+)/i)?.[1] || parsed?.code;
    throw new SupabasePersistenceError(`Supabase ${response.status} during ${operation}.`, {
      operation,
      method: init.method || "GET",
      host: endpoint.hostname,
      path: endpoint.pathname,
      status: response.status,
      statusText: response.statusText,
      cloudflareCode,
      response: parsed || raw.slice(0, 1000)
    });
  }
  return raw ? JSON.parse(raw) : null;
}

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  }, "profiles.upsert");
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function draftText(draft) {
  return draft.post_text || draft.postText || draft.text || [draft.hook, draft.body, draft.closing_line || draft.closingLine || draft.cta].filter(Boolean).join("\n");
}

function safeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).slice(0, 240));
  if (!value) return [];
  return [String(value).slice(0, 240)];
}

function detailFromDraft(draft) {
  const existing = draft.scoreDetail || {};
  const postText = draft.post_text || draft.postText || existing.post_text || existing.postText || draft.text;
  return {
    ...existing,
    post_text: postText,
    hook: draft.hook || existing.hook || "",
    body: draft.body || existing.body || postText,
    closing_line: draft.closing_line || draft.closingLine || existing.closing_line || draft.cta || existing.cta || "",
    comment_bait: draft.comment_bait || draft.commentBait || existing.comment_bait || existing.commentHook || "",
    emotional_trigger: draft.emotional_trigger || draft.emotionalTrigger || existing.emotional_trigger || existing.emotionalTrigger || draft.hookType || "empathy",
    emotionalTrigger: draft.emotionalTrigger || draft.emotional_trigger || existing.emotionalTrigger || existing.emotional_trigger || draft.hookType || "empathy",
    viral_score: draft.viral_score || draft.viralScore?.total || existing.viral_score || existing.viralScore?.total || draft.scoreTotal || draft.score || 0,
    viralScore: draft.viralScore || existing.viralScore || { total: draft.scoreTotal || draft.score || 0 },
    source_ids: safeArray(draft.source_ids || draft.sourceIds || existing.source_ids || draft.sourceTrace),
    totalScore: draft.totalScore || existing.totalScore || draft.scoreTotal || draft.score || 0
  };
}

function clientDraft(rowOrDraft) {
  if (rowOrDraft?.text && rowOrDraft?.score_total !== undefined) {
    const detail = rowOrDraft.score_detail || {};
    const postText = detail.post_text || rowOrDraft.text;
    return {
      id: rowOrDraft.id,
      post_text: postText,
      postText,
      title: detail.title || rowOrDraft.category || "Threads draft",
      hook: detail.hook || "",
      body: detail.body || postText,
      cta: detail.closing_line || detail.cta || "",
      closing_line: detail.closing_line || detail.cta || "",
      closingLine: detail.closing_line || detail.cta || "",
      comment_bait: detail.comment_bait || detail.commentHook || "",
      commentBait: detail.comment_bait || detail.commentHook || "",
      emotional_trigger: detail.emotional_trigger || detail.emotionalTrigger || rowOrDraft.hook_type || "empathy",
      emotionalTrigger: detail.emotionalTrigger || detail.emotional_trigger || rowOrDraft.hook_type || "empathy",
      viral_score: detail.viral_score || detail.viralScore?.total || rowOrDraft.score_total || 0,
      viralScore: detail.viralScore || { total: rowOrDraft.score_total || 0 },
      source_ids: detail.source_ids || rowOrDraft.source_trace || [],
      sourceIds: detail.source_ids || rowOrDraft.source_trace || [],
      text: postText,
      status: rowOrDraft.status,
      category: rowOrDraft.category,
      hookType: rowOrDraft.hook_type,
      score: rowOrDraft.score_total,
      scoreTotal: rowOrDraft.score_total || 0,
      totalScore: Number(detail.totalScore || rowOrDraft.score_total || 0),
      scoreDetail: detail,
      sourceTrace: rowOrDraft.source_trace || [],
      persistence: rowOrDraft.persistence
    };
  }
  return rowOrDraft;
}

function scoreDraftWithLearning(draft, learning) {
  const text = draftText(draft);
  const trigger = draft.emotional_trigger || draft.emotionalTrigger || draft.scoreDetail?.emotional_trigger || draft.scoreDetail?.emotionalTrigger || draft.hookType || "empathy";
  const category = draft.scoreDetail?.trendCategory || draft.category || "threads";
  const preferredTriggers = new Set((learning.preferredTriggers || []).map(normalize));
  const preferredCategories = new Set((learning.preferredCategories || []).map(normalize));
  const winningPatterns = learning.winningPatterns || [];
  const losingPatterns = learning.losingPatterns || [];
  let boost = 0;

  if (preferredTriggers.has(normalize(trigger))) boost += 7;
  if (preferredCategories.has(normalize(category))) boost += 5;

  const winningHits = winningPatterns.filter((pattern) => {
    const hook = normalize(pattern.hook);
    const bait = normalize(pattern.commentBait);
    return (hook.length > 6 && normalize(text).includes(hook.slice(0, 18))) || (bait.length > 6 && normalize(text).includes(bait.slice(0, 18)));
  });
  const losingHits = losingPatterns.filter((pattern) => {
    const hook = normalize(pattern.hook);
    const bait = normalize(pattern.commentBait);
    return (hook.length > 6 && normalize(text).includes(hook.slice(0, 18))) || (bait.length > 6 && normalize(text).includes(bait.slice(0, 18)));
  });

  boost += Math.min(8, winningHits.length * 4);
  boost -= Math.min(12, losingHits.length * 6);

  const baseTotal = draft.totalScore || draft.scoreDetail?.totalScore || draft.viralScore?.total || draft.viral_score || draft.scoreTotal || draft.score || 0;
  const totalScore = clampScore(baseTotal + boost);
  const viralScore = { ...(draft.viralScore || draft.scoreDetail?.viralScore || {}), total: totalScore };
  const scoreDetail = {
    ...detailFromDraft(draft),
    totalScore,
    viralScore,
    learningBoost: boost,
    learningContext: {
      preferredTriggers: (learning.preferredTriggers || []).slice(0, 5),
      preferredCategories: (learning.preferredCategories || []).slice(0, 5),
      avoidedPatterns: losingPatterns.slice(0, 3).map((pattern) => pattern.hook || pattern.commentBait).filter(Boolean)
    }
  };

  return {
    ...draft,
    text,
    post_text: text,
    postText: text,
    viralScore,
    scoreDetail,
    totalScore,
    scoreTotal: totalScore,
    score: totalScore,
    learningBoost: boost,
    learningContext: scoreDetail.learningContext
  };
}

function applyLearningRanking(drafts, learning) {
  if (!Array.isArray(drafts) || !drafts.length) return drafts || [];
  const ranked = learning && (learning.preferredTriggers?.length || learning.preferredCategories?.length || learning.winningPatterns?.length || learning.losingPatterns?.length)
    ? drafts.map((draft) => scoreDraftWithLearning(draft, learning))
    : drafts.map((draft) => ({ ...draft, text: draftText(draft), post_text: draftText(draft), postText: draftText(draft), scoreDetail: detailFromDraft(draft) }));

  return ranked
    .sort((a, b) => (b.totalScore || b.scoreTotal || b.score || 0) - (a.totalScore || a.scoreTotal || a.score || 0))
    .map((draft, index) => {
      const isWinner = index === 0;
      const boost = Number(draft.learningBoost || 0);
      const learningNote = boost > 0 ? "Learning memory favors this pattern." : boost < 0 ? "Learning memory reduced similar weak patterns." : "Learning memory found a neutral match.";
      return {
        ...draft,
        isWinner,
        winnerReason: isWinner ? `${draft.winnerReason || draft.scoreDetail?.winnerReason || "Highest ranked draft."} ${learningNote}` : draft.winnerReason,
        scoreDetail: {
          ...(draft.scoreDetail || {}),
          isWinner,
          winnerReason: isWinner ? `${draft.scoreDetail?.winnerReason || draft.winnerReason || "Highest ranked draft."} ${learningNote}` : draft.scoreDetail?.winnerReason
        }
      };
    });
}

async function existingDraftIds(env, drafts) {
  const ids = drafts.map((draft) => draft.id).filter(isUuid);
  if (!ids.length || !hasSupabase(env)) return new Set();
  const rows = await supabaseRequest(env, `post_drafts?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id`, { method: "GET" }, "post_drafts.existing_ids");
  return new Set((rows || []).map((row) => row.id));
}

function draftRow(draft, userId, researchId, linkColumn = "research_brief_id") {
  const detail = detailFromDraft(draft);
  return {
    user_id: userId,
    [linkColumn]: isUuid(researchId) ? researchId : null,
    text: draftText(draft),
    status: "scored",
    category: draft.category || "threads",
    hook_type: draft.emotional_trigger || draft.emotionalTrigger || draft.hookType || detail.emotional_trigger || "empathy",
    score_total: draft.totalScore || draft.scoreTotal || draft.score || 0,
    score_detail: detail,
    source_trace: safeArray(draft.source_ids || draft.sourceIds || draft.sourceTrace || [researchId])
  };
}

async function insertDraftRows(env, rows, fallbackRows) {
  try {
    return await supabaseRequest(env, "post_drafts", {
      method: "POST",
      body: JSON.stringify(rows)
    }, "post_drafts.insert");
  } catch (error) {
    if (!fallbackRows || !isSchemaMismatch(error)) throw error;
    return supabaseRequest(env, "post_drafts", {
      method: "POST",
      body: JSON.stringify(fallbackRows)
    }, "post_drafts.insert.fallback");
  }
}

async function persistGeneratedDrafts(env, request, researchId, drafts) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId || !isUuid(researchId)) return { drafts, persistence: { ok: true, skipped: true, reason: "missing_supabase_or_research_id" } };
  await ensureProfile(env, userId);
  const existing = await existingDraftIds(env, drafts);
  const newDrafts = drafts.filter((draft) => !existing.has(draft.id));
  if (!newDrafts.length) return { drafts, persistence: { ok: true, inserted: 0, skipped: drafts.length } };
  const rows = newDrafts.map((draft) => draftRow(draft, userId, researchId, "research_brief_id"));
  const fallbackRows = newDrafts.map((draft) => draftRow(draft, userId, researchId, "brief_id"));

  try {
    const inserted = await insertDraftRows(env, rows, fallbackRows);
    const insertedDrafts = (Array.isArray(inserted) ? inserted : []).map(clientDraft);
    return {
      drafts: insertedDrafts.length ? insertedDrafts : drafts,
      persistence: { ok: true, table: "post_drafts", inserted: insertedDrafts.length || rows.length, skipped: 0 }
    };
  } catch (bulkError) {
    const insertedDrafts = [];
    const errors = [];
    for (let index = 0; index < rows.length; index += 1) {
      try {
        const single = await insertDraftRows(env, [rows[index]], [fallbackRows[index]]);
        if (Array.isArray(single)) insertedDrafts.push(...single.map(clientDraft));
      } catch (rowError) {
        errors.push({ index, error: errorDetails(rowError) });
      }
    }
    const persisted = insertedDrafts.length ? insertedDrafts : drafts;
    return {
      drafts: persisted,
      persistence: {
        ok: errors.length === 0,
        partial_success: errors.length > 0 && insertedDrafts.length > 0,
        table: "post_drafts",
        inserted: insertedDrafts.length,
        skipped: errors.length,
        errors,
        bulkError: errorDetails(bulkError)
      }
    };
  }
}

async function persistAdjustedDrafts(env, drafts) {
  if (!hasSupabase(env)) return { ok: true, skipped: true };
  const results = await Promise.allSettled(drafts.map((draft) => {
    if (!isUuid(draft.id)) return null;
    return supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        text: draftText(draft),
        score_total: draft.totalScore || draft.scoreTotal || draft.score || 0,
        score_detail: detailFromDraft(draft)
      })
    }, `post_drafts.patch.${draft.id}`);
  }));
  const rejected = results.filter((result) => result.status === "rejected");
  return { ok: rejected.length === 0, rejected: rejected.length };
}

export async function handleDraftGenerateWithLearning(request, env) {
  const requestForBody = request.clone();
  const body = await requestForBody.json().catch(() => ({}));
  const researchId = String(body.researchId || body.briefId || "").trim();
  const response = await handleDraftGenerateV2(request, env);
  const headers = new Headers(response.headers);
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("draft learning parse failed", error, raw.slice(0, 500));
    return new Response(raw, { status: response.status, headers });
  }

  if (!response.ok || !data?.success || !Array.isArray(data.drafts)) {
    return new Response(JSON.stringify(data), { status: response.status, headers });
  }

  try {
    const publicDrafts = rewriteDraftsToThreadsNative(data.drafts, researchId);
    const learning = await loadLearningContext(env);
    const rankedDrafts = applyLearningRanking(publicDrafts, learning);
    const persisted = await persistGeneratedDrafts(env, request, researchId, rankedDrafts);
    const finalDrafts = applyLearningRanking(persisted.drafts, learning).map((draft) => ({
      ...draft,
      persistence: persisted.persistence
    }));
    const patchPersistence = await persistAdjustedDrafts(env, finalDrafts);
    const partialSuccess = Boolean(persisted.persistence?.partial_success || persisted.persistence?.ok === false || patchPersistence.ok === false);
    return new Response(JSON.stringify({
      ...data,
      drafts: finalDrafts,
      learningApplied: true,
      learningSummary: learning.summary,
      writer: "threads-post-writer-v2",
      persistence: {
        ok: !partialSuccess,
        partial_success: partialSuccess,
        post_drafts: persisted.persistence,
        post_drafts_patch: patchPersistence
      }
    }), { status: response.status, headers });
  } catch (error) {
    console.error("draft learning adjustment failed", error);
    return new Response(JSON.stringify({ ...data, learningApplied: false, learningError: String(error?.message || error) }), { status: response.status, headers });
  }
}
