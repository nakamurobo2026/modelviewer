const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 15000;
const MAX_COUNT = 50;

type PostIdea = {
  text: string;
  category: string;
  score: number;
  hook: string;
};

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function clampCount(value: unknown) {
  const count = Number(value) || MAX_COUNT;
  return Math.max(1, Math.min(MAX_COUNT, count));
}

function buildPrompt({ theme, category, tune, count }: { theme: string; category: string; tune?: string; count: number }) {
  const direction = tune || category;
  return [
    "Threads向けの短い投稿案をJSON配列だけで生成してください。",
    `テーマ: ${theme}`,
    `方向性: ${direction}`,
    `件数: ${count}`,
    "条件: AIっぽくしない。20〜90文字中心。短文中心。コメントしたくなる余白。静か、深夜、少し違和感、なんか分かる。",
    "含める空気: 共感、違和感、懐かしさ、深夜テンション、地方感、少し静か。",
    "出力は必ずJSON配列のみ。説明文やMarkdownは禁止。",
    "形式: [{\"text\":\"...\",\"category\":\"...\",\"score\":87,\"hook\":\"共感\"}]"
  ].join("\n");
}

function extractText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      const text = (part as { text?: unknown; output_text?: unknown }).text ?? (part as { output_text?: unknown }).output_text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n");
}

function parseIdeas(text: string): PostIdea[] {
  const trimmed = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
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

function normalizeIdea(idea: Partial<PostIdea>, fallbackCategory: string, index: number): PostIdea {
  const text = String(idea.text || "").trim().slice(0, 120);
  const category = String(idea.category || fallbackCategory || "違和感");
  const hook = String(idea.hook || "余白");
  const rawScore = Number(idea.score);
  const score = Number.isFinite(rawScore) ? Math.max(1, Math.min(100, Math.round(rawScore))) : 70 + (index % 19);
  return { text, category, score, hook };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) return json({ ok: false, error: "OPENAI_API_KEY is not configured." }, 500);

  let payload: { theme?: string; category?: string; tune?: string; count?: number };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Request body must be JSON." }, 400);
  }

  const theme = String(payload.theme || "").trim();
  const category = String(payload.category || "違和感").trim();
  const tune = payload.tune ? String(payload.tune).trim() : "";
  const count = clampCount(payload.count);

  if (!theme) return json({ ok: false, error: "theme is required." }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const openaiResponse = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt({ theme, category, tune, count }),
        max_output_tokens: 2400
      })
    });

    const rawOpenAI = await openaiResponse.text();
    if (!openaiResponse.ok) {
      console.error("OpenAI API error", { status: openaiResponse.status, statusText: openaiResponse.statusText, rawOpenAI });
      return json({ ok: false, error: "OpenAI API request failed.", status: openaiResponse.status, detail: rawOpenAI.slice(0, 1200) }, 502);
    }

    let openaiData: Record<string, unknown>;
    try {
      openaiData = JSON.parse(rawOpenAI);
    } catch {
      return json({ ok: false, error: "OpenAI response was not JSON.", detail: rawOpenAI.slice(0, 1200) }, 502);
    }

    const ideas = parseIdeas(extractText(openaiData))
      .slice(0, count)
      .map((idea, index) => normalizeIdea(idea, category, index))
      .filter((idea) => idea.text);

    if (!ideas.length) {
      return json({ ok: false, error: "OpenAI response did not include usable post ideas.", detail: rawOpenAI.slice(0, 1200) }, 502);
    }

    return json({ ok: true, model: MODEL, count: ideas.length, elapsedMs: Date.now() - startedAt, ideas });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    console.error("generate-posts edge function failed", error);
    return json({
      ok: false,
      error: isAbort ? "OpenAI request timed out after 15 seconds." : "Edge Function failed.",
      detail: error instanceof Error ? error.message : String(error)
    }, isAbort ? 504 : 500);
  } finally {
    clearTimeout(timeout);
  }
});
