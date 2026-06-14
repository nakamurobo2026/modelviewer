import { corsHeaders } from "./trend-engine.js";

const REQUIRED_TRIGGERS = ["curiosity", "nostalgia", "surprise", "empathy", "controversy"];
const TRIGGER_LABELS = {
  curiosity: "curiosity",
  nostalgia: "nostalgia",
  surprise: "surprise",
  empathy: "empathy",
  controversy: "controversy"
};

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function apiError(code, message, details) {
  return { success: false, error: { code, message, details } };
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Math.round(value), min), max);
}

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
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

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  });
}

async function loadResearchContext(env, researchId) {
  if (!hasSupabase(env) || !isUuid(researchId)) return null;
  const briefRows = await supabaseRequest(env, `research_briefs?id=eq.${encodeURIComponent(researchId)}&select=*`, { method: "GET" });
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief) return null;
  const sourceRows = await supabaseRequest(env, `research_sources?brief_id=eq.${encodeURIComponent(researchId)}&select=*&order=impact.desc`, { method: "GET" });
  const elementRows = await supabaseRequest(env, `viral_elements?brief_id=eq.${encodeURIComponent(researchId)}&select=*&order=score.desc`, { method: "GET" });
  return { brief, sources: sourceRows || [], elements: elementRows || [] };
}

function pickFirst(text, patterns, fallback) {
  for (const pattern of patterns) {
    const found = text.match(pattern)?.[0];
    if (found) return found;
  }
  return fallback;
}

function buildObservation(context) {
  const brief = context?.brief || {};
  const sources = context?.sources || [];
  const elements = context?.elements || [];
  const sourceText = sources.map((source) => `${source.title || ""} ${source.summary || ""}`).join(" ");
  const elementText = elements.map((element) => element.value || "").join(" ");
  const material = `${brief.topic || "地方スーパーの閉店前"} ${brief.summary || ""} ${sourceText} ${elementText}`;
  const place = pickFirst(material, [/(地方スーパー|スーパー|商店街|駅前|道の駅|個人店|喫茶店|ドラッグストア|ホームセンター|市役所|地方駅|古い病院|学校)/], "地方スーパー");
  const time = pickFirst(material, [/(閉店前|17時過ぎ|夕方|夜|深夜|雨の日|最後の日|平日の昼過ぎ|朝の開店直後)/], "17時過ぎ");
  const sound = pickFirst(material, [/(レジ音|BGM|店内放送|蛍光灯|台車の音|自動ドア|雨の音|冷蔵ケースの音)/], "レジ音");
  const object = pickFirst(material, [/(棚|駐車場|看板|惣菜売り場|入口|袋詰め台|通路|空き店舗|木材売り場|ガラス戸)/], "棚");
  const topic = String(brief.topic || place).replace(/\s+/g, " / ").slice(0, 80);
  const strongestSource = sources[0] || {};
  const categoryElement = elements.find((element) => element.element_type === "trend_category" || element.elementType === "trend_category");
  const angleElement = elements.find((element) => element.element_type === "emotional_angle" || element.elementType === "emotional_angle");
  return {
    topic,
    place,
    time,
    sound,
    object,
    summary: brief.summary || "",
    trendCategory: categoryElement?.value || strongestSource.source_type || "everyday_observation",
    emotionalAngle: angleElement?.value || "身近な場所の小さな変化",
    sourceHint: strongestSource.title || strongestSource.url || "research brief",
    sourceTrace: [brief.id].filter(Boolean),
    sourceCount: sources.length,
    elementCount: elements.length
  };
}

function phraseSet(observation, trigger) {
  const { place, time, sound, object } = observation;
  const map = {
    curiosity: {
      title: `${place}で気になる小さなズレ`,
      hook: `${time}の${place}、なぜか${object}の前だけ少し空気が変わる。`,
      body: `${sound}が残って、人が減ったあとに見慣れた場所の輪郭だけ濃くなる。こういう瞬間、意外と覚えてる。`,
      cta: "理由は分からないけど、何かある感じだけ残る。",
      commentHook: "同じ場所を見ている人の記憶が集まりやすい",
      saveReason: "身近な違和感を後で投稿化しやすい",
      shareReason: "日常の観察として人に渡しやすい",
      targetAudience: "帰り道や閉店前の店の空気を覚えている人"
    },
    nostalgia: {
      title: `${place}に残る昔っぽさ`,
      hook: `${place}の${object}、新しいはずなのに${time}だけ昔の店みたいに見える。`,
      body: `${sound}の鳴り方とか、少し暗い通路とか、説明しにくい古さが急に出てくる。`,
      cta: "あの感じ、たぶん場所じゃなくて時間に残ってる。",
      commentHook: "昔のスーパーや地元の店の記憶を引き出せる",
      saveReason: "懐かしさ投稿の型として再利用できる",
      shareReason: "地元の記憶として共有されやすい",
      targetAudience: "地元の店や子どもの頃の買い物を覚えている人"
    },
    surprise: {
      title: `${place}が別の場所に見える瞬間`,
      hook: `${time}の${place}、普通の場所なのに一瞬だけ知らない店みたいになる。`,
      body: `${object}の色が沈んで、${sound}だけが大きく聞こえる。毎日ある場所ほど急に変に見える。`,
      cta: "見慣れてるのに、たまに初めて見る感じがする。",
      commentHook: "普通の場所が急に変に見える体験を誘発できる",
      saveReason: "具体描写が強く、別テーマに転用しやすい",
      shareReason: "短い驚きとしてタイムラインに置きやすい",
      targetAudience: "日常の風景をつい観察してしまう人"
    },
    empathy: {
      title: `${time}の${place}あるある`,
      hook: `${time}の${place}で、人が少なくなると急に${sound}だけ聞こえる。`,
      body: `${object}の前で立ち止まると、店全体が少し片付けに入ってる感じがして、なんとなく急がされる。`,
      cta: "あれ、店員さんより先に空気が閉店してる。",
      commentHook: "あるあるとして自分の地域の話を書き込みやすい",
      saveReason: "共感型の投稿テンプレートとして保存されやすい",
      shareReason: "身近な店の話として会話に出しやすい",
      targetAudience: "スーパーやホームセンターの閉店前を知っている人"
    },
    controversy: {
      title: `${place}の便利さと寂しさ`,
      hook: `${place}って便利になったのに、${time}だけ少し寂しく見える。`,
      body: `${object}が整いすぎて、${sound}だけ残ると、昔のごちゃっとした店の方を思い出すことがある。`,
      cta: "便利さで消えるもの、たぶん音にもある。",
      commentHook: "便利さと懐かしさのどちら側かで意見が分かれる",
      saveReason: "議論になりすぎない対立軸を保存できる",
      shareReason: "自分の地域の変化と重ねて共有されやすい",
      targetAudience: "地方の店や街の変化に反応する人"
    }
  };
  return map[trigger];
}

function scoreDraft(observation, draft, trigger, index) {
  const concreteWords = [observation.place, observation.time, observation.sound, observation.object, "人", "音", "棚", "店", "地元"].filter((word) => draft.body.includes(word) || draft.hook.includes(word)).length;
  const sourceBoost = Math.min(observation.sourceCount, 8) * 2;
  const categoryBoost = String(observation.trendCategory).includes("S") ? 4 : 0;
  const base = 48 + concreteWords * 4 + sourceBoost + categoryBoost - index;
  const score = {
    curiosity: base + (trigger === "curiosity" ? 24 : trigger === "surprise" ? 10 : 4),
    nostalgia: base + (trigger === "nostalgia" ? 24 : trigger === "empathy" ? 9 : 5),
    surprise: base + (trigger === "surprise" ? 24 : trigger === "curiosity" ? 10 : 4),
    empathy: base + (trigger === "empathy" ? 24 : trigger === "nostalgia" ? 9 : 6),
    controversy: base + (trigger === "controversy" ? 24 : trigger === "surprise" ? 7 : 3),
    commentability: base + (draft.commentHook.length > 18 ? 18 : 12) + (trigger === "controversy" ? 4 : 0)
  };
  Object.keys(score).forEach((key) => { score[key] = clamp(score[key]); });
  score.total = clamp(
    score[trigger] * 0.35 +
    score.commentability * 0.25 +
    score.empathy * 0.15 +
    score.curiosity * 0.1 +
    score.nostalgia * 0.1 +
    score.surprise * 0.05
  );
  return score;
}

function buildDraftCandidatesV2(context, researchId) {
  const observation = buildObservation(context);
  return REQUIRED_TRIGGERS.map((trigger, index) => {
    const draft = phraseSet(observation, trigger);
    const viralScore = scoreDraft(observation, draft, trigger, index);
    const expectedComments = clamp(Math.round(viralScore.commentability * 0.7 + viralScore[trigger] * 0.18), 8, 90);
    const expectedSaveRate = clamp(Math.round((viralScore.nostalgia + viralScore.empathy + viralScore.commentability) / 14), 3, 24);
    const expectedEngagement = clamp(Math.round((viralScore.total + expectedComments) / 2), 10, 95);
    const text = [draft.hook, draft.body, draft.cta].filter(Boolean).join("\n");
    return {
      ...draft,
      text,
      emotionalTrigger: TRIGGER_LABELS[trigger],
      viralScore,
      score: viralScore.total,
      commentHook: draft.commentHook,
      saveReason: draft.saveReason,
      shareReason: draft.shareReason,
      targetAudience: draft.targetAudience,
      expectedComments,
      expectedSaveRate,
      expectedEngagement,
      category: "threads",
      hookType: trigger,
      scoreTotal: viralScore.total,
      sourceTrace: observation.sourceTrace.length ? observation.sourceTrace : [researchId].filter(Boolean),
      trendCategory: observation.trendCategory,
      emotionalAngle: observation.emotionalAngle,
      sourceHint: observation.sourceHint,
      researchId
    };
  }).sort((a, b) => b.viralScore.total - a.viralScore.total);
}

function clientDraft(rowOrDraft) {
  if (rowOrDraft.text && rowOrDraft.score_total !== undefined) {
    const detail = rowOrDraft.score_detail || {};
    const viralScore = detail.viralScore || detail.viral_score || { total: rowOrDraft.score_total };
    return {
      id: rowOrDraft.id,
      title: detail.title || rowOrDraft.category || "Threads draft",
      hook: detail.hook || "",
      body: detail.body || rowOrDraft.text,
      cta: detail.cta || "",
      emotionalTrigger: detail.emotionalTrigger || rowOrDraft.hook_type || "empathy",
      viralScore,
      commentHook: detail.commentHook || "",
      saveReason: detail.saveReason || "",
      shareReason: detail.shareReason || "",
      targetAudience: detail.targetAudience || "",
      expectedComments: Number(detail.expectedComments || 0),
      expectedSaveRate: Number(detail.expectedSaveRate || 0),
      expectedEngagement: Number(detail.expectedEngagement || 0),
      text: rowOrDraft.text,
      status: rowOrDraft.status,
      category: rowOrDraft.category,
      hookType: rowOrDraft.hook_type,
      score: rowOrDraft.score_total,
      scoreTotal: rowOrDraft.score_total,
      scoreDetail: detail,
      sourceTrace: rowOrDraft.source_trace || [],
      scheduledAt: rowOrDraft.scheduled_at,
      publishedAt: rowOrDraft.published_at,
      failureReason: rowOrDraft.failure_reason
    };
  }
  return {
    id: rowOrDraft.id || crypto.randomUUID(),
    title: rowOrDraft.title,
    hook: rowOrDraft.hook,
    body: rowOrDraft.body,
    cta: rowOrDraft.cta,
    emotionalTrigger: rowOrDraft.emotionalTrigger,
    viralScore: rowOrDraft.viralScore,
    commentHook: rowOrDraft.commentHook,
    saveReason: rowOrDraft.saveReason,
    shareReason: rowOrDraft.shareReason,
    targetAudience: rowOrDraft.targetAudience,
    expectedComments: rowOrDraft.expectedComments,
    expectedSaveRate: rowOrDraft.expectedSaveRate,
    expectedEngagement: rowOrDraft.expectedEngagement,
    text: rowOrDraft.text || [rowOrDraft.hook, rowOrDraft.body, rowOrDraft.cta].filter(Boolean).join("\n"),
    status: "scored",
    category: "threads",
    hookType: rowOrDraft.hookType || rowOrDraft.emotionalTrigger,
    score: rowOrDraft.score || rowOrDraft.viralScore?.total || 0,
    scoreTotal: rowOrDraft.scoreTotal || rowOrDraft.viralScore?.total || 0,
    scoreDetail: {
      title: rowOrDraft.title,
      hook: rowOrDraft.hook,
      body: rowOrDraft.body,
      cta: rowOrDraft.cta,
      emotionalTrigger: rowOrDraft.emotionalTrigger,
      viralScore: rowOrDraft.viralScore,
      commentHook: rowOrDraft.commentHook,
      saveReason: rowOrDraft.saveReason,
      shareReason: rowOrDraft.shareReason,
      targetAudience: rowOrDraft.targetAudience,
      expectedComments: rowOrDraft.expectedComments,
      expectedSaveRate: rowOrDraft.expectedSaveRate,
      expectedEngagement: rowOrDraft.expectedEngagement,
      trendCategory: rowOrDraft.trendCategory,
      emotionalAngle: rowOrDraft.emotionalAngle,
      sourceHint: rowOrDraft.sourceHint
    },
    sourceTrace: rowOrDraft.sourceTrace || [rowOrDraft.researchId].filter(Boolean)
  };
}

async function persistDrafts(env, request, researchId, drafts) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId) return drafts.map(clientDraft);
  await ensureProfile(env, userId);
  const rows = drafts.map((draft) => ({
    user_id: userId,
    brief_id: isUuid(researchId) ? researchId : null,
    text: draft.text,
    status: "scored",
    category: "threads",
    hook_type: draft.emotionalTrigger,
    persona: "Viral OS Draft Engine v2",
    score_total: draft.viralScore.total,
    score_detail: {
      title: draft.title,
      hook: draft.hook,
      body: draft.body,
      cta: draft.cta,
      emotionalTrigger: draft.emotionalTrigger,
      viralScore: draft.viralScore,
      commentHook: draft.commentHook,
      saveReason: draft.saveReason,
      shareReason: draft.shareReason,
      targetAudience: draft.targetAudience,
      expectedComments: draft.expectedComments,
      expectedSaveRate: draft.expectedSaveRate,
      expectedEngagement: draft.expectedEngagement,
      trendCategory: draft.trendCategory,
      emotionalAngle: draft.emotionalAngle,
      sourceHint: draft.sourceHint
    },
    source_trace: draft.sourceTrace
  }));
  const inserted = await supabaseRequest(env, "post_drafts", {
    method: "POST",
    body: JSON.stringify(rows)
  });
  return (Array.isArray(inserted) ? inserted : []).map(clientDraft).sort((a, b) => (b.viralScore?.total || b.scoreTotal || 0) - (a.viralScore?.total || a.scoreTotal || 0));
}

export async function handleDraftGenerateV2(request, env) {
  const body = await request.json().catch(() => ({}));
  const researchId = String(body.researchId || body.briefId || "").trim();
  if (!researchId) return json(apiError("missing_research_id", "researchId is required."), env, request, 400);
  let context = null;
  try {
    context = await loadResearchContext(env, researchId);
  } catch (error) {
    console.error("draft v2 research load fallback", error);
  }
  const candidates = buildDraftCandidatesV2(context, researchId);
  const drafts = await persistDrafts(env, request, researchId, candidates).catch((error) => {
    console.error("draft v2 persistence fallback", error);
    return candidates.map(clientDraft);
  });
  return json({ success: true, drafts: drafts.slice(0, REQUIRED_TRIGGERS.length) }, env, request);
}
