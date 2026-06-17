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

function normalizeSupabaseRestBaseUrl(env) {
  const configured = String(env.SUPABASE_REST_URL || env.SUPABASE_URL || "").trim();
  const projectRef = String(env.SUPABASE_PROJECT_REF || "").trim();
  let value = configured || (projectRef ? `https://${projectRef}.supabase.co` : "");
  if (!/^https?:\/\//i.test(value)) value = /^[a-z0-9-]+$/i.test(value) ? `https://${value}.supabase.co` : `https://${value}`;
  const parsed = new URL(value);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = (pathname.endsWith("/rest/v1") ? pathname : `${pathname}/rest/v1`).replace(/\/+/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

async function supabaseRequest(env, path, init = {}) {
  if (!hasSupabase(env)) throw new Error("Supabase service environment variables are not configured.");
  const url = `${normalizeSupabaseRestBaseUrl(env)}/${path.replace(/^\/+/, "")}`;
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

async function queryByResearchId(env, table, researchId, order = "") {
  const primaryPath = `${table}?research_brief_id=eq.${encodeURIComponent(researchId)}&select=*${order}`;
  try {
    return await supabaseRequest(env, primaryPath, { method: "GET" });
  } catch (error) {
    const message = String(error?.message || error);
    if (!/PGRST204|column|schema cache|brief_id|research_brief_id|does not exist/i.test(message)) throw error;
    return supabaseRequest(env, `${table}?brief_id=eq.${encodeURIComponent(researchId)}&select=*${order}`, { method: "GET" });
  }
}

async function loadResearchContext(env, researchId) {
  if (!hasSupabase(env) || !isUuid(researchId)) return null;
  const briefRows = await supabaseRequest(env, `research_briefs?id=eq.${encodeURIComponent(researchId)}&select=*`, { method: "GET" });
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief) return null;
  const sourceRows = await queryByResearchId(env, "research_sources", researchId, "&order=impact.desc");
  const elementRows = await queryByResearchId(env, "viral_elements", researchId, "&order=score.desc");
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
  const place = pickFirst(material, [/(地方スーパー|スーパー|商店街|駅前|道の駅|個人店|喫茶店|ドラッグストア|ホームセンター|市役所|地方駅|古い病院|学校|閉店する店|昔からある店)/], "地方スーパー");
  const time = pickFirst(material, [/(閉店前|17時過ぎ|夕方|夜|深夜|雨の日|最後の日|平日の昼過ぎ|朝の開店直後)/], "17時過ぎ");
  const sound = pickFirst(material, [/(レジ音|BGM|店内放送|蛍光灯|台車の音|自動ドア|雨の音|冷蔵ケースの音)/], "レジ音");
  const object = pickFirst(material, [/(棚|駐車場|看板|惣菜売り場|入口|袋詰め台|通路|空き店舗|木材売り場|ガラス戸|値引きシール)/], "棚");
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
      hook: `${time}の${place}、なぜか${object}の前だけ空気が変わる。`,
      body: `${sound}が残って、人が減ったあとに見慣れた場所の輪郭だけ濃くなる。理由はないけど、そこで足が止まる。`,
      cta: "あれ、何を見て止まってるんだろう。",
      commentHook: "似た瞬間を見た場所を書き込みたくなる",
      saveReason: "身近な違和感の観察型として再利用しやすい",
      shareReason: "日常の気づきとして人に渡しやすい",
      targetAudience: "帰り道や閉店前の店の空気を覚えている人"
    },
    nostalgia: {
      title: `${place}に残る昔っぽさ`,
      hook: `${place}の${object}、新しいはずなのに${time}だけ昔の店みたいに見える。`,
      body: `${sound}の鳴り方とか、少し暗い通路とか、説明しにくい古さが急に出てくる。子どもの頃の買い物まで少し戻る。`,
      cta: "あの感じ、場所じゃなくて時間に残ってる。",
      commentHook: "昔の地元の店や家族との買い物記憶が出やすい",
      saveReason: "懐かしさ投稿の型として保存されやすい",
      shareReason: "地元の記憶として共有されやすい",
      targetAudience: "地元の店や昔のスーパーを覚えている人"
    },
    surprise: {
      title: `${place}が別の場所に見える瞬間`,
      hook: `${time}の${place}、普通の場所なのに一瞬だけ知らない店みたいになる。`,
      body: `${object}の色が沈んで、${sound}だけが大きく聞こえる。毎日ある場所ほど、急に初めて来たみたいになる。`,
      cta: "見慣れてるものが急に知らない顔する。",
      commentHook: "普通の場所が急に変に見える体験を誘える",
      saveReason: "視覚と音の描写が強く別テーマへ転用しやすい",
      shareReason: "短い驚きとしてタイムラインに置きやすい",
      targetAudience: "日常の風景をつい観察してしまう人"
    },
    empathy: {
      title: `${time}の${place}あるある`,
      hook: `${time}の${place}で、人が少なくなると急に${sound}だけ聞こえる。`,
      body: `${object}の前で立ち止まると、店全体が少し片付けに入ってる感じがして、なんとなく急がされる。`,
      cta: "店員さんより先に、空気が閉店してる。",
      commentHook: "自分の地域の店のあるあるを書き込みやすい",
      saveReason: "共感型の投稿テンプレートとして保存されやすい",
      shareReason: "身近な店の話として会話に出しやすい",
      targetAudience: "スーパーやホームセンターの閉店前を知っている人"
    },
    controversy: {
      title: `${place}の便利さと寂しさ`,
      hook: `${place}って便利になったのに、${time}だけ少し寂しく見える。`,
      body: `${object}が整いすぎて、${sound}だけ残ると、昔のごちゃっとした店の方を思い出すことがある。便利と好きは別かもしれない。`,
      cta: "便利さで消えるもの、たぶん音にもある。",
      commentHook: "便利さ派と昔の店派で静かな意見が分かれる",
      saveReason: "議論になりすぎない対立軸を保存できる",
      shareReason: "地域の変化と重ねて共有されやすい",
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

function tokenize(text) {
  return String(text || "")
    .replace(/[、。,.!?！？/\n]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function similarity(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.max(left.size, right.size);
}

function evaluateDraft(draft, allDrafts, observation) {
  const text = `${draft.hook}\n${draft.body}\n${draft.cta}`;
  const length = text.length;
  const concreteSignals = [observation.place, observation.time, observation.sound, observation.object, "人", "音", "色", "店", "昔", "便利"].filter((word) => text.includes(word)).length;
  const maxSimilarity = Math.max(...allDrafts.filter((item) => item !== draft).map((item) => similarity(text, item.text || `${item.hook} ${item.body}`)), 0);
  const duplicatePenalty = Math.round(maxSimilarity * 24);
  const trigger = draft.emotionalTrigger;
  const hookScore = clamp(58 + (draft.hook.length < 48 ? 10 : 2) + (draft.hook.includes("なぜ") || draft.hook.includes("急に") ? 10 : 4) - duplicatePenalty);
  const commentScore = clamp(55 + draft.viralScore.commentability * 0.32 + (draft.commentHook.length > 20 ? 12 : 4) - duplicatePenalty);
  const saveScore = clamp(48 + draft.viralScore.nostalgia * 0.2 + draft.viralScore.empathy * 0.16 + (draft.saveReason.length > 18 ? 12 : 4));
  const shareScore = clamp(45 + draft.viralScore.surprise * 0.16 + draft.viralScore.curiosity * 0.14 + (draft.shareReason.length > 18 ? 10 : 4));
  const noveltyScore = clamp(45 + draft.viralScore[trigger] * 0.22 + (trigger === "surprise" || trigger === "controversy" ? 10 : 5) - duplicatePenalty);
  const clarityScore = clamp(72 + concreteSignals * 3 - Math.max(0, length - 180) * 0.25 - duplicatePenalty * 0.5);
  const emotionScore = clamp(50 + draft.viralScore.empathy * 0.15 + draft.viralScore.nostalgia * 0.12 + draft.viralScore[trigger] * 0.14);
  const totalScore = clamp(
    hookScore * 0.18 +
    commentScore * 0.2 +
    saveScore * 0.12 +
    shareScore * 0.12 +
    noveltyScore * 0.14 +
    clarityScore * 0.12 +
    emotionScore * 0.12
  );
  const weakness = clarityScore < 70
    ? "少し説明が長く、投稿の芯が見えにくい。"
    : commentScore < 70
      ? "読者が自分の体験を書き込む余白がまだ弱い。"
      : noveltyScore < 70
        ? "他の案と近く、新しい見え方が少し足りない。"
        : "大きな弱点は少ないが、最後の一文を少しだけ削れる。";
  const improvementSuggestion = trigger === "curiosity"
    ? "なぜ気になるのかを説明しすぎず、観察だけで止める。"
    : trigger === "nostalgia"
      ? "昔っぽさを感情語ではなく光や音に寄せる。"
      : trigger === "surprise"
        ? "一瞬だけ変に見える理由を具体物に寄せる。"
        : trigger === "empathy"
          ? "読者の地元体験が出るように場所を少し広くする。"
          : "対立を煽らず、便利さと寂しさを同じ文に置く。";
  return {
    hookScore,
    commentScore,
    saveScore,
    shareScore,
    noveltyScore,
    clarityScore,
    emotionScore,
    totalScore,
    winnerReason: "",
    weakness,
    improvementSuggestion,
    bestCommentBait: draft.commentHook,
    riskNote: trigger === "controversy" ? "地域や店舗を断定的に悪く言わない。" : "特定店舗の事実断定は避け、観察として書く。",
    isWinner: false
  };
}

function addEvaluationRanking(drafts, observation) {
  const evaluated = drafts.map((draft) => {
    const evaluation = evaluateDraft(draft, drafts, observation);
    return {
      ...draft,
      ...evaluation,
      score: evaluation.totalScore,
      scoreTotal: evaluation.totalScore,
      viralScore: { ...draft.viralScore, total: evaluation.totalScore }
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
  return evaluated.map((draft, index) => index === 0 ? {
    ...draft,
    isWinner: true,
    winnerReason: `${draft.emotionalTrigger}の切り口が最も明確で、コメント余白と具体描写のバランスが一番強い。`
  } : draft);
}

function buildDraftCandidatesV2(context, researchId) {
  const observation = buildObservation(context);
  const drafts = REQUIRED_TRIGGERS.map((trigger, index) => {
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
  });
  return addEvaluationRanking(drafts, observation);
}

function detailFromDraft(draft) {
  return {
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
    sourceHint: draft.sourceHint,
    hookScore: draft.hookScore,
    commentScore: draft.commentScore,
    saveScore: draft.saveScore,
    shareScore: draft.shareScore,
    noveltyScore: draft.noveltyScore,
    clarityScore: draft.clarityScore,
    emotionScore: draft.emotionScore,
    totalScore: draft.totalScore,
    isWinner: draft.isWinner,
    winnerReason: draft.winnerReason,
    weakness: draft.weakness,
    improvementSuggestion: draft.improvementSuggestion,
    bestCommentBait: draft.bestCommentBait,
    riskNote: draft.riskNote
  };
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
      hookScore: Number(detail.hookScore || 0),
      commentScore: Number(detail.commentScore || 0),
      saveScore: Number(detail.saveScore || 0),
      shareScore: Number(detail.shareScore || 0),
      noveltyScore: Number(detail.noveltyScore || 0),
      clarityScore: Number(detail.clarityScore || 0),
      emotionScore: Number(detail.emotionScore || 0),
      totalScore: Number(detail.totalScore || rowOrDraft.score_total || 0),
      isWinner: Boolean(detail.isWinner),
      winnerReason: detail.winnerReason || "",
      weakness: detail.weakness || "",
      improvementSuggestion: detail.improvementSuggestion || "",
      bestCommentBait: detail.bestCommentBait || detail.commentHook || "",
      riskNote: detail.riskNote || "",
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
    hookScore: rowOrDraft.hookScore,
    commentScore: rowOrDraft.commentScore,
    saveScore: rowOrDraft.saveScore,
    shareScore: rowOrDraft.shareScore,
    noveltyScore: rowOrDraft.noveltyScore,
    clarityScore: rowOrDraft.clarityScore,
    emotionScore: rowOrDraft.emotionScore,
    totalScore: rowOrDraft.totalScore,
    isWinner: rowOrDraft.isWinner,
    winnerReason: rowOrDraft.winnerReason,
    weakness: rowOrDraft.weakness,
    improvementSuggestion: rowOrDraft.improvementSuggestion,
    bestCommentBait: rowOrDraft.bestCommentBait,
    riskNote: rowOrDraft.riskNote,
    text: rowOrDraft.text || [rowOrDraft.hook, rowOrDraft.body, rowOrDraft.cta].filter(Boolean).join("\n"),
    status: "scored",
    category: "threads",
    hookType: rowOrDraft.hookType || rowOrDraft.emotionalTrigger,
    score: rowOrDraft.score || rowOrDraft.totalScore || rowOrDraft.viralScore?.total || 0,
    scoreTotal: rowOrDraft.scoreTotal || rowOrDraft.totalScore || rowOrDraft.viralScore?.total || 0,
    scoreDetail: detailFromDraft(rowOrDraft),
    sourceTrace: rowOrDraft.sourceTrace || [rowOrDraft.researchId].filter(Boolean)
  };
}

async function insertPostDraftRows(env, rows, fallbackRows) {
  try {
    return await supabaseRequest(env, "post_drafts", {
      method: "POST",
      body: JSON.stringify(rows)
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (!/PGRST204|column|schema cache|brief_id|research_brief_id|does not exist/i.test(message)) throw error;
    return supabaseRequest(env, "post_drafts", {
      method: "POST",
      body: JSON.stringify(fallbackRows)
    });
  }
}

async function persistDrafts(env, request, researchId, drafts) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId) return drafts.map(clientDraft);
  await ensureProfile(env, userId);
  const rows = drafts.map((draft) => ({
    user_id: userId,
    research_brief_id: isUuid(researchId) ? researchId : null,
    text: draft.text,
    status: "scored",
    category: "threads",
    hook_type: draft.emotionalTrigger,
    persona: "Viral OS Draft Engine v2",
    score_total: draft.totalScore,
    score_detail: detailFromDraft(draft),
    source_trace: draft.sourceTrace
  }));
  const fallbackRows = drafts.map((draft) => ({
    user_id: userId,
    brief_id: isUuid(researchId) ? researchId : null,
    text: draft.text,
    status: "scored",
    category: "threads",
    hook_type: draft.emotionalTrigger,
    persona: "Viral OS Draft Engine v2",
    score_total: draft.totalScore,
    score_detail: detailFromDraft(draft),
    source_trace: draft.sourceTrace
  }));
  const inserted = await insertPostDraftRows(env, rows, fallbackRows);
  return (Array.isArray(inserted) ? inserted : []).map(clientDraft).sort((a, b) => (b.totalScore || b.scoreTotal || 0) - (a.totalScore || a.scoreTotal || 0));
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
    return candidates.map(clientDraft).sort((a, b) => (b.totalScore || b.scoreTotal || 0) - (a.totalScore || a.scoreTotal || 0));
  });
  return json({ success: true, drafts: drafts.slice(0, REQUIRED_TRIGGERS.length) }, env, request);
}
