const ACTIVE_WRITER_NAME = "female-romance-writer";
const ACTIVE_WRITER_VERSION = "v1.0.0";
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
  const rows = await supabaseRequest(env, `research_briefs?id=eq.${encodeURIComponent(researchId)}&select=*`, { method: "GET" });
  return Array.isArray(rows) ? rows[0] : null;
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

function validatePost(text) {
  const reasons = [];
  for (const term of FORBIDDEN_TERMS) {
    if (text.includes(term)) reasons.push(`forbidden_term:${term}`);
  }
  if (!/(私|正直|なんか|たぶん|まだ|きっと|会いたい|返事|通知|既読|未読|嘘|もういい|知らない名前|消せない|優しく|勘違い)/.test(text)) {
    reasons.push("missing_first_person_or_implied_female_voice");
  }
  if (/(です|ます|について|重要|理由|方法|すべき|しましょう|アドバイス|分析|調査|説明)/.test(text)) reasons.push("explanatory_or_advice_tone");
  if (text.split("\n").some((line) => line.length > 14)) reasons.push("line_too_long");
  if (!/(\.\.\.|かも|だけ|まだ|なのに|きっと|はずなのに)$/.test(text.trim())) reasons.push("resolved_ending");
  return { ok: reasons.length === 0, reasons };
}

function scorePost(text) {
  const femaleVoice = /(私|正直|なんか|たぶん|まだ|きっと)/.test(text) ? 95 : 76;
  const romanceTension = /(会いたい|返事|通知|既読|未読|嘘|もういい|嫉妬|知らない名前|消せない|優しく|勘違い)/.test(text) ? 94 : 78;
  const unresolved = /(\.\.\.|かも|だけ|まだ|なのに|きっと|はずなのに)$/.test(text.trim()) ? 96 : 72;
  const maleAttention = /(会いたいって|通知|返事いらない|優しくされたら|もういい|聞けない|しないで|好きじゃないなら)/.test(text) ? 96 : 80;
  const dmTrigger = /(嘘かも|ほんとは|聞けない|しないで|まだ|なのに|かも)/.test(text) ? 94 : 78;
  const attentionSeeking = /(通知|言われたい|見てる|気づいて|もういい|返事いらない)/.test(text) ? 94 : 78;
  const tease = /(だけ|かも|なのに|しないで|嘘かも|きっと)/.test(text) ? 92 : 76;
  const save = Math.round((femaleVoice + romanceTension + unresolved) / 3);
  const comment = Math.round((maleAttention + dmTrigger + unresolved) / 3);
  const quote = Math.round((femaleVoice + romanceTension + tease) / 3);
  const total = Math.round((femaleVoice + romanceTension + save + comment + quote + maleAttention + dmTrigger + attentionSeeking + tease) / 9);
  return {
    female_voice_score: femaleVoice,
    romance_tension_score: romanceTension,
    save_score: save,
    comment_score: comment,
    quote_score: quote,
    male_attention_score: maleAttention,
    dm_trigger_score: dmTrigger,
    attention_seeking_score: attentionSeeking,
    tease_score: tease,
    total
  };
}

function seedsFor(brief) {
  const material = `${brief?.topic || ""} ${brief?.summary || ""}`;
  const seeds = [
    "正直\n\n会いたいより\n\n会いたいって\n言われたい\n\nだけ",
    "寝たって\n言ったあとも\n\n通知だけ\n見てる\n\nまだ",
    "返事いらない\nって言ったの\n\n嘘かも",
    "もういい\nって言った時ほど\n\nほんとは\nよくない\n\nなのに",
    "優しくされたら\nすぐ勘違いする\n\nだから\nしないで\n\nかも",
    "私だけ\n終わった恋を\n\n美化してる\nわけじゃない\n\nはずなのに",
    "なんでもない\nふりだけ\n\n上手くなる\n\nまだ",
    "知らない名前に\n反応した\n\n聞けないのに",
    "既読より\n\n未読の方が\n期待できる日がある\n\nかも",
    "好きじゃないなら\n\nそんな言い方\nしないで\n\nきっと"
  ];
  if (/返信|既読|未読|LINE|連絡/.test(material)) seeds.unshift("返信遅いの\n苦手なのに\n\n好きになるのは\nだいたい\n返信遅い\n\nまだ");
  if (/元カレ|元彼|元カノ|昔の恋|未練/.test(material)) seeds.unshift("消したはずの名前\n\nまだ\n予測に出てくる\n\nだけ");
  if (/嫉妬|匂わせ|名前|他の子|浮気/.test(material)) seeds.unshift("知らない名前に\n\n反応した私が\nいちばん嫌\n\nなのに");
  return seeds.slice(0, 10);
}

function buildDrafts(brief, researchId) {
  return seedsFor(brief).map((seed, index) => {
    const text = formatPost(seed);
    const validation = validatePost(text);
    const scoreDetail = scorePost(text);
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

  const candidates = buildDrafts(brief, researchId);
  const diagnostics = candidates.map((draft, index) => ({
    draft_id: `candidate-${index + 1}`,
    writer_used: ACTIVE_WRITER_NAME,
    writer_version: ACTIVE_WRITER_VERSION,
    generated_by: ACTIVE_WRITER_NAME,
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
    diagnostics,
    drafts
  }, env, request);
}
