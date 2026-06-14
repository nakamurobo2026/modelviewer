const DEFAULT_ORIGINS = ["https://nakamurobo2026.github.io", "https://viral-os-phi.vercel.app"];
const MODEL = "gpt-5-mini";

function corsHeaders(env, origin) {
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
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(env, request.headers.get("Origin")) });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sourceTypeFrom(value) {
  const text = String(value || "").toLowerCase();
  let host = "";
  try {
    host = new URL(text.match(/https?:\/\/\S+/)?.[0] || text).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  if (host.includes("threads.net")) return "threads";
  if (host.includes("x.com") || host.includes("twitter.com")) return "x";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("trends.google.")) return "google_trends";
  if (host.includes("search.yahoo.co.jp") || text.includes("リアルタイム")) return "yahoo_realtime";
  if (host.includes("reddit.com")) return "reddit";
  if (host.includes("b.hatena.ne.jp")) return "hatebu";
  if (host.includes("note.com")) return "note";
  if (host.includes("togetter.com")) return "togetter";
  if (host.includes("wikipedia.org")) return "wikipedia";
  if (host.includes("yahoo.co.jp") || /ニュース|新聞/.test(text)) return "news";
  if (/公式|official/.test(text)) return "official";
  return host ? "blog" : "manual";
}

function priorityFor(type) {
  if (["threads", "x", "tiktok", "instagram"].includes(type)) return { priority: "S", weight: 1, reason: "実投稿や短尺SNS構文に近い" };
  if (["google_trends", "yahoo_realtime", "reddit", "hatebu", "note", "togetter"].includes(type)) return { priority: "A", weight: 0.8, reason: "話題化の兆候が見える" };
  if (["news", "blog", "official", "wikipedia"].includes(type)) return { priority: "B", weight: 0.5, reason: "背景情報として使える" };
  return { priority: "C", weight: 0.3, reason: "手動メモや保存DB由来" };
}

function reliabilityFor(text, priority) {
  const body = String(text || "");
  const specific = ["時", "レジ", "棚", "駐車場", "音", "光", "匂い", "人", "店"].filter((word) => body.includes(word)).length;
  const close = { S: 38, A: 30, B: 20, C: 12 }[priority] || 12;
  const postable = /だけ|急に|なぜ|違和感|あるある|残る|止まる/.test(body) ? 18 : 8;
  return clamp(close + specific * 5 + postable, 20, 100);
}

function sourceRecord(raw, index, prefix = "source") {
  const url = String(raw.url || raw.match?.(/https?:\/\/\S+/)?.[0] || "");
  const title = String(raw.title || raw.content || raw).replace(/\s+/g, " ").slice(0, 80);
  const content = String(raw.content || raw.snippet || raw).replace(/\s+/g, " ").slice(0, 500);
  const sourceType = sourceTypeFrom(url || `${title} ${content}`);
  const priority = priorityFor(sourceType);
  const reliability = reliabilityFor(`${title} ${content} ${url}`, priority.priority);
  return {
    id: `${prefix}-${index}`,
    sourceType,
    priority: priority.priority,
    weight: priority.weight,
    url,
    title: title || sourceType,
    content,
    reason: priority.reason,
    reliability,
    impact: Math.round(reliability * priority.weight),
    buzzElements: [
      /投稿|コメント|SNS|Threads|TikTok|X/.test(`${title} ${content}`) ? "SNS反応に近い話題" : "具体描写",
      /レジ|BGM|音/.test(content) ? "音の違和感" : "共感の余白"
    ]
  };
}

function sortSources(records) {
  const rank = { S: 4, A: 3, B: 2, C: 1 };
  return records.sort((a, b) => (rank[b.priority] - rank[a.priority]) || (b.impact - a.impact));
}

async function searchTavily(env, query) {
  const apiKey = env.TAVILY_API_KEY;
  const cleanQuery = String(query || "").replace(/\s+/g, " ").trim();
  if (!apiKey || !cleanQuery) return { source: apiKey ? "tavily-empty-query" : "tavily-key-missing", results: [] };

  const cache = caches.default;
  const cacheKey = new Request(`https://iwakan-lab.local/tavily?q=${encodeURIComponent(cleanQuery.slice(0, 400))}`);
  const cached = await cache.match(cacheKey);
  if (cached) return { ...(await cached.json()), source: "tavily-cache" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ api_key: apiKey, query: cleanQuery, search_depth: "basic", max_results: 8, include_answer: false, include_raw_content: false })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${raw.slice(0, 300)}`);
    const payload = { source: "tavily", query: cleanQuery, results: JSON.parse(raw).results || [] };
    await cache.put(cacheKey, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } }));
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function localResearch(records, persona) {
  const first = records[0]?.content || "地方スーパーの閉店前、レジ音だけ残る";
  const hooks = [
    first.match(/(閉店前|17時過ぎ|夕方|深夜|雨の日)/)?.[0] || "17時過ぎ",
    first.match(/(スーパー|ホームセンター|コンビニ|地方駅|商店街|ドラッグストア|市役所)/)?.[0] || "身近な場所"
  ];
  const text = records.map((item) => item.content).join("\n");
  return {
    success: true,
    source: "worker-tavily-local",
    summary: `${hooks.join("の")}を起点に、具体描写と少しの違和感で投稿化する。`,
    buzzElements: [
      text.includes("レジ") ? "レジ音だけ残る" : "音が少なくなる瞬間",
      text.includes("駐車場") ? "駐車場が急に広く見える" : "人が少ない場所",
      text.includes("蛍光灯") ? "古い蛍光灯の白さ" : "棚の色が暗く見える",
      "普通なのに少しだけずれる"
    ],
    hooks,
    phrases: records.map((item) => item.title).filter(Boolean).slice(0, 8),
    patterns: ["共感型", "違和感型", "余白型"],
    recommendedPostAngles: [
      `${persona}として、音や光から入る`,
      "元投稿の言い回しは避け、場所と時間を変えて観察にする",
      "コメントしたくなる余白を残して断定しすぎない"
    ]
  };
}

function clientSources(records) {
  return records.map((record) => ({
    id: record.id,
    sourceType: record.sourceType,
    priority: record.priority,
    weight: record.weight,
    url: record.url,
    title: record.title,
    summary: record.content,
    reliability: record.reliability,
    impact: record.impact,
    extractedElements: record.buzzElements || []
  }));
}

function clientViralElements(research) {
  const items = [
    ...(Array.isArray(research.buzzElements) ? research.buzzElements.map((value) => ["empathy", value]) : []),
    ...(Array.isArray(research.hooks) ? research.hooks.map((value) => ["hook", value]) : []),
    ...(Array.isArray(research.phrases) ? research.phrases.slice(0, 4).map((value) => ["phrase", value]) : []),
    ...(Array.isArray(research.recommendedPostAngles) ? research.recommendedPostAngles.map((value) => ["angle", value]) : [])
  ];
  return items
    .map(([elementType, value], index) => ({ elementType, value: String(value || "").slice(0, 120), score: clamp(82 - index * 3, 55, 90) }))
    .filter((item) => item.value);
}

function researchPayload(research, sourceRecords, startedAt, extra = {}) {
  return {
    ...research,
    ...extra,
    success: true,
    briefId: research.briefId || extra.briefId || `iwakan-${startedAt}`,
    sources: clientSources(sourceRecords),
    viralElements: clientViralElements(research),
    sourceRecords,
    elapsedMs: Date.now() - startedAt
  };
}

function localIdeas(theme, category, count = 50) {
  const rawBase = String(theme || "地方スーパー").replace(/\s+/g, " ").slice(0, 70);
  const hasTime = /(17時|閉店|夕方|夜|深夜|朝|昼|雨の日)/.test(rawBase);
  const base = rawBase.replace(/^(.{0,12}?の){1,2}/, "").trim() || "地方スーパー";
  const times = ["17時過ぎ", "閉店前", "雨の日", "夕方", "夜", "平日の昼過ぎ", "開店直後", "日曜の午後", "閉店30分前", "西日が入る時間"];
  const sounds = ["レジ音", "BGM", "台車の音", "自動ドア", "冷蔵ケースの音", "店内放送", "蛍光灯の音", "遠くのアナウンス", "カゴを戻す音", "雨の音"];
  const objects = ["棚", "駐車場", "惣菜売り場", "看板", "入口", "袋詰め台", "木材売り場", "レジ横", "通路", "サービスカウンター", "古いポスター"];
  const motions = ["少し広く見える", "急に静かになる", "時間だけ遅くなる", "人の少なさが目立つ", "色が暗く見える", "妙に遠く感じる", "普通なのに止まって見える", "片付けの気配だけ残る", "昔の店みたいに見える", "誰も急いでない", "明るいのに閉店前っぽい", "音だけ先に帰っていく", "急に生活感が出る"];
  return Array.from({ length: count }, (_, index) => ({
    text: `${hasTime ? base : `${times[index % times.length]}の${base}`}、${sounds[(index * 3) % sounds.length]}だけ残って${objects[(index * 7) % objects.length]}が${motions[(index * 9) % motions.length]}`.slice(0, 90),
    category,
    score: clamp(68 + (index * 7) % 25, 60, 94),
    hook: ["共感", "違和感", "懐かしさ", "余白", "不穏"][index % 5]
  }));
}

function normalizeIdea(idea, theme, category, index) {
  const fallback = localIdeas(theme, category, index + 1)[index];
  return {
    text: String(idea?.text || fallback.text).replace(/\s+/g, " ").slice(0, 90),
    category: String(idea?.category || category),
    score: clamp(Number(idea?.score || fallback.score), 55, 98),
    hook: String(idea?.hook || idea?.hookType || fallback.hook)
  };
}

function fillIdeas(ideas, theme, category) {
  const seen = new Set();
  const normalized = [];
  for (const idea of Array.isArray(ideas) ? ideas : []) {
    const item = normalizeIdea(idea, theme, category, normalized.length);
    const key = item.text.replace(/[、。,.]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
    if (normalized.length >= 50) break;
  }
  for (const idea of localIdeas(theme, category, 50)) {
    const key = idea.text.replace(/[、。,.]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(idea);
    if (normalized.length >= 50) break;
  }
  return normalized;
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced || raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/)?.[0] || raw);
}

async function callOpenAI(env, prompt, schemaHint, timeoutMs = 15000, maxOutputTokens = 1800) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL || MODEL, input: `${prompt}\n\nJSONだけを返してください。${schemaHint}`, max_output_tokens: maxOutputTokens })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${raw.slice(0, 400)}`);
    const data = JSON.parse(raw);
    const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") || "";
    return { model: env.OPENAI_MODEL || MODEL, parsed: extractJson(text) };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleGenerate(request, env) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const theme = String(body.theme || "").slice(0, 3000);
  const category = String(body.category || "違和感");
  const prompt = `Threads向け投稿案の種を12件だけ作る。AIっぽい抽象語は禁止。20〜90文字中心。場所、時間、音、光、人の少なさ、店舗の挙動を使う。似た文を並べない。\nカテゴリ:${category}\n素材:${theme}`;
  try {
    const result = await callOpenAI(env, prompt, '[{"text":"...","category":"...","score":87,"hook":"共感"}]', 7000, 900);
    const ideas = Array.isArray(result.parsed) ? result.parsed : result.parsed.ideas;
    if (!Array.isArray(ideas) || !ideas.length) throw new Error("OpenAI JSON did not include ideas.");
    return json({ success: true, source: "openai-hybrid", model: result.model, elapsedMs: Date.now() - startedAt, ideas: fillIdeas(ideas, theme, category) }, env, request);
  } catch (error) {
    console.error("generate fallback", error);
    return json({ success: true, source: "worker-fallback", error: error.message, elapsedMs: Date.now() - startedAt, ideas: fillIdeas([], theme, category) }, env, request);
  }
}

async function handleResearch(request, env) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const sources = Array.isArray(body.sources) ? body.sources.map(String).slice(0, 24) : [];
  const topic = String(body.topic || body.query || sources.join(" ")).replace(/\s+/g, " ").trim().slice(0, 500);
  const inputSources = sources.length ? sources : (topic ? [topic] : []);
  const persona = String(body.persona || "違和感ノート");
  let tavily = { source: "not-run", results: [] };
  try {
    tavily = await searchTavily(env, topic);
  } catch (error) {
    console.error("tavily fallback", error);
    tavily = { source: "tavily-error", error: error.message, results: [] };
  }

  const sourceRecords = sortSources([
    ...(tavily.results || []).map((item, index) => sourceRecord(item, index, "tavily")),
    ...inputSources.map((item, index) => sourceRecord(item, index, "manual"))
  ]);
  const base = localResearch(sourceRecords.length ? sourceRecords : inputSources.map((item, index) => sourceRecord(item, index, "manual")), persona);

  if (new URL(request.url).searchParams.has("ai")) {
    try {
      const prompt = `以下のリサーチ素材からThreads向けのバズ要素を抽出。丸写し禁止。\n${JSON.stringify(sourceRecords.slice(0, 10))}`;
      const result = await callOpenAI(env, prompt, '{"summary":"...","buzzElements":[],"hooks":[],"phrases":[],"patterns":[],"recommendedPostAngles":[]}', 5000, 800);
      return json(researchPayload({ ...base, ...result.parsed, source: "openai-research", model: result.model }, sourceRecords, startedAt, { tavilySource: tavily.source, tavilyCount: tavily.results.length }), env, request);
    } catch (error) {
      console.error("research ai fallback", error);
      return json(researchPayload(base, sourceRecords, startedAt, { tavilySource: tavily.source, tavilyCount: tavily.results.length, error: error.message }), env, request);
    }
  }

  return json(researchPayload(base, sourceRecords, startedAt, { tavilySource: tavily.source, tavilyCount: tavily.results.length }), env, request);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("Origin")) });
    if (request.method !== "POST") return json({ success: false, error: "POST only" }, env, request, 405);
    const url = new URL(request.url);
    if (url.pathname === "/generate") return handleGenerate(request, env);
    if (url.pathname === "/research" || url.pathname === "/api/research") return handleResearch(request, env);
    return json({ success: false, error: "Not found" }, env, request, 404);
  }
};
