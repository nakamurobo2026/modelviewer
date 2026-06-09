const DEFAULT_ORIGIN = "https://nakamurobo2026.github.io";
const IDEA_COUNT = 50;

function corsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": origin && origin.startsWith(allowed) ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(env, request.headers.get("Origin")) });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pick(list, index) {
  return list[index % list.length];
}

function localIdeas(theme, category, count = IDEA_COUNT) {
  const base = String(theme || "地方スーパー").replace(/Research Summary:[\s\S]*/g, "").replace(/\s+/g, " ").trim().slice(0, 48) || "地方スーパー";
  const places = ["スーパー", "ホームセンター", "ドラッグストア", "地方駅", "商店街", "コンビニ", "市役所"];
  const times = ["17時過ぎ", "閉店前", "雨の日", "夕方", "夜", "平日の昼過ぎ"];
  const sounds = ["レジ音", "BGM", "台車の音", "自動ドア", "冷蔵ケースの音", "店内放送"];
  const objects = ["棚", "駐車場", "惣菜売り場", "看板", "入口", "袋詰め台"];
  return Array.from({ length: count }, (_, index) => {
    const place = base.length > 2 && base.length < 30 ? base : pick(places, index);
    return {
      text: `${pick(times, index)}の${place}、${pick(sounds, index)}だけ残って${pick(objects, index)}が少し広く見える`.slice(0, 90),
      category,
      score: clamp(68 + (index * 7) % 25, 60, 94),
      hook: pick(["共感", "違和感", "懐かしさ", "余白", "不穏"], index)
    };
  });
}

function localResearch(sources, persona = "違和感ノート") {
  const safeSources = sources.length ? sources : ["地方スーパーの閉店前、レジ音だけ残る"];
  const text = safeSources.join("\n");
  const first = safeSources[0] || "";
  const time = first.match(/(閉店前|17時過ぎ|夕方|深夜|雨の日|夜)/)?.[0] || "17時過ぎ";
  const place = first.match(/(スーパー|ホームセンター|コンビニ|地方駅|商店街|ドラッグストア|市役所|駐車場)/)?.[0] || "身近な場所";
  const phrases = safeSources.map((source) => source.replace(/https?:\/\/\S+/g, "").replace(/[「」『』"']/g, "").trim().slice(0, 34)).filter(Boolean).slice(0, 8);
  const buzzElements = [
    text.includes("レジ") ? "レジ音だけ残る" : "音が少なくなる瞬間",
    text.includes("駐車場") ? "駐車場が急に広く見える" : "人が少ない場所",
    text.includes("蛍光灯") ? "古い蛍光灯の白さ" : "棚の色が少し暗く見える",
    "普通なのに少しだけずれる"
  ];
  return {
    success: true,
    source: "worker-fallback",
    summary: `${time}の${place}を起点に、具体描写と少しの違和感で投稿化する。`,
    buzzElements,
    hooks: [`${time}の${place}`, `${place}の音`, `${place}の人の少なさ`],
    phrases,
    patterns: ["共感型", "違和感型", "余白型"],
    recommendedPostAngles: [
      `${persona}として、音や光から入る`,
      "元投稿の言い回しは避け、場所と時間を変えて観察にする",
      "コメントしたくなる余白を残して断定しすぎない"
    ]
  };
}

function extractJson(text) {
  const source = String(text || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || source.match(/\[[\s\S]*\]|\{[\s\S]*\}/)?.[0] || source;
  return JSON.parse(candidate);
}

async function callOpenAI(env, prompt, schemaHint) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const model = env.OPENAI_MODEL || "gpt-5-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: `${prompt}\n\nJSONだけを返してください。${schemaHint}`, max_output_tokens: 2400 })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${raw.slice(0, 500)}`);
    const data = JSON.parse(raw);
    const output = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") || "";
    return { parsed: extractJson(output), model };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleGenerate(request, env) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const theme = String(body.theme || "").slice(0, 3000);
  const category = String(body.category || "違和感");
  const prompt = [
    "Threads向け投稿案を50件作る。AIっぽい抽象語は禁止。20〜90文字中心。",
    "場所、時間、音、光、人の少なさ、店舗の挙動を使う。元投稿の丸写しは禁止。",
    `カテゴリ:${category}`,
    `素材:${theme}`
  ].join("\n");
  try {
    const { parsed, model } = await callOpenAI(env, prompt, '[{"text":"...","category":"...","score":87,"hook":"共感"}]');
    const ideas = Array.isArray(parsed) ? parsed : parsed.ideas;
    if (!Array.isArray(ideas) || !ideas.length) throw new Error("OpenAI JSON did not include ideas.");
    return json({ success: true, source: "openai", model, elapsedMs: Date.now() - startedAt, ideas: ideas.slice(0, IDEA_COUNT) }, env, request);
  } catch (error) {
    console.error("generate fallback", error);
    return json({ success: true, source: "worker-fallback", model: env.OPENAI_MODEL || "gpt-5-mini", error: error.message, elapsedMs: Date.now() - startedAt, ideas: localIdeas(theme, category) }, env, request);
  }
}

async function handleResearch(request, env) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const sources = Array.isArray(body.sources) ? body.sources.map(String).slice(0, 24) : [];
  const persona = String(body.persona || "違和感ノート");
  const prompt = [
    "入力されたURLメモ、コピペ投稿、メモ、キーワードからThreads運用向けのバズ要素を抽出する。",
    "元投稿の丸写しは禁止。言い回しは変換して使う。",
    "返すキー: summary, buzzElements, hooks, phrases, patterns, recommendedPostAngles",
    `人格:${persona}`,
    `sources:${JSON.stringify(sources)}`
  ].join("\n");
  try {
    const { parsed, model } = await callOpenAI(env, prompt, '{"summary":"...","buzzElements":[],"hooks":[],"phrases":[],"patterns":[],"recommendedPostAngles":[]}');
    return json({ ...localResearch(sources, persona), ...parsed, success: true, source: "openai", model, elapsedMs: Date.now() - startedAt }, env, request);
  } catch (error) {
    console.error("research fallback", error);
    return json({ ...localResearch(sources, persona), error: error.message, elapsedMs: Date.now() - startedAt }, env, request);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env, request.headers.get("Origin")) });
    const url = new URL(request.url);
    if (request.method !== "POST") return json({ success: false, error: "POST only" }, env, request, 405);
    if (url.pathname === "/generate") return handleGenerate(request, env);
    if (url.pathname === "/research") return handleResearch(request, env);
    return json({ success: false, error: "Not found" }, env, request, 404);
  }
};
