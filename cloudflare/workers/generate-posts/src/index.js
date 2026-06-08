const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5-mini";
const TIMEOUT_MS = 15000;
const MAX_COUNT = 50;
const AI_SEED_COUNT = 12;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(body, status = 200, env = {}) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(env) });
}

function ideaSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            category: { type: "string" },
            score: { type: "integer", minimum: 1, maximum: 100 },
            hook: { type: "string" }
          },
          required: ["text", "category", "score", "hook"]
        }
      }
    },
    required: ["ideas"]
  };
}

function buildPrompt({ theme, category, mode }) {
  const count = mode === "one" ? 1 : AI_SEED_COUNT;
  return [
    `テーマ: ${theme}`,
    `カテゴリ: ${category}`,
    `件数: ${count}`,
    "Threads向けの短い投稿案を作ってください。",
    "AIっぽくしない。20〜90文字中心。短文中心。コメントしたくなる余白を残す。",
    "静か、深夜、少し違和感、共感、懐かしさ、地方感、なんか分かる空気にする。",
    "説明しすぎない。ハッシュタグを乱用しない。過剰なポエムにしない。"
  ].join("\n");
}

function collectStrings(value, bucket = []) {
  if (typeof value === "string") bucket.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, bucket));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, bucket));
  return bucket;
}

function isIdeaLike(value) {
  return value && typeof value === "object" && typeof value.text === "string";
}

function findIdeaArray(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    if (value.some(isIdeaLike)) return value;
    for (const item of value) {
      const found = findIdeaArray(item);
      if (found.length) return found;
    }
    return [];
  }
  if (Array.isArray(value.ideas)) return value.ideas;
  if (Array.isArray(value.posts)) return value.posts;
  if (Array.isArray(value.data)) return value.data;
  for (const item of Object.values(value)) {
    const found = findIdeaArray(item);
    if (found.length) return found;
  }
  return [];
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of Array.isArray(data.output) ? data.output : []) {
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (typeof part.text === "string") chunks.push(part.text);
      if (typeof part.output_text === "string") chunks.push(part.output_text);
      if (typeof part.json === "object") chunks.push(JSON.stringify(part.json));
    }
  }
  return chunks.join("\n");
}

function parseIdeas(textOrData) {
  const direct = findIdeaArray(textOrData);
  if (direct.length) return direct;

  const trimmed = String(textOrData || "").trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const candidates = [trimmed, ...collectStrings(textOrData)];
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const found = findIdeaArray(JSON.parse(candidate));
      if (found.length) return found;
    } catch {
      // Try next candidate.
    }
  }
  return [];
}

function normalizeIdea(idea, fallbackCategory, index) {
  const text = String(idea?.text || "").trim().slice(0, 120);
  const category = String(idea?.category || fallbackCategory || "違和感");
  const hook = String(idea?.hook || idea?.hookType || "余白");
  const rawScore = Number(idea?.score);
  const score = Number.isFinite(rawScore) ? Math.max(1, Math.min(100, Math.round(rawScore))) : 72 + (index % 18);
  return { text, category, score, hook };
}

function compactTheme(theme) {
  const clean = String(theme || "").trim().replace(/\s+/g, " ");
  return clean.length > 26 ? `${clean.slice(0, 26)}…` : clean;
}

function makeLocalVariant(seed, theme, category, index) {
  const baseText = String(seed?.text || "").replace(/[。\s]+$/, "");
  const shortTheme = compactTheme(theme);
  const tails = [
    "これ、分かる人だけ分かればいい。",
    "言い切れないけど、残る。",
    "たぶん名前がないだけ。",
    "夜だと少し意味が変わる。",
    "なんか静かに刺さる。",
    "説明すると薄くなるやつ。",
    "見た瞬間だけ黙る。",
    "少しだけ昔の匂いがする。",
    "気にしないふりをしてる。",
    "この余白、ちょっと怖い。",
    "誰かの記憶にもありそう。",
    "普通のふりがうまい。",
    "少しだけ置いていかれる。",
    "分かると言うには静かすぎる。",
    "名前をつける前の感じ。"
  ];
  const leads = [shortTheme, `${shortTheme}の話`, `${shortTheme}って`, `${shortTheme}、`, "これ"];
  const text = index % 3 === 0
    ? `${leads[index % leads.length]}、${tails[index % tails.length]}`
    : `${baseText}。${tails[index % tails.length]}`;

  return normalizeIdea({
    text,
    category: seed?.category || category,
    score: Number(seed?.score || 74) + (index % 9),
    hook: seed?.hook || seed?.hookType || "余白"
  }, category, index);
}

function fallbackSeeds(theme, category) {
  const shortTheme = compactTheme(theme);
  return [
    { text: `${shortTheme}、なんか分かる人だけ分かればいい。`, category, score: 82, hook: "共感" },
    { text: `${shortTheme}って、普通なのに少しだけ変。`, category, score: 85, hook: "違和感" },
    { text: `${shortTheme}を見ると、昔の夜を少し思い出す。`, category, score: 79, hook: "懐かしさ" },
    { text: `${shortTheme}、説明すると急に薄くなる。`, category, score: 84, hook: "余白" },
    { text: `${shortTheme}の話、昼より深夜に刺さる。`, category, score: 81, hook: "深夜" },
    { text: `${shortTheme}、地方の夕方みたいな静けさがある。`, category, score: 78, hook: "地方感" },
    { text: `${shortTheme}、怖くない顔をした怖さがある。`, category, score: 83, hook: "ちょい怖" },
    { text: `${shortTheme}、気にしないふりをしてる人多そう。`, category, score: 80, hook: "共感" },
    { text: `${shortTheme}、まだ名前がない違和感かも。`, category, score: 86, hook: "違和感" },
    { text: `${shortTheme}、見た瞬間だけ少し黙る。`, category, score: 77, hook: "余白" }
  ];
}

function expandIdeas(seeds, theme, category, mode) {
  const sourceSeeds = seeds.length ? seeds : fallbackSeeds(theme, category);
  const normalized = sourceSeeds.map((idea, index) => normalizeIdea(idea, category, index)).filter((idea) => idea.text);
  if (mode === "one") return normalized.slice(0, 1);

  const ideas = [...normalized];
  let index = 0;
  while (ideas.length < MAX_COUNT && normalized.length) {
    const seed = normalized[index % normalized.length];
    ideas.push(makeLocalVariant(seed, theme, category, ideas.length + index));
    index += 1;
  }
  return ideas.slice(0, MAX_COUNT);
}

async function callResponsesApi({ env, theme, category, mode, signal }) {
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildPrompt({ theme, category, mode }),
      max_output_tokens: mode === "one" ? 350 : 900,
      text: {
        format: {
          type: "json_schema",
          name: "threads_post_ideas",
          strict: true,
          schema: ideaSchema()
        }
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Responses API failed: ${response.status} ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  return parseIdeas(data).length ? parseIdeas(data) : parseIdeas(extractText(data));
}

async function callChatCompletions({ env, theme, category, mode, signal }) {
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "あなたはThreads向けの短文投稿案をJSONで返す編集者です。" },
        { role: "user", content: buildPrompt({ theme, category, mode }) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "threads_post_ideas",
          strict: true,
          schema: ideaSchema()
        }
      },
      max_completion_tokens: mode === "one" ? 350 : 900
    })
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Chat Completions failed: ${response.status} ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content || "";
  return parseIdeas(content || data);
}

async function callOpenAI(args) {
  const errors = [];
  try {
    const ideas = await callResponsesApi(args);
    if (ideas.length) return ideas;
    errors.push("Responses API returned no usable ideas.");
  } catch (error) {
    errors.push(error && error.message ? error.message : String(error));
  }

  try {
    const ideas = await callChatCompletions(args);
    if (ideas.length) return ideas;
    errors.push("Chat Completions returned no usable ideas.");
  } catch (error) {
    errors.push(error && error.message ? error.message : String(error));
  }

  throw new Error(errors.join(" | "));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(env) });
    if (url.pathname !== "/generate") return json({ success: false, error: "Not found. Use POST /generate." }, 404, env);
    if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405, env);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ success: false, error: "Request body must be JSON." }, 400, env);
    }

    const theme = String(payload.theme || "").trim();
    const category = String(payload.category || "違和感").trim();
    const mode = payload.mode === "one" ? "one" : "list";
    if (!theme) return json({ success: false, error: "theme is required." }, 400, env);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    let seedIdeas = [];
    let source = "openai";
    let errorDetail = "";

    try {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
      seedIdeas = await callOpenAI({ env, theme, category, mode, signal: controller.signal });
      if (!seedIdeas.length) throw new Error("OpenAI response did not include usable post ideas.");
    } catch (error) {
      source = "worker-fallback";
      errorDetail = error && error.message ? error.message : String(error);
      console.error("OpenAI generation failed. Returning Worker fallback ideas.", error);
    } finally {
      clearTimeout(timeout);
    }

    const ideas = expandIdeas(seedIdeas, theme, category, mode);
    return json({
      success: true,
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      source,
      count: ideas.length,
      elapsedMs: Date.now() - startedAt,
      error: errorDetail || undefined,
      ideas
    }, 200, env);
  }
};
