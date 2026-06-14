const DEFAULT_ORIGINS = ["https://nakamurobo2026.github.io", "https://viral-os-phi.vercel.app"];
const MODEL = "gpt-5-mini";
const RESEARCH_FOCUS_WORDS = ["地域", "地方", "閉店", "スーパー", "商店街", "地元", "口コミ", "体験談", "懐かしい", "思い出", "生活", "ニュース", "話題", "議論"];
const GENERIC_SITE_WORDS = ["マーケティング", "SEO", "アクセスアップ", "フォロワー", "アルゴリズム", "運用代行", "広告", "ランキング", "まとめサイト", "通販"];
const GENERIC_DOMAINS = ["fast.com", "speedtest.net", "example.com", "test.com", "google.com/search", "www.google.com", "bing.com"];
const TREND_DISCOVERY_QUERY = "地域ニュース 地元 スーパー 閉店 商店街 小規模店 廃業 懐かしい 思い出 体験談 コミュニティ喪失 変な地元ニュース SNS 話題";

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
  const specific = ["時", "レジ", "棚", "駐車場", "音", "光", "匂い", "人", "店", "閉店", "地元", "商店街"].filter((word) => body.includes(word)).length;
  const close = { S: 38, A: 30, B: 20, C: 12 }[priority] || 12;
  const postable = /だけ|急に|なぜ|違和感|あるある|残る|止まる|懐かしい|思い出|閉店前/.test(body) ? 18 : 8;
  const focused = RESEARCH_FOCUS_WORDS.filter((word) => body.includes(word)).length * 4;
  const genericPenalty = GENERIC_SITE_WORDS.some((word) => body.includes(word)) ? 22 : 0;
  return clamp(close + specific * 5 + postable + focused - genericPenalty, 10, 100);
}

function researchQueryFor(topic) {
  const base = String(topic || "").replace(/\s+/g, " ").trim();
  return [
    base,
    `${base} 地域ニュース 地元 生活 体験談`,
    `${base} SNS 話題 口コミ コメント 議論`,
    `${base} 懐かしい 思い出 閉店 喪失感`,
    `${base} 小規模店 商店街 コミュニティ 変化`,
    `${base} note Togetter Reddit Yahoo リアルタイム`
  ]
    .filter(Boolean)
    .join(" ");
}

function isGenericResult(item) {
  const text = `${item.title || ""} ${item.content || ""} ${item.url || ""}`.toLowerCase();
  if (GENERIC_DOMAINS.some((domain) => text.includes(domain))) return true;
  if (/internet speed|speed test|fast\.com|テストページ|example domain|login|sign in/.test(text)) return true;
  return GENERIC_SITE_WORDS.filter((word) => text.includes(word.toLowerCase())).length >= 2;
}

function relevanceForResult(item, query) {
  const text = `${item.title || ""} ${item.content || ""} ${item.url || ""}`.toLowerCase();
  const queryTerms = String(query || "")
    .replace(/[、。,.]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 12);
  const topicHits = queryTerms.filter((term) => text.includes(term.toLowerCase())).length;
  const focusHits = RESEARCH_FOCUS_WORDS.filter((word) => text.includes(word.toLowerCase())).length;
  const genericHits = GENERIC_SITE_WORDS.filter((word) => text.includes(word.toLowerCase())).length + (isGenericResult(item) ? 3 : 0);
  const domainBoost = /note\.com|togetter\.com|reddit\.com|yahoo\.co\.jp|nhk\.or\.jp|local|times|news|city|town/.test(text) ? 18 : 0;
  const socialBoost = /x\.com|twitter\.com|threads\.net|search\.yahoo\.co\.jp/.test(text) ? 12 : 0;
  return clamp(20 + topicHits * 8 + focusHits * 6 + domainBoost + socialBoost - genericHits * 18, 0, 100);
}

function sourceRecord(raw, index, prefix = "source") {
  const url = String(raw.url || raw.match?.(/https?:\/\/\S+/)?.[0] || "");
  const title = String(raw.title || raw.content || raw).replace(/\s+/g, " ").slice(0, 80);
  const content = String(raw.content || raw.snippet || raw).replace(/\s+/g, " ").slice(0, 500);
  const sourceType = sourceTypeFrom(url || `${title} ${content}`);
  const priority = priorityFor(sourceType);
  const relevance = Number(raw.relevance || relevanceForResult({ title, content, url }, raw.query || ""));
  const reliability = clamp(Math.round((reliabilityFor(`${title} ${content} ${url}`, priority.priority) + relevance) / 2), 10, 100);
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
    relevance,
    impact: Math.round(reliability * priority.weight),
    buzzElements: [
      /投稿|コメント|SNS|Threads|TikTok|X/.test(`${title} ${content}`) ? "SNS反応に近い話題" : "具体描写",
      /レジ|BGM|音/.test(content) ? "音の違和感" : "共感の余白"
    ]
  };
}

function sortSources(records) {
  const rank = { S: 4, A: 3, B: 2, C: 1 };
  return records.sort((a, b) => (rank[b.priority] - rank[a.priority]) || ((b.relevance || 0) - (a.relevance || 0)) || (b.impact - a.impact));
}

async function searchTavily(env, query) {
  const apiKey = env.TAVILY_API_KEY;
  const cleanQuery = researchQueryFor(query).replace(/\s+/g, " ").trim();
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
      body: JSON.stringify({ api_key: apiKey, query: cleanQuery, search_depth: "advanced", max_results: 10, include_answer: false, include_raw_content: false })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(raw);
    const scored = (parsed.results || [])
      .filter((item) => !isGenericResult(item))
      .map((item) => ({ ...item, query: cleanQuery, relevance: relevanceForResult(item, cleanQuery) }))
      .filter((item) => item.relevance >= 34 || /note\.com|togetter\.com|reddit\.com|yahoo\.co\.jp|threads\.net|x\.com|twitter\.com/.test(String(item.url || "")))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8);
    const fallback = (parsed.results || []).filter((item) => !isGenericResult(item)).slice(0, 5);
    const payload = { source: "tavily", query: cleanQuery, results: scored.length ? scored : fallback };
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
    relevance: record.relevance,
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

function emotionalAngleFor(text) {
  const body = String(text || "");
  if (/閉店|廃業|なくなる|終了/.test(body)) return "なくなる前の生活感";
  if (/懐かしい|思い出|昭和|昔/.test(body)) return "懐かしさと現在の差";
  if (/商店街|地元|地域|町/.test(body)) return "地元の静かな変化";
  if (/変|謎|不思議|違和感/.test(body)) return "少し変な地元感";
  return "身近な場所の小さな違和感";
}

function keywordForRecord(record, index) {
  const text = `${record.title || ""} ${record.content || ""}`;
  const place = text.match(/(地方スーパー|スーパー|商店街|駅前|道の駅|個人店|喫茶店|銭湯|古い店|市場|ドラッグストア|ホームセンター)/)?.[0] || ["地方スーパー", "駅前商店街", "閉店前の個人店", "古いホームセンター"][index % 4];
  const event = text.match(/(閉店|廃業|移転|再開発|人手不足|値上げ|空き店舗|取り壊し|最後の日|閉店前)/)?.[0] || ["閉店前", "空き店舗", "最後の日", "再開発前"][index % 4];
  return `${place}の${event}`;
}

function trendTopicPayload({ keyword, whyItMayResonate, emotionalAngle, sourceBackedHint, score }) {
  return {
    keyword,
    emotional_angle: emotionalAngle,
    why_it_may_resonate: whyItMayResonate,
    source_hint: sourceBackedHint,
    score,
    emotionalAngle,
    whyItMayResonate,
    sourceBackedHint
  };
}

function fallbackTrendTopics() {
  const seeds = [
    ["地方スーパーの閉店前", "生活の音が減る瞬間に共感が集まりやすい", "なくなる前の生活感", "地域ニュースと閉店話題"],
    ["駅前商店街の空き店舗", "見慣れた場所の変化はコメントが生まれやすい", "地元の静かな変化", "地域コミュニティの話題"],
    ["古い個人店の最後の日", "個人の思い出と地域の記憶が重なる", "懐かしさと喪失感", "閉店ニュースと体験談"],
    ["ホームセンターの夕方の静けさ", "誰でも知っている場所なのに観察の余白がある", "身近な場所の小さな違和感", "生活圏の観察"],
    ["地方駅前の再開発前", "変わる前の風景に反応が起きやすい", "なくなる風景", "地域ニュース"],
    ["昔ながらの喫茶店の閉店", "懐かしさと個人の記憶を引き出しやすい", "昭和感と喪失", "ローカルニュース"],
    ["ドラッグストアだけ明るい夜", "地方の夜の違和感として投稿化しやすい", "少し変な地元感", "生活者の観察"],
    ["道の駅の夕方", "観光ではなく生活の端っこが見える", "地方の余白", "地域コミュニティ"],
    ["古い看板が残る店", "写真なしでも情景が浮かぶ", "懐かしさと違和感", "街の記憶"],
    ["閉店後の駐車場", "音と人の少なさで共感を作りやすい", "静かな喪失感", "SNSのあるある"]
  ];
  return seeds.map(([keyword, why, emotionalAngle, sourceHint], index) => trendTopicPayload({
    keyword,
    whyItMayResonate: why,
    emotionalAngle,
    sourceBackedHint: sourceHint,
    score: 86 - index * 3
  }));
}

function trendTopicsFromSources(sourceRecords) {
  const seen = new Set();
  const topics = [];
  for (const record of sourceRecords) {
    const keyword = keywordForRecord(record, topics.length);
    const key = keyword.replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const text = `${record.title || ""} ${record.content || ""}`;
    topics.push(trendTopicPayload({
      keyword,
      whyItMayResonate: record.reason || "地域の変化や生活感に近く、コメントの余白がある",
      emotionalAngle: emotionalAngleFor(text),
      sourceBackedHint: record.title || record.content || "Tavily search signal",
      score: clamp(Math.round((record.relevance || 50) * 0.55 + (record.reliability || 50) * 0.45), 45, 96)
    }));
    if (topics.length >= 10) break;
  }
  for (const topic of fallbackTrendTopics()) {
    if (topics.length >= 10) break;
    if (seen.has(topic.keyword.replace(/\s+/g, ""))) continue;
    seen.add(topic.keyword.replace(/\s+/g, ""));
    topics.push(topic);
  }
  return topics.sort((a, b) => b.score - a.score).slice(0, 10);
}

async function discoverTrends(env) {
  const startedAt = Date.now();
  let tavily = { source: "not-run", results: [] };
  try {
    tavily = await searchTavily(env, TREND_DISCOVERY_QUERY);
  } catch (error) {
    console.error("trend discovery fallback", error);
    tavily = { source: "tavily-error", error: error.message, results: [] };
  }
  const sourceRecords = sortSources((tavily.results || []).map((item, index) => sourceRecord(item, index, "trend")));
  const topics = trendTopicsFromSources(sourceRecords);
  return {
    success: true,
    ok: true,
    source: tavily.source,
    query: tavily.query || TREND_DISCOVERY_QUERY,
    topics,
    pickedTopic: topics[0]?.keyword || "",
    sourceRecords,
    elapsedMs: Date.now() - startedAt
  };
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
  let topic = String(body.topic || body.query || sources.join(" ")).replace(/\s+/g, " ").trim().slice(0, 500);
  const requestedTopic = topic;
  let trendDiscovery = null;
  try {
    trendDiscovery = await discoverTrends(env);
  } catch (error) {
    console.error("research trend context fallback", error);
  }
  if (!topic) {
    topic = trendDiscovery?.pickedTopic || "";
  }
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
      return json(researchPayload({ ...base, ...result.parsed, source: "openai-research", model: result.model }, sourceRecords, startedAt, { topic, autoDiscovered: !requestedTopic, trendDiscovery, tavilySource: tavily.source, tavilyCount: tavily.results.length }), env, request);
    } catch (error) {
      console.error("research ai fallback", error);
      return json(researchPayload(base, sourceRecords, startedAt, { topic, autoDiscovered: !requestedTopic, trendDiscovery, tavilySource: tavily.source, tavilyCount: tavily.results.length, error: error.message }), env, request);
    }
  }

  return json(researchPayload(base, sourceRecords, startedAt, { topic, autoDiscovered: !requestedTopic, trendDiscovery, tavilySource: tavily.source, tavilyCount: tavily.results.length }), env, request);
}

async function handleTrends(env, request) {
  return json(await discoverTrends(env), env, request);
}

function handleDashboard(env, request) {
  return json({
    ok: true,
    researchCount: 0,
    draftCount: 0,
    queueCount: 0,
    success: true,
    profile: {
      id: "iwakan-lab",
      displayName: "Iwakan Lab",
      threadsConnected: Boolean(env.THREADS_ACCESS_TOKEN)
    },
    drafts: [],
    researchBriefs: [],
    publishJobs: [],
    auditEvents: [],
    metrics: {
      awaitingApproval: 0,
      scheduled: 0,
      failed: 0,
      published: 0,
      averageScore: 0,
      sourceBackedDrafts: 0
    }
  }, env, request);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("Origin")) });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/dashboard") return handleDashboard(env, request);
    if (request.method === "GET" && url.pathname === "/api/trends") return handleTrends(env, request);
    if (request.method !== "POST") return json({ success: false, error: "POST only" }, env, request, 405);
    if (url.pathname === "/generate") return handleGenerate(request, env);
    if (url.pathname === "/research" || url.pathname === "/api/research") return handleResearch(request, env);
    return json({ success: false, error: "Not found" }, env, request, 404);
  }
};
