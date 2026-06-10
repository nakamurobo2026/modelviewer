const DEFAULT_ORIGIN = "https://nakamurobo2026.github.io";
const IDEA_COUNT = 50;

function corsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  const requestOrigin = origin && origin.startsWith(allowed) ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pick(list, index) {
  return list[index % list.length];
}

function sourceLabel(type) {
  const labels = {
    threads: "Threads実投稿",
    x: "X投稿傾向",
    tiktok: "TikTok構文",
    instagram: "Instagram Reels",
    google_trends: "Google Trends",
    yahoo_realtime: "Yahoo!リアルタイム",
    reddit: "Reddit",
    hatebu: "はてなブックマーク",
    note: "note",
    togetter: "Togetter",
    news: "ニュース",
    blog: "ブログ",
    official: "公式サイト",
    wikipedia: "Wikipedia",
    manual: "手動メモ",
    local: "保存DB/ローカル"
  };
  return labels[type] || "Web";
}

function inferSourceType(source) {
  const text = String(source || "").toLowerCase();
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
  if (host.includes("yahoo.co.jp")) return "news";
  if (host.includes("reddit.com")) return "reddit";
  if (host.includes("b.hatena.ne.jp")) return "hatebu";
  if (host.includes("note.com")) return "note";
  if (host.includes("togetter.com")) return "togetter";
  if (host.includes("wikipedia.org")) return "wikipedia";
  if (/公式|official/.test(text)) return "official";
  if (/ニュース|新聞|press|media/.test(text)) return "news";
  return host ? "blog" : "manual";
}

function priorityFor(type) {
  if (["threads", "x", "tiktok", "instagram"].includes(type)) return { priority: "S", weight: 1, reason: "実投稿や短尺SNS構文に近く、バズへの距離が最短" };
  if (["google_trends", "yahoo_realtime", "reddit", "hatebu", "note", "togetter"].includes(type)) return { priority: "A", weight: 0.8, reason: "話題化の兆候や集合知が見える" };
  if (["news", "blog", "official", "wikipedia"].includes(type)) return { priority: "B", weight: 0.5, reason: "背景情報として有効だが投稿反応からは少し遠い" };
  return { priority: "C", weight: 0.3, reason: "手動メモや保存DB由来で補助素材として扱う" };
}

function reliabilityFor(source, priority) {
  const text = String(source || "");
  const specificity = ["時", "レジ", "棚", "駐車場", "音", "光", "匂い", "人", "店"].filter((word) => text.includes(word)).length;
  const freshness = /今日|昨日|最新|2026|trend|トレンド/i.test(text) ? 18 : 8;
  const closeness = { S: 35, A: 27, B: 17, C: 10 }[priority] || 10;
  const postable = /だけ|急に|なぜ|違和感|あるある|残る|止まる/.test(text) ? 18 : 9;
  return Math.min(100, closeness + freshness + specificity * 5 + postable);
}

function makeSourceRecord(source, index) {
  const url = source.match(/https?:\/\/\S+/)?.[0] || "";
  const content = source.replace(/https?:\/\/\S+/g, "").trim() || url || source;
  const sourceType = inferSourceType(source);
  const priority = priorityFor(sourceType);
  const reliability = reliabilityFor(source, priority.priority);
  return {
    id: `source-${index}`,
    sourceType,
    priority: priority.priority,
    weight: priority.weight,
    url,
    title: content.slice(0, 42) || sourceLabel(sourceType),
    content,
    reason: priority.reason,
    reliability,
    impact: Math.round(reliability * priority.weight),
    buzzElements: [
      /レジ|BGM|音/.test(content) ? "音の違和感" : "具体描写",
      /古い|昭和|懐|蛍光灯/.test(content) ? "懐かしさ" : "共感の余白"
    ]
  };
}

function sortSources(records) {
  const rank = { S: 4, A: 3, B: 2, C: 1 };
  return [...records].sort((a, b) => (rank[b.priority] - rank[a.priority]) || (b.impact - a.impact));
}

function cacheKeyFor(query) {
  return new Request(`https://iwakan-lab.local/tavily-cache?q=${encodeURIComponent(String(query || "").slice(0, 400))}`);
}

async function searchTavily(env, query) {
  const apiKey = env.TAVILY_API_KEY;
  const cleanQuery = String(query || "").replace(/\s+/g, " ").trim();
  if (!apiKey || !cleanQuery) return { source: apiKey ? "tavily-empty-query" : "tavily-key-missing", results: [] };

  const cache = caches.default;
  const cacheKey = cacheKeyFor(cleanQuery);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return { ...data, source: "tavily-cache" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: cleanQuery,
        search_depth: "basic",
        max_results: 8,
        include_answer: false,
        include_raw_content: false
      })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${raw.slice(0, 400)}`);
    const data = JSON.parse(raw);
    const payload = { source: "tavily", query: cleanQuery, results: Array.isArray(data.results) ? data.results : [] };
    await cache.put(cacheKey, new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" }
    }));
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function tavilyRecord(result, index) {
  const url = String(result.url || "");
  const title = String(result.title || sourceLabel(inferSourceType(url))).slice(0, 80);
  const content = String(result.content || result.snippet || "").slice(0, 500);
  const sourceType = inferSourceType(url || `${title} ${content}`);
  const priority = priorityFor(sourceType);
  const reliability = reliabilityFor(`${title} ${content} ${url}`, priority.priority);
  const scoreBoost = Math.round(Number(result.score || 0) * 10);
  return {
    id: `tavily-${index}`,
    sourceType,
    priority: priority.priority,
    weight: priority.weight,
    url,
    title,
    content,
    reason: `${priority.reason} / Tavily検索結果`,
    reliability: Math.min(100, reliability + scoreBoost),
    impact: Math.round(Math.min(100, reliability + scoreBoost) * priority.weight),
    buzzElements: [
      /投稿|コメント|SNS|Threads|TikTok|X/.test(`${title} ${content}`) ? "SNS反応に近い話題" : "検索上位の話題",
      /急|なぜ|違和感|話題|伸び/.test(`${title} ${content}`) ? "反応のきっかけ" : "背景情報"
    ]
  };
}

function localIdeas(theme, category, count = IDEA_COUNT) {
  const base = String(theme || "地方スーパー").replace(/\s+/g, " ").slice(0, 80);
  const places = ["スーパー", "ホームセンター", "ドラッグストア", "地方駅", "商店街", "コンビニ", "市役所"];
  const times = ["17時過ぎ", "閉店前", "雨の日", "夕方", "夜", "平日の昼過ぎ"];
  const sounds = ["レジ音", "BGM", "台車の音", "自動ドア", "冷蔵ケースの音", "店内放送"];
  const objects = ["棚", "駐車場", "惣菜売り場", "看板", "入口", "袋詰め台"];
  return Array.from({ length: count }, (_, index) => {
    const text = `${pick(times, index)}の${base.includes(" ") ? pick(places, index) : base}、${pick(sounds, index)}だけ残って${pick(objects, index)}が少し広く見える`;
    return {
      text: text.slice(0, 90),
      category,
      score: clamp(68 + (index * 7) % 25, 60, 94),
      hook: pick(["共感", "違和感", "懐かしさ", "余白", "不穏"], index)
    };
  });
}

function localResearch(sources, persona = "違和感ノート") {
  const sourceRecords = sortSources((sources.length ? sources : ["地方スーパーの閉店前、レジ音だけ残る"]).map(makeSourceRecord));
  const text = sourceRecords.map((source) => source.content).join("\n");
  const first = sourceRecords[0]?.content || "地方スーパーの閉店前、レジ音だけ残る";
  const hooks = [
    first.match(/(閉店前|17時過ぎ|夕方|深夜|雨の日)/)?.[0] || "17時過ぎ",
    first.match(/(スーパー|ホームセンター|コンビニ|地方駅|商店街|ドラッグストア|市役所)/)?.[0] || "身近な場所"
  ];
  const phrases = sources.map((source) => source.replace(/https?:\/\/\S+/g, "").replace(/[「」『』"']/g, "").trim().slice(0, 34)).filter(Boolean).slice(0, 8);
  const buzzElements = [
    text.includes("レジ") ? "レジ音だけ残る" : "音が少なくなる瞬間",
    text.includes("駐車場") ? "駐車場が急に広く見える" : "人が少ない場所",
    text.includes("蛍光灯") ? "古い蛍光灯の白さ" : "棚の色が暗く見える",
    "普通なのに少しだけずれる"
  ];
  return {
    success: true,
    source: "worker-fallback",
    summary: `${hooks.join("の")}を起点に、具体描写と少しの違和感で投稿化する。`,
    buzzElements,
    hooks,
    phrases,
    patterns: ["共感型", "違和感型", "余白型"],
    sourceRecords,
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
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = env.OPENAI_MODEL || "gpt-5-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const body = {
    model,
    input: `${prompt}\n\nJSONだけを返してください。${schemaHint}`,
    max_output_tokens: 2400
  };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${raw.slice(0, 500)}`);
    const data = JSON.parse(raw);
    const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n") || "";
    return { parsed: extractJson(text), model, raw };
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
    "Threads向け投稿案を50件作る。",
    "AIっぽい抽象語は禁止。20〜90文字中心。コメントしたくなる余白を残す。",
    "場所、時間、音、光、人の少なさ、店舗の挙動を使う。",
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
    return json({
      success: true,
      source: "worker-fallback",
      model: env.OPENAI_MODEL || "gpt-5-mini",
      error: error.message,
      elapsedMs: Date.now() - startedAt,
      ideas: localIdeas(theme, category)
    }, env, request);
  }
}

async function handleResearch(request, env) {
  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const sources = Array.isArray(body.sources) ? body.sources.map(String).slice(0, 24) : [];
  const persona = String(body.persona || "違和感ノート");
  let tavily = { source: "not-run", results: [] };
  try {
    const query = String(body.query || sources.join(" ")).slice(0, 500);
    tavily = await searchTavily(env, query);
  } catch (error) {
    console.error("tavily fallback", error);
    tavily = { source: "tavily-error", error: error.message, results: [] };
  }
  const tavilyRecords = sortSources((tavily.results || []).map(tavilyRecord));
  const enrichedSources = [...tavilyRecords.map((item) => `${item.title}\n${item.url}\n${item.content}`), ...sources];
  const prompt = [
    "入力されたURLメモ、コピペ投稿、メモ、キーワードからThreads運用向けのバズ要素を抽出する。",
    "元投稿の丸写しは禁止。言い回しは変換して使う。",
    "返すキー: summary, buzzElements, hooks, phrases, patterns, recommendedPostAngles",
    "sourceRecordsも返す。sourceType, priority, weight, url, title, content, reason, reliability, impactを含める。",
    "Priority S/Aを優先し、B/Cは背景か補助として扱う。",
    `人格:${persona}`,
    `sources:${JSON.stringify(sources)}`
  ].join("\n");
  try {
    const { parsed, model } = await callOpenAI(env, prompt, '{"summary":"...","buzzElements":[],"hooks":[],"phrases":[],"patterns":[],"recommendedPostAngles":[],"sourceRecords":[]}');
    const base = localResearch(enrichedSources, persona);
    return json({ success: true, source: "openai", model, tavilySource: tavily.source, tavilyCount: tavilyRecords.length, elapsedMs: Date.now() - startedAt, ...base, ...parsed, sourceRecords: sortSources([...(parsed.sourceRecords || []), ...tavilyRecords, ...base.sourceRecords]) }, env, request);
  } catch (error) {
    console.error("research fallback", error);
    const base = localResearch(enrichedSources, persona);
    return json({ ...base, tavilySource: tavily.source, tavilyCount: tavilyRecords.length, error: error.message, elapsedMs: Date.now() - startedAt, sourceRecords: sortSources([...tavilyRecords, ...base.sourceRecords]) }, env, request);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env, request.headers.get("Origin")) });
    }
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return json({ success: false, error: "POST only" }, env, request, 405);
    }
    if (url.pathname === "/generate") return handleGenerate(request, env);
    if (url.pathname === "/research") return handleResearch(request, env);
    return json({ success: false, error: "Not found" }, env, request, 404);
  }
};
