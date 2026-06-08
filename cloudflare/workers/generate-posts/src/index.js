const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const TIMEOUT_MS = 15000;
const MAX_COUNT = 50;
const AI_SEED_COUNT = 16;

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

function buildPrompt({ theme, category, mode }) {
  const count = mode === "one" ? 1 : AI_SEED_COUNT;
  return [
    "Threads向けの短い投稿案をJSON配列だけで生成してください。",
    `テーマ: ${theme}`,
    `カテゴリ: ${category}`,
    `件数: ${count}`,
    "条件: AIっぽくしない。20〜90文字中心。短文中心。コメントしたくなる余白を残す。",
    "空気感: 静か、深夜、少し違和感、共感、懐かしさ、地方感、なんか分かる。",
    "禁止: 説明文、Markdown、ハッシュタグの乱用、過剰なポエム、長い結論。",
    "出力は必ずJSON配列のみ。",
    "形式: [{\"text\":\"...\",\"category\":\"...\",\"score\":87,\"hook\":\"共感\"}]"
  ].join("\n");
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of Array.isArray(data.output) ? data.output : []) {
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (typeof part.text === "string") chunks.push(part.text);
      if (typeof part.output_text === "string") chunks.push(part.output_text);
    }
  }
  return chunks.join("\n");
}

function parseIdeas(text) {
  const trimmed = String(text || "").trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const candidates = [trimmed];
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.ideas)) return parsed.ideas;
      if (Array.isArray(parsed.posts)) return parsed.posts;
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
    "この余白、ちょっと怖い。"
  ];
  const leads = [
    shortTheme,
    `${shortTheme}の話`,
    `${shortTheme}って`,
    `${shortTheme}、`,
    "これ"
  ];

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

function expandIdeas(seeds, theme, category, mode) {
  const normalized = seeds.map((idea, index) => normalizeIdea(idea, category, index)).filter((idea) => idea.text);
  if (mode === "one") return normalized.slice(0, 1);

  const ideas = [...normalized];
  let index = 0;
  while (ideas.length < MAX_COUNT && normalized.length) {
    const seed = normalized[index % normalized.length];
    const variant = makeLocalVariant(seed, theme, category, ideas.length + index);
    const isDuplicate = ideas.some((idea) => idea.text === variant.text);
    if (!isDuplicate) ideas.push(variant);
    index += 1;
    if (index > 300) break;
  }
  return ideas.slice(0, MAX_COUNT);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(env) });
    if (url.pathname !== "/generate") return json({ success: false, error: "Not found. Use POST /generate." }, 404, env);
    if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405, env);

    if (!env.OPENAI_API_KEY) {
      return json({ success: false, error: "OPENAI_API_KEY is not configured." }, 500, env);
    }

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

    const model = env.OPENAI_MODEL || DEFAULT_MODEL;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const openaiResponse = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: buildPrompt({ theme, category, mode }),
          max_output_tokens: mode === "one" ? 450 : 1200
        })
      });

      const rawOpenAI = await openaiResponse.text();
      if (!openaiResponse.ok) {
        console.error("OpenAI API error", { status: openaiResponse.status, rawOpenAI });
        return json({ success: false, error: "OpenAI API request failed.", status: openaiResponse.status, detail: rawOpenAI.slice(0, 1200) }, 502, env);
      }

      let openaiData;
      try {
        openaiData = JSON.parse(rawOpenAI);
      } catch {
        return json({ success: false, error: "OpenAI response was not JSON.", detail: rawOpenAI.slice(0, 1200) }, 502, env);
      }

      const seedIdeas = parseIdeas(extractText(openaiData));
      const ideas = expandIdeas(seedIdeas, theme, category, mode);

      if (!ideas.length) {
        return json({ success: false, error: "OpenAI response did not include usable post ideas.", detail: rawOpenAI.slice(0, 1200) }, 502, env);
      }

      return json({ success: true, model, count: ideas.length, elapsedMs: Date.now() - startedAt, ideas }, 200, env);
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      console.error("iwakan-lab worker failed", error);
      return json({
        success: false,
        error: isAbort ? "OpenAI request timed out after 15 seconds." : "Cloudflare Worker failed.",
        detail: error instanceof Error ? error.message : String(error)
      }, isAbort ? 504 : 500, env);
    } finally {
      clearTimeout(timeout);
    }
  }
};
