const TREND_CATEGORIES = [
  ["nostalgia", "古い商店街の看板", "懐かしさと今の生活の距離", "昔からある場所の小さな変化を、ひとつの景色で切り取る", "地域 懐かしい 商店街 閉店 思い出 SNS"],
  ["curiosity", "誰も説明しない店内ルール", "理由は分からないけど気になる", "普段スルーしている謎の習慣を、観察として出す", "身近な疑問 店舗 ルール なぜ SNS 話題"],
  ["surprise", "普通の場所が急に別物に見える瞬間", "予想外の見え方", "日常の中で一瞬だけ景色が変わるところを拾う", "日常 驚き あるある 店舗 風景 SNS"],
  ["local_change", "地方の店が少しずつ変わる感じ", "便利さと寂しさが同時に来る", "閉店や改装ではなく、変化の途中の空気を投稿化する", "地方 店舗 変化 閉店 改装 地域 ニュース"],
  ["community", "地元だけで共有される小さな常識", "内輪ではないけど近い記憶", "地域の人だけが反応しそうな行動や音を使う", "地域コミュニティ 地元 あるある SNS 話題"],
  ["controversy", "便利になったのに残る寂しさ", "賛否が分かれる生活の変化", "正解を決めず、どちらの気持ちも残る形にする", "便利 寂しい 地方 生活 変化 議論"],
  ["everyday_observation", "17時過ぎの店内の音", "言われたら分かる日常の細部", "音、光、人の減り方だけで共感を作る", "日常 観察 レジ音 蛍光灯 店内 あるある"],
  ["weird_gap", "明るいのに閉店前みたいな場所", "少しだけズレている感じ", "怖がらせず、説明しにくいズレだけ残す", "違和感 日常 変な空気 店舗 SNS"],
  ["empathy", "店員さんの片付けが始まる時間", "働く人と客の気配が交差する", "誰かを責めず、人の動きから共感を作る", "店員 片付け 閉店前 共感 仕事 SNS"],
  ["creator_process", "投稿ネタになる前の小さなメモ", "作る人の観察の裏側", "何気ない発見が投稿になるまでの過程を見せる", "クリエイター 投稿ネタ メモ 観察 SNS"]
].map(([category, base, emotionalAngle, suggestedPostAngle, query]) => ({ category, base, emotionalAngle, suggestedPostAngle, query }));

const NOISE = ["fast.com", "speedtest", "login", "signup", "pricing", "affiliate", "coupon", "求人", "広告", "まとめランキング"];

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(env, request.headers.get("Origin")) });
}

export function corsHeaders(env, origin) {
  const configured = [env.ALLOWED_ORIGIN, env.ALLOWED_ORIGINS]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set(["https://nakamurobo2026.github.io", "https://viral-os-phi.vercel.app", ...configured]);
  const requestOrigin = origin && allowed.has(origin) ? origin : (env.ALLOWED_ORIGIN || "https://viral-os-phi.vercel.app");
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function text(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function isNoise(value) {
  const normalized = text(value);
  return NOISE.some((item) => normalized.includes(text(item)));
}

function similarity(a, b) {
  const left = new Set(text(a).split(" ").filter(Boolean));
  const right = new Set(text(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceHint(source, config) {
  if (!source) return `local fallback / ${config.category}`;
  try {
    const host = new URL(source.url || "https://local.invalid").hostname.replace(/^www\./, "");
    return `${host} / ${String(source.title || config.base).slice(0, 30)}`;
  } catch {
    return String(source.title || config.base).slice(0, 40);
  }
}

function pickSource(results, config, index) {
  const clean = results.filter((item) => !isNoise(`${item.title || ""} ${item.url || ""} ${item.content || ""}`));
  const tokens = text(`${config.query} ${config.base}`).split(" ").filter(Boolean);
  const scored = clean.map((item) => {
    const body = text(`${item.title || ""} ${item.content || ""} ${item.url || ""}`);
    const matches = tokens.reduce((sum, token) => sum + (body.includes(token) ? 1 : 0), 0);
    const sourceBoost = /(threads|x\.com|twitter|note|reddit|togetter|yahoo|news|local|地域|地方|商店街)/i.test(`${item.url || ""} ${item.title || ""}`) ? 8 : 0;
    return { item, score: matches * 4 + sourceBoost };
  }).sort((a, b) => b.score - a.score);
  return scored[index % Math.max(scored.length, 1)]?.item || clean[index % Math.max(clean.length, 1)] || null;
}

function buildKeyword(seed, config, source) {
  const seedText = String(seed || "").trim();
  const title = String(source?.title || "").replace(/\s+/g, " ").trim();
  const hint = title && !isNoise(title) ? title.slice(0, 24) : config.base;
  if (!seedText) return config.base;
  if (similarity(seedText, config.base) > 0.35) return `${seedText} / ${config.category}`;
  return `${seedText}から見る${hint}`;
}

function scoreCandidate(candidate, selected) {
  const body = `${candidate.keyword} ${candidate.emotional_angle} ${candidate.why_it_may_resonate} ${candidate.suggested_post_angle} ${candidate.source_hint}`;
  let score = 64;
  if (/(地方|地域|商店街|駅前|スーパー|店|閉店|改装|地元|看板|駐車場)/.test(body)) score += 10;
  if (/(音|光|匂い|人|棚|レジ|夕方|17時|雨|蛍光灯|入口|通路)/.test(body)) score += 8;
  if (/(けど|なのに|一方で|変わる|残る|ズレ|少し)/.test(body)) score += 7;
  if (/(気になる|共有|賛否|話したく|分かる|誰か)/.test(body)) score += 7;
  if (isNoise(body)) score -= 24;
  for (const picked of selected) {
    score -= similarity(candidate.keyword, picked.keyword) * 28;
    score -= similarity(candidate.suggested_post_angle, picked.suggested_post_angle) * 18;
  }
  return Math.max(1, Math.min(100, Math.round(score)));
}

async function tavily(env, seed) {
  if (!env.TAVILY_API_KEY) return [];
  const query = [
    seed || "日本 地域 SNS 話題",
    "地方 日常 観察 懐かしい 変化 共感",
    "SNS あるある 違和感 地域 コミュニティ"
  ].join(" ");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: "basic", max_results: 12, include_answer: true })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Tavily trends ${response.status}: ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw);
  return Array.isArray(data.results) ? data.results : [];
}

export async function discoverDiverseTrends(env, seed = "") {
  let results = [];
  try {
    results = await tavily(env, seed);
  } catch (error) {
    console.error("trend discovery tavily fallback", error);
  }

  const selected = [];
  for (const config of TREND_CATEGORIES) {
    const source = pickSource(results, config, selected.length);
    const candidate = {
      keyword: buildKeyword(seed, config, source),
      category: config.category,
      emotional_angle: config.emotionalAngle,
      why_it_may_resonate: `${config.base}は、${config.emotionalAngle}を短い観察にしやすい。`,
      source_hint: sourceHint(source, config),
      suggested_post_angle: config.suggestedPostAngle,
      score: 0
    };
    candidate.score = scoreCandidate(candidate, selected);
    selected.push({
      ...candidate,
      emotionalAngle: candidate.emotional_angle,
      whyItMayResonate: candidate.why_it_may_resonate,
      sourceBackedHint: candidate.source_hint,
      suggestedPostAngle: candidate.suggested_post_angle
    });
  }

  return selected
    .sort((a, b) => b.score - a.score)
    .reduce((list, candidate) => {
      if (list.filter((item) => item.category === candidate.category).length >= 2) return list;
      if (list.some((item) => similarity(item.keyword, candidate.keyword) > 0.55)) return list;
      return [...list, candidate];
    }, [])
    .slice(0, 10);
}

export async function handleTrends(request, env) {
  const url = new URL(request.url);
  const seed = url.searchParams.get("topic") || url.searchParams.get("seed") || "";
  const topics = await discoverDiverseTrends(env, seed);
  return json({
    success: true,
    ok: true,
    topics,
    pickedTopic: topics[0]?.keyword || "",
    selectedTrend: topics[0] || null,
    source: env.TAVILY_API_KEY ? "tavily_diverse" : "local_diverse",
    query: seed
  }, env, request);
}

export async function handleResearchWithTrend(request, env, ctx, worker, upstreamEnv, persistHandler) {
  const body = await request.clone().json().catch(() => ({}));
  const seedTopic = String(body.topic || "").trim();
  const trends = await discoverDiverseTrends(env, seedTopic);
  const selectedTrend = trends[0] || null;
  const enrichedBody = selectedTrend ? {
    ...body,
    topic: seedTopic ? `${seedTopic} / ${selectedTrend.category} / ${selectedTrend.suggested_post_angle}` : selectedTrend.keyword,
    trendCategory: selectedTrend.category,
    emotionalAngle: selectedTrend.emotional_angle,
    suggestedPostAngle: selectedTrend.suggested_post_angle
  } : body;
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");
  const enrichedRequest = new Request(request.url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : JSON.stringify(enrichedBody)
  });
  const response = await persistHandler(enrichedRequest, env, ctx, worker, upstreamEnv);
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response(raw, { status: response.status, headers: corsHeaders(env, request.headers.get("Origin")) });
  }
  if (!response.ok || !data?.success) return json(data, env, request, response.status);
  return json({
    ...data,
    topic: data.topic || enrichedBody.topic,
    selectedTrend,
    trendCategory: selectedTrend?.category,
    trendDiscovery: { success: true, ok: true, topics: trends, pickedTopic: selectedTrend?.keyword || "", selectedTrend },
    sources: [
      {
        sourceType: "trend_discovery",
        priority: "A",
        weight: 0.8,
        title: selectedTrend ? `${selectedTrend.category}: ${selectedTrend.keyword}` : "Trend discovery",
        summary: selectedTrend?.why_it_may_resonate || "",
        reliability: selectedTrend?.score || 0,
        impact: selectedTrend?.score || 0,
        extractedElements: selectedTrend ? [selectedTrend.emotional_angle, selectedTrend.suggested_post_angle] : []
      },
      ...(Array.isArray(data.sources) ? data.sources : [])
    ],
    viralElements: [
      ...(Array.isArray(data.viralElements) ? data.viralElements : []),
      ...(selectedTrend ? [
        { elementType: "trend_category", value: selectedTrend.category, score: selectedTrend.score },
        { elementType: "emotional_angle", value: selectedTrend.emotional_angle, score: selectedTrend.score },
        { elementType: "suggested_post_angle", value: selectedTrend.suggested_post_angle, score: selectedTrend.score }
      ] : [])
    ]
  }, env, request, response.status);
}
