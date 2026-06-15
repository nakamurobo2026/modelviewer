import { handleDraftGenerateV2 } from "./draft-v2-engine.js";
import { loadLearningContext } from "./learning-engine.js";

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalize(value) {
  return String(value || "").toLowerCase();
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
    ...(draft.scoreDetail || {}),
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
  if (!learning || !(learning.preferredTriggers?.length || learning.preferredCategories?.length || learning.winningPatterns?.length || learning.losingPatterns?.length)) {
    return [...drafts].sort((a, b) => (b.totalScore || b.scoreTotal || 0) - (a.totalScore || a.scoreTotal || 0)).map((draft, index) => ({ ...draft, isWinner: index === 0, scoreDetail: { ...(draft.scoreDetail || {}), isWinner: index === 0 } }));
  }
  return drafts
    .map((draft) => scoreDraftWithLearning(draft, learning))
    .sort((a, b) => (b.totalScore || b.scoreTotal || 0) - (a.totalScore || a.scoreTotal || 0))
    .map((draft, index) => {
      const isWinner = index === 0;
      const learningNote = draft.learningBoost > 0 ? "Learning memory favors this pattern." : draft.learningBoost < 0 ? "Learning memory reduced similar weak patterns." : "Learning memory found a neutral match.";
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

async function persistAdjustedDrafts(env, drafts) {
  if (!hasSupabase(env)) return;
  await Promise.allSettled(drafts.map((draft) => {
    if (!draft.id) return null;
    return supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        score_total: draft.totalScore || draft.scoreTotal || draft.score || 0,
        score_detail: draft.scoreDetail || {}
      })
    });
  }));
}

export async function handleDraftGenerateWithLearning(request, env) {
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
    const drafts = applyLearningRanking(data.drafts, learning);
    await persistAdjustedDrafts(env, drafts);
    return new Response(JSON.stringify({ ...data, drafts, learningApplied: true, learningSummary: learning.summary }), { status: response.status, headers });
  } catch (error) {
    console.error("draft learning adjustment failed", error);
    return new Response(JSON.stringify({ ...data, learningApplied: false, learningError: String(error?.message || error) }), { status: response.status, headers });
  }
}
