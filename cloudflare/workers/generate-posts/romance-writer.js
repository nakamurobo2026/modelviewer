const ACTIVE_WRITER_NAME = "female-romance-writer";
const ACTIVE_WRITER_VERSION = "v1.1.0";
const DEFAULT_ORIGINS = ["https://nakamurobo2026.github.io", "https://viral-os-phi.vercel.app"];
const FORBIDDEN_TERMS = [
  "女の子",
  "女の子は",
  "女性は",
  "彼女は",
  "男性は",
  "人は",
  "駅",
  "ホーム",
  "駅のホーム",
  "部屋",
  "夜の部屋",
  "スマホ画面",
  "情景描写",
  "作文",
  "解説",
  "考察",
  "観察"
];
const POETIC_ONLY_TERMS = ["余韻", "静寂", "夜空", "月", "星", "涙", "記憶だけ", "匂いだけ", "光だけ", "夢みたい"];
const HUMAN_WEAKNESS_TERMS = [
  "さみしい",
  "寂しい",
  "不安",
  "恥ずかしい",
  "嫉妬",
  "未練",
  "伸びない",
  "見てほしい",
  "気になる",
  "めんどくさい",
  "分かってる",
  "強がった",
  "勘違い",
  "嘘",
  "普通に",
  "ごめん",
  "怖い",
  "待ってる"
];

export function romanceCorsHeaders(env, origin) {
  const configured = [env.ALLOWED_ORIGIN, env.ALLOWED_ORIGINS]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...DEFAULT_ORIGINS, ...configured]);
  const requestOrigin = origin && allowedOrigins.has(origin) ? origin : (env.ALLOWED_ORIGIN || DEFAULT_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: romanceCorsHeaders(env, request.headers.get("Origin")) });
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

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
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
  const encodedId = encodeURIComponent(researchId);
  const [briefRows, sourceRows, elementRows] = await Promise.all([
    supabaseRequest(env, `research_briefs?id=eq.${encodedId}&select=*`, { method: "GET" }),
    supabaseRequest(env, `research_sources?brief_id=eq.${encodedId}&select=*`, { method: "GET" }).catch((error) => {
      console.error("research_sources load failed", error);
      return [];
    }),
    supabaseRequest(env, `viral_elements?brief_id=eq.${encodedId}&select=*`, { method: "GET" }).catch((error) => {
      console.error("viral_elements load failed", error);
      return [];
    })
  ]);
  return {
    brief: Array.isArray(briefRows) ? briefRows[0] : null,
    sources: Array.isArray(sourceRows) ? sourceRows : [],
    elements: Array.isArray(elementRows) ? elementRows : []
  };
}

function asBrief(context) {
  return context?.brief || context || {};
}

function researchMaterial(context) {
  const brief = asBrief(context);
  const sources = Array.isArray(context?.sources) ? context.sources : [];
  const elements = Array.isArray(context?.elements) ? context.elements : [];
  return [
    brief.topic,
    brief.query,
    brief.summary,
    brief.research_summary,
    ...sources.flatMap((source) => [source.title, source.summary, source.content, source.url]),
    ...elements.flatMap((element) => [element.value, element.element_type, element.elementType])
  ]
    .filter(Boolean)
    .join(" ");
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function extractTopicTokens(context) {
  const material = researchMaterial(context);
  const tokens = [
    "LINE",
    "返信",
    "返事",
    "既読",
    "未読",
    "連絡",
    "脈あり",
    "脈なし",
    "好き",
    "会いたい",
    "元カレ",
    "元彼",
    "元カノ",
    "未練",
    "嫉妬",
    "匂わせ",
    "浮気",
    "他の子",
    "都合",
    "沼",
    "依存",
    "距離感",
    "夜",
    "寂しい",
    "さみしい"
  ];
  return unique(tokens.filter((token) => material.includes(token)));
}

function extractResearchInsights(context) {
  const brief = asBrief(context);
  const material = researchMaterial(context);
  const topic = String(brief.topic || brief.query || "").trim();
  const insights = [];

  if (/LINE|返信|返事|既読|未読|連絡/.test(material)) {
    insights.push(
      "返信速度と好意は一致しない",
      "考えすぎて返信が遅くなる",
      "返信が遅いだけで脈なしに見られやすい"
    );
  }
  if (/脈あり|脈なし/.test(material)) {
    insights.push("脈なしに見える態度ほど本音が残っていることがある");
  }
  if (/元カレ|元彼|元カノ|未練|昔の恋/.test(material)) {
    insights.push("終わった恋ほど自分だけまだ続きにいる感じがする");
  }
  if (/嫉妬|匂わせ|浮気|他の子|知らない名前/.test(material)) {
    insights.push("気にしてないふりほど嫉妬が出る");
  }
  if (/都合|沼|依存|距離感/.test(material)) {
    insights.push("都合よく扱われていると分かっていても離れにくい");
  }
  if (/夜|深夜|寝る前|寂しい|さみしい/.test(material)) {
    insights.push("夜だけ本音が勝ってしまう");
  }

  const elementInsights = Array.isArray(context?.elements)
    ? context.elements
        .filter((element) => Number(element.score || 0) >= 70 || /hook|angle|emotional/i.test(String(element.element_type || element.elementType || "")))
        .map((element) => String(element.value || "").trim())
        .filter((value) => value.length >= 4 && value.length <= 40)
    : [];
  insights.push(...elementInsights);

  if (!insights.length && topic) {
    insights.push(`${topic.replace(/\s+/g, " ")}で本音と強がりがずれる`);
  }
  if (!insights.length) {
    insights.push("好きな気持ちほど素直に出せない");
  }

  return unique(insights).slice(0, 10);
}

function expandInsightsForDrafts(insights, count = 10) {
  const base = insights.length ? insights : ["好きな気持ちほど素直に出せない"];
  const expanded = [];
  for (let index = 0; index < count; index += 1) {
    expanded.push(base[index % base.length]);
  }
  return expanded;
}

function splitMicroLine(line, max = 12) {
  if (line.length <= max) return [line];
  const chunks = [];
  for (let index = 0; index < line.length; index += max) chunks.push(line.slice(index, index + max));
  return chunks;
}

function formatPost(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .replace(/[「」『』]/g, "")
    .replace(/女の子は|女性は|彼女は|男性は|人は/g, "私")
    .replace(/駅のホーム|ホーム|駅|夜の部屋|部屋|スマホ画面|情景描写|作文|解説|考察|観察/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => splitMicroLine(line));
  const output = lines.length ? lines : ["正直", "会いたいって", "言われたい", "だけ"];
  const ending = output[output.length - 1] || "";
  if (!/(\.\.\.|かも|だけ|まだ|なのに|きっと|はずなのに)$/.test(ending)) output.push("かも");
  return output.join("\n");
}

function scoreResearchGrounding(text, insight, context) {
  const tokens = extractTopicTokens(context);
  const insightTerms = unique(String(insight || "").match(/LINE|返信|返事|既読|未読|連絡|好意|考えすぎ|脈なし|脈あり|好き|会いたい|未練|嫉妬|匂わせ|都合|沼|依存|距離感|夜|本音|強がり/g) || []);
  let score = 28;
  score += Math.min(tokens.filter((token) => text.includes(token)).length * 18, 42);
  score += Math.min(insightTerms.filter((term) => text.includes(term)).length * 16, 40);
  if (String(insight || "").slice(0, 4) && text.includes(String(insight || "").slice(0, 4))) score += 8;
  if (/(返信|返事|LINE|既読|未読|脈なし|脈あり)/.test(researchMaterial(context)) && !/(返信|返事|LINE|既読|未読|脈なし|脈あり)/.test(text)) score -= 28;
  return Math.max(0, Math.min(100, score));
}

function researchGroundingReason(text, insight, context) {
  const tokens = extractTopicTokens(context).filter((token) => text.includes(token));
  return tokens.length
    ? `研究トピック語: ${tokens.join(" / ")}。利用インサイト: ${insight}`
    : `利用インサイト: ${insight}`;
}

function validatePost(text, insight, context) {
  const reasons = [];
  const humanityScore = scoreHumanity(text);
  const groundingScore = scoreResearchGrounding(text, insight, context);
  const poeticOnlyCount = POETIC_ONLY_TERMS.filter((term) => text.includes(term)).length;
  for (const term of FORBIDDEN_TERMS) {
    if (text.includes(term)) reasons.push(`forbidden_term:${term}`);
  }
  if (!/(私|正直|なんか|たぶん|まだ|きっと|会いたい|返事|通知|既読|未読|嘘|もういい|知らない名前|消せない|優しく|勘違い|さみしい|寂しい|不安|嫉妬|伸びない|見てほしい|めんどくさい)/.test(text)) {
    reasons.push("missing_first_person_or_implied_female_voice");
  }
  if (/(です|ます|について|重要|理由|方法|すべき|しましょう|アドバイス|分析|調査|説明)/.test(text)) reasons.push("explanatory_or_advice_tone");
  if (text.split("\n").some((line) => line.length > 14)) reasons.push("line_too_long");
  if (!/(\.\.\.|かも|だけ|まだ|なのに|きっと|はずなのに)$/.test(text.trim())) reasons.push("resolved_ending");
  if (humanityScore < 72) reasons.push("low_humanity_score");
  if (!insight) reasons.push("missing_research_insight");
  if (groundingScore < 70) reasons.push("low_research_grounding_score");
  if (extractTopicTokens(context).length > 0 && !extractTopicTokens(context).some((token) => text.includes(token))) reasons.push("missing_research_topic");
  if (poeticOnlyCount >= 2 && humanityScore < 86) reasons.push("poem_only");
  return { ok: reasons.length === 0, reasons };
}

function scoreHumanity(text) {
  let score = 48;
  const weaknessHits = HUMAN_WEAKNESS_TERMS.filter((term) => text.includes(term)).length;
  score += weaknessHits * 8;
  if (/(正直|なんか|たぶん|私|普通に|ごめん|ほんとは)/.test(text)) score += 12;
  if (/(伸びない|見てほしい|待ってる|気になる|勘違い|めんどくさい|嫉妬|不安|さみしい|寂しい)/.test(text)) score += 16;
  if (/(余韻|静寂|夜空|月|星|夢みたい|透明|美しい)/.test(text)) score -= 18;
  if (/(だけ|かも|まだ|なのに|はずなのに)$/.test(text.trim())) score += 6;
  return Math.max(0, Math.min(100, score));
}

function scorePost(text, insight, context) {
  const femaleVoice = /(私|正直|なんか|たぶん|まだ|きっと)/.test(text) ? 95 : 76;
  const romanceTension = /(会いたい|返事|通知|既読|未読|嘘|もういい|嫉妬|知らない名前|消せない|優しく|勘違い)/.test(text) ? 94 : 78;
  const unresolved = /(\.\.\.|かも|だけ|まだ|なのに|きっと|はずなのに)$/.test(text.trim()) ? 96 : 72;
  const maleAttention = /(会いたいって|通知|返事いらない|優しくされたら|もういい|聞けない|しないで|好きじゃないなら)/.test(text) ? 96 : 80;
  const dmTrigger = /(嘘かも|ほんとは|聞けない|しないで|まだ|なのに|かも)/.test(text) ? 94 : 78;
  const attentionSeeking = /(通知|言われたい|見てる|気づいて|もういい|返事いらない)/.test(text) ? 94 : 78;
  const tease = /(だけ|かも|なのに|しないで|嘘かも|きっと)/.test(text) ? 92 : 76;
  const humanity = scoreHumanity(text);
  const save = Math.round((femaleVoice + romanceTension + unresolved) / 3);
  const comment = Math.round((maleAttention + dmTrigger + unresolved + humanity) / 4);
  const quote = Math.round((femaleVoice + romanceTension + tease + humanity) / 4);
  const researchGrounding = scoreResearchGrounding(text, insight, context);
  const total = Math.round((femaleVoice + romanceTension + save + comment + quote + maleAttention + dmTrigger + attentionSeeking + tease + humanity * 2 + researchGrounding * 3) / 14);
  return {
    female_voice_score: femaleVoice,
    romance_tension_score: romanceTension,
    humanity_score: humanity,
    save_score: save,
    comment_score: comment,
    quote_score: quote,
    male_attention_score: maleAttention,
    dm_trigger_score: dmTrigger,
    attention_seeking_score: attentionSeeking,
    tease_score: tease,
    research_grounding_score: researchGrounding,
    research_grounding_reason: researchGroundingReason(text, insight, context),
    total
  };
}

function fallbackTopicWord(context) {
  const tokens = extractTopicTokens(context);
  if (tokens.includes("返信")) return "返信";
  if (tokens.includes("返事")) return "返事";
  if (tokens.includes("LINE")) return "LINE";
  if (tokens.includes("元カレ")) return "元カレ";
  if (tokens.includes("嫉妬")) return "嫉妬";
  if (tokens.includes("匂わせ")) return "匂わせ";
  return "好き";
}

function draftSeedForInsight(insight, index, context) {
  const topicWord = fallbackTopicWord(context);
  if (/返信速度と好意/.test(insight)) {
    return [
      "返信遅いの\n脈なしじゃなくて\n\n考えすぎて\n止まってるだけ\n\nかも",
      "返信の速さで\n好きかどうか\n\n決められるの\n普通に\nこわい\n\nかも"
    ][index % 2];
  }
  if (/考えすぎて返信/.test(insight)) {
    return [
      "好きな人ほど\n返事遅くなるの\n\n正直\nめんどくさい\n\nなのに",
      "返したいのに\n言葉選びすぎて\n\nまた\n遅くなる\n\nだけ"
    ][index % 2];
  }
  if (/脈なし/.test(insight)) {
    return [
      "返信遅いだけで\n脈なしって\n思われるの\n\n普通に\nくやしい\n\nかも",
      "脈なしに\n見える時ほど\n\nほんとは\n気にしてる\n\nかも"
    ][index % 2];
  }
  if (/終わった恋|未練/.test(insight)) {
    return "元カレのこと\nもういいって\n言ったけど\n\nまだ\n少しだけ\n嘘かも";
  }
  if (/嫉妬|気にしてないふり/.test(insight)) {
    return "嫉妬してない\nふりしたの\n\n普通に\n嘘だった\n\nかも";
  }
  if (/都合|離れにくい|沼|依存/.test(insight)) {
    return "都合いいって\n分かってるのに\n\n優しくされると\nまた戻る\n\nなのに";
  }
  if (/夜|本音/.test(insight)) {
    return "夜だけ\n本音が勝つの\n\nほんと\nやめたい\n\nまだ";
  }
  return `正直\n${topicWord}のこと\n\n平気なふり\nしてるだけ\n\nかも`;
}

function buildDrafts(context, researchId) {
  const researchInsights = extractResearchInsights(context);
  return expandInsightsForDrafts(researchInsights, 10).map((insight, index) => {
    const seed = draftSeedForInsight(insight, index, context);
    const text = formatPost(seed);
    const validation = validatePost(text, insight, context);
    const scoreDetail = scorePost(text, insight, context);
    return {
      id: crypto.randomUUID(),
      title: "恋愛マイクロ投稿",
      hook: "female-romance-fragment",
      body: text,
      text,
      cta: "",
      score: scoreDetail.total,
      scoreTotal: scoreDetail.total,
      emotionalTrigger: ["未練", "匂わせ", "嫉妬", "距離感", "沼"][index % 5],
      category: "female_romance",
      hookType: ["未練", "匂わせ", "嫉妬", "距離感", "沼"][index % 5],
      status: "scored",
      sourceTrace: [researchId].filter(Boolean),
      research_insight: insight,
      research_insights: researchInsights,
      research_grounding_score: scoreDetail.research_grounding_score,
      generated_by: ACTIVE_WRITER_NAME,
      writer_name: ACTIVE_WRITER_NAME,
      writer_version: ACTIVE_WRITER_VERSION,
      reject_reason: validation.ok ? null : validation.reasons,
      scoreDetail: {
        title: "恋愛マイクロ投稿",
        hook: "female-romance-fragment",
        cta: "",
        emotionalTrigger: ["未練", "匂わせ", "嫉妬", "距離感", "沼"][index % 5],
        trendCategory: "female_romance",
        emotionalAngle: "未完了の恋愛感情",
        writer_name: ACTIVE_WRITER_NAME,
        writer_version: ACTIVE_WRITER_VERSION,
        generated_by: ACTIVE_WRITER_NAME,
        research_insight: insight,
        research_insights: researchInsights,
        ...scoreDetail
      }
    };
  });
}

function clientDraft(row) {
  const detail = row.score_detail || row.scoreDetail || {};
  return {
    id: row.id,
    title: detail.title || row.title || "恋愛マイクロ投稿",
    hook: detail.hook || row.hook || "female-romance-fragment",
    body: row.text || row.body,
    cta: detail.cta || "",
    score: row.score_total || row.scoreTotal || row.score || detail.total || 0,
    emotionalTrigger: detail.emotionalTrigger || row.hook_type || row.emotionalTrigger || "未練",
    text: row.text || row.body,
    status: row.status || "scored",
    category: row.category || "female_romance",
    hookType: row.hook_type || row.hookType || row.emotionalTrigger || "未練",
    scoreTotal: row.score_total || row.scoreTotal || row.score || detail.total || 0,
    scoreDetail: detail,
    sourceTrace: row.source_trace || row.sourceTrace || [],
    researchInsight: detail.research_insight || row.research_insight,
    generated_by: detail.generated_by || row.generated_by || ACTIVE_WRITER_NAME,
    writer_name: detail.writer_name || row.writer_name || ACTIVE_WRITER_NAME,
    writer_version: detail.writer_version || row.writer_version || ACTIVE_WRITER_VERSION
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
    category: "female_romance",
    hook_type: draft.emotionalTrigger,
    persona: "匂わせ女子",
    score_total: draft.scoreTotal,
    score_detail: draft.scoreDetail,
    source_trace: [researchId]
  }));
  const inserted = await supabaseRequest(env, "post_drafts", {
    method: "POST",
    body: JSON.stringify(rows)
  });
  return (Array.isArray(inserted) ? inserted : []).map(clientDraft);
}

export async function handleFemaleRomanceDraftGenerate(request, env) {
  const body = await request.json().catch(() => ({}));
  const researchId = String(body.researchId || body.briefId || "").trim();
  if (!researchId) {
    return json({ success: false, error: { code: "missing_research_id", message: "researchId is required." } }, env, request, 400);
  }

  let brief = null;
  try {
    brief = await loadResearchContext(env, researchId);
  } catch (error) {
    console.error("female romance writer research load fallback", error);
  }

  const researchInsights = extractResearchInsights(brief);
  const candidates = buildDrafts(brief, researchId);
  const diagnostics = candidates.map((draft, index) => ({
    draft_id: `candidate-${index + 1}`,
    writer_used: ACTIVE_WRITER_NAME,
    writer_version: ACTIVE_WRITER_VERSION,
    generated_by: ACTIVE_WRITER_NAME,
    research_insight: draft.research_insight,
    research_grounding_score: draft.research_grounding_score,
    reject_reason: draft.reject_reason
  }));
  const accepted = candidates.filter((draft) => !draft.reject_reason);
  const drafts = await persistDrafts(env, request, researchId, accepted).catch((error) => {
    console.error("female romance draft persistence fallback", error);
    return accepted.map(clientDraft);
  });

  return json({
    success: true,
    writer_used: ACTIVE_WRITER_NAME,
    writer_name: ACTIVE_WRITER_NAME,
    writer_version: ACTIVE_WRITER_VERSION,
    generated_count: candidates.length,
    saved_count: drafts.length,
    rejected_count: diagnostics.filter((item) => item.reject_reason).length,
    research_insights: researchInsights,
    diagnostics,
    drafts
  }, env, request);
}
