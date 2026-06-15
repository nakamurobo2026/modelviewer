import { handleDraftGenerateV2 } from "./draft-v2-engine.js";
import { loadLearningContext } from "./learning-engine.js";

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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

async function supabaseRequest(env, path, init = {}) {
  if (!hasSupabase(env)) return null;
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

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  });
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
  return draft.text || [draft.hook, draft.body, draft.cta].filter(Boolean).join("\n");
}

function detailFromDraft(draft) {
  return {
    ...(draft.scoreDetail || {}),
    title: draft.title || draft.scoreDetail?.title,
    hook: draft.hook || draft.scoreDetail?.hook,
    body: draft.body || draft.scoreDetail?.body,
    cta: draft.cta || draft.scoreDetail?.cta,
    emotionalTrigger: draft.emotionalTrigger || draft.scoreDetail?.emotionalTrigger || draft.hookType,
    viralScore: draft.viralScore || draft.scoreDetail?.viralScore,
    totalScore: draft.totalScore || draft.scoreDetail?.totalScore || draft.scoreTotal || draft.score
  };
}

function clientDraft(rowOrDraft) {
  if (rowOrDraft?.text && rowOrDraft?.score_total !== undefined) {
    const detail = rowOrDraft.score_detail || {};
    return {
      id: rowOrDraft.id,
      title: detail.title || rowOrDraft.category || "Threads draft",
      hook: detail.hook || "",
      body: detail.body || rowOrDraft.text,
      cta: detail.cta || "",
      emotionalTrigger: detail.emotionalTrigger || rowOrDraft.hook_type || "empathy",
      viralScore: detail.viralScore || { total: rowOrDraft.score_total || 0 },
      text: rowOrDraft.text,
      status: rowOrDraft.status,
      category: rowOrDraft.category,
      hookType: rowOrDraft.hook_type,
      score: rowOrDraft.score_total,
      scoreTotal: rowOrDraft.score_total || 0,
      totalScore: Number(detail.totalScore || rowOrDraft.score_total || 0),
      scoreDetail: detail,
      sourceTrace: rowOrDraft.source_trace || []
    };
  }
  return rowOrDraft;
}

function scoreDraftWithLearning(draft, learning) {
  const text = `${draft.title || ""} ${draft.hook || ""} ${draft.body || ""} ${draft.cta || ""} ${draft.text || ""}`;
  const trigger = draft.emotionalTrigger || draft.scoreDetail?.emotionalTrigger || draft.hookType || "empathy";
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

  const baseTotal = draft.totalScore || draft.scoreDetail?.totalScore || draft.viralScore?.total || draft.scoreTotal || draft.score || 0;
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
    text: draftText(draft),
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
    : drafts.map((draft) => ({ ...draft, text: draftText(draft), scoreDetail: detailFromDraft(draft) }));

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
  const rows = await supabaseRequest(env, `post_drafts?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id`, { method: "GET" });
  return new Set((rows || []).map((row) => row.id));
}

async function persistGeneratedDrafts(env, request, researchId, drafts) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId || !isUuid(researchId)) return drafts;
  await ensureProfile(env, userId);
  const existing = await existingDraftIds(env, drafts);
  const newDrafts = drafts.filter((draft) => !existing.has(draft.id));
  if (!newDrafts.length) return drafts;
  const rows = newDrafts.map((draft) => ({
    user_id: userId,
    research_brief_id: researchId,
    text: draftText(draft),
    status: "scored",
    category: draft.category || "threads",
    hook_type: draft.emotionalTrigger || draft.hookType || draft.scoreDetail?.emotionalTrigger || "empathy",
    score_total: draft.totalScore || draft.scoreTotal || draft.score || 0,
    score_detail: draft.scoreDetail || detailFromDraft(draft),
    source_trace: draft.sourceTrace || [researchId]
  }));
  const inserted = await supabaseRequest(env, "post_drafts", {
    method: "POST",
    body: JSON.stringify(rows)
  });
  const insertedDrafts = (Array.isArray(inserted) ? inserted : []).map(clientDraft);
  return insertedDrafts.length ? insertedDrafts : drafts;
}

async function persistAdjustedDrafts(env, drafts) {
  if (!hasSupabase(env)) return;
  await Promise.allSettled(drafts.map((draft) => {
    if (!isUuid(draft.id)) return null;
    return supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        score_total: draft.totalScore || draft.scoreTotal || draft.score || 0,
        score_detail: draft.scoreDetail || detailFromDraft(draft)
      })
    });
  }));
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
    const learning = await loadLearningContext(env);
    const rankedDrafts = applyLearningRanking(data.drafts, learning);
    const persistedDrafts = await persistGeneratedDrafts(env, request, researchId, rankedDrafts);
    const finalDrafts = applyLearningRanking(persistedDrafts, learning);
    await persistAdjustedDrafts(env, finalDrafts);
    return new Response(JSON.stringify({ ...data, drafts: finalDrafts, learningApplied: true, learningSummary: learning.summary }), { status: response.status, headers });
  } catch (error) {
    console.error("draft learning adjustment failed", error);
    return new Response(JSON.stringify({ ...data, learningApplied: false, learningError: String(error?.message || error) }), { status: response.status, headers });
  }
}
