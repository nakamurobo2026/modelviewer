const MARKET_DOMAINS = [
  { domain: "人間関係", category: "empathy", query: "人間関係 悩み 共感 SNS 話題", emotionalAngle: "近い人ほど言いにくい本音", suggestedPostAngle: "関係性の小さなズレを、責めずに言語化する", genres: ["empathy", "comment_bait"] },
  { domain: "恋愛", category: "controversy", query: "恋愛 価値観 あるある SNS 話題", emotionalAngle: "好きなのにすれ違う感覚", suggestedPostAngle: "恋愛の正解を決めず、賛否が出る余白を残す", genres: ["controversy", "empathy"] },
  { domain: "子育て", category: "empathy", query: "子育て 共感 疲れ SNS 話題", emotionalAngle: "毎日の小さな限界と救い", suggestedPostAngle: "立派な育児論ではなく、生活の一場面に落とす", genres: ["empathy", "personal_story"] },
  { domain: "お金", category: "saveability", query: "お金 節約 物価高 家計 SNS 話題", emotionalAngle: "生活防衛と小さな不安", suggestedPostAngle: "数字の話ではなく、買い物中の実感として書く", genres: ["before_after", "comment_bait"] },
  { domain: "節約", category: "saveability", query: "節約 ライフハック 物価高 SNS 話題", emotionalAngle: "知っておくと少し助かる", suggestedPostAngle: "保存したくなる生活の工夫に変換する", genres: ["creator_process", "before_after"] },
  { domain: "仕事", category: "empathy", query: "仕事 あるある 職場 ストレス SNS 話題", emotionalAngle: "職場で飲み込んでいる感情", suggestedPostAngle: "働く人の小さな我慢を観察として出す", genres: ["empathy", "failure_story"] },
  { domain: "転職", category: "curiosity", query: "転職 キャリア 悩み SNS 話題", emotionalAngle: "変わりたいけど怖い", suggestedPostAngle: "成功談ではなく、迷いの瞬間を投稿化する", genres: ["before_after", "personal_story"] },
  { domain: "AI", category: "surprise", query: "AI 生成AI 仕事 SNS 話題 日本", emotionalAngle: "便利さと怖さが同時に来る", suggestedPostAngle: "AIそのものより、人間側の戸惑いを書く", genres: ["surprise", "controversy"] },
  { domain: "SNS", category: "curiosity", query: "SNS 疲れ 投稿 あるある Threads 話題", emotionalAngle: "つながっているのに疲れる", suggestedPostAngle: "SNS上の小さな行動の違和感を拾う", genres: ["weird_gap", "comment_bait"] },
  { domain: "健康", category: "saveability", query: "健康 習慣 睡眠 疲れ SNS 話題", emotionalAngle: "体調の小さな不安", suggestedPostAngle: "大きな健康論ではなく、日々の体感にする", genres: ["micro_observation", "before_after"] },
  { domain: "ダイエット", category: "controversy", query: "ダイエット 体型 食事 SNS 話題", emotionalAngle: "続けたい気持ちとしんどさ", suggestedPostAngle: "努力自慢ではなく、続かない側の人間味を書く", genres: ["failure_story", "empathy"] },
  { domain: "メンタル", category: "empathy", query: "メンタル 疲れ 不安 共感 SNS 話題", emotionalAngle: "元気なふりの裏側", suggestedPostAngle: "重くしすぎず、生活の中のサインとして書く", genres: ["quiet_emotion", "empathy"] },
  { domain: "学校", category: "nostalgia", query: "学校 あるある 懐かしい SNS 話題", emotionalAngle: "思い出と今の距離", suggestedPostAngle: "学校の物や音から記憶を呼び戻す", genres: ["nostalgia", "micro_observation"] },
  { domain: "趣味", category: "creator_process", query: "趣味 沼 推し活 コレクション SNS 話題", emotionalAngle: "好きなものに時間を溶かす感覚", suggestedPostAngle: "趣味の楽しさより、やめどきのなさを書く", genres: ["creator_process", "comment_bait"] },
  { domain: "エンタメ", category: "surprise", query: "エンタメ ドラマ 映画 音楽 SNS 話題", emotionalAngle: "みんなが同じ瞬間に反応する", suggestedPostAngle: "作品名依存ではなく、見た後の感情に寄せる", genres: ["surprise", "empathy"] },
  { domain: "都市伝説", category: "curiosity", query: "都市伝説 噂 不思議 SNS 話題", emotionalAngle: "本当か分からないけど気になる", suggestedPostAngle: "怖がらせすぎず、説明できない余白を残す", genres: ["curiosity", "weird_gap"] },
  { domain: "地域ネタ", category: "local_change", query: "地域 ニュース 地元 話題 SNS 日本", emotionalAngle: "その土地の人だけ反応する記憶", suggestedPostAngle: "地名に頼らず、地域差が出る行動を書く", genres: ["local_culture", "comment_bait"] },
  { domain: "ライフハック", category: "saveability", query: "ライフハック 生活の知恵 便利 SNS 話題", emotionalAngle: "すぐ使える小さな得", suggestedPostAngle: "保存したくなる一文にする", genres: ["before_after", "creator_process"] },
  { domain: "炎上話題", category: "controversy", query: "炎上 話題 賛否 SNS 日本", emotionalAngle: "正しさが割れる空気", suggestedPostAngle: "断罪せず、意見が割れる理由だけ置く", genres: ["controversy", "unpopular_opinion"] },
  { domain: "比較ネタ", category: "surprise", query: "比較 どっち派 SNS 話題", emotionalAngle: "自分の派閥を言いたくなる", suggestedPostAngle: "二択にしてコメントしやすくする", genres: ["comment_bait", "controversy"] },
  { domain: "あるある", category: "empathy", query: "あるある 共感 SNS 話題 日本", emotionalAngle: "言われたら分かる日常", suggestedPostAngle: "説明より一場面で共感を作る", genres: ["empathy", "micro_observation"] },
  { domain: "違和感観察", category: "weird_gap", query: "違和感 日常 観察 SNS 話題", emotionalAngle: "名前のない小さなズレ", suggestedPostAngle: "意味不明にせず、実在しそうな観察にする", genres: ["weird_gap", "micro_observation"] },
  { domain: "Before/After", category: "before_after", query: "ビフォーアフター 変化 SNS 話題", emotionalAngle: "変化を見る気持ちよさ", suggestedPostAngle: "前後の差を短く見せる", genres: ["before_after", "surprise"] },
  { domain: "コメント誘発", category: "comment_bait", query: "コメントしたくなる 投稿 SNS 話題", emotionalAngle: "自分の例を出したくなる", suggestedPostAngle: "答えを言い切らず、経験を置ける余白を作る", genres: ["comment_bait", "empathy"] },
  { domain: "驚き", category: "surprise", query: "意外 驚き 雑学 SNS 話題", emotionalAngle: "思っていた前提が少しズレる", suggestedPostAngle: "知らなかったより、見方が変わる方向にする", genres: ["surprise", "curiosity"] },
  { domain: "賛否", category: "controversy", query: "賛否 両論 話題 SNS 日本", emotionalAngle: "どちらの気持ちも少し分かる", suggestedPostAngle: "強い断定を避けて、意見を言える形にする", genres: ["controversy", "comment_bait"] },
  { domain: "懐かしさ", category: "nostalgia", query: "懐かしい 平成 昭和 思い出 SNS 話題", emotionalAngle: "記憶の共有", suggestedPostAngle: "昔話ではなく、今見た瞬間の懐かしさにする", genres: ["nostalgia", "before_after"] },
  { domain: "共感", category: "empathy", query: "共感 あるある 日常 SNS 話題", emotionalAngle: "自分だけじゃなかった感覚", suggestedPostAngle: "代弁しすぎず、コメントの余白を残す", genres: ["empathy", "comment_bait"] }
];

const NOISE = ["fast.com", "speedtest", "login", "signup", "pricing", "affiliate", "coupon", "求人", "広告", "まとめランキング", "テスト", "計測", "通信速度"];
const USER_INTEREST_BIAS_TERMS = ["工場", "CNC", "cnc", "3Dプリンター", "3dプリンター", "福山市", "府中市", "ものづくり", "製造業", "加工", "切削"];

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

function hasUserInterestBias(value) {
  const normalized = text(value);
  return USER_INTEREST_BIAS_TERMS.some((item) => normalized.includes(text(item)));
}

function similarity(a, b) {
  const left = new Set(text(a).split(" ").filter(Boolean));
  const right = new Set(text(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceHint(source, config) {
  if (!source) return `market fallback / ${config.domain}`;
  try {
    const host = new URL(source.url || "https://local.invalid").hostname.replace(/^www\./, "");
    return `${host} / ${String(source.title || config.domain).slice(0, 40)}`;
  } catch {
    return String(source.title || config.domain).slice(0, 48);
  }
}

function domainTokens(config) {
  return text(`${config.domain} ${config.query} ${config.emotionalAngle} ${config.suggestedPostAngle}`).split(" ").filter(Boolean);
}

function scoreSourceForDomain(source, config) {
  const body = text(`${source.title || ""} ${source.content || ""} ${source.url || ""}`);
  const tokens = domainTokens(config);
  const matches = tokens.reduce((sum, token) => sum + (body.includes(token) ? 1 : 0), 0);
  const socialBoost = /(threads|x\.com|twitter|tiktok|instagram|reddit|togetter|note|yahoo|news|trend|話題|sns|コメント|炎上|共感|賛否)/i.test(`${source.url || ""} ${source.title || ""}`) ? 12 : 0;
  const freshnessBoost = /(2026|2025|最新|今日|昨日|話題|急増|トレンド|リアルタイム)/i.test(`${source.title || ""} ${source.content || ""}`) ? 10 : 0;
  const noisePenalty = isNoise(`${source.title || ""} ${source.url || ""} ${source.content || ""}`) ? 80 : 0;
  return matches * 5 + socialBoost + freshnessBoost - noisePenalty;
}

function pickSource(results, config) {
  const clean = results.filter((item) => !isNoise(`${item.title || ""} ${item.url || ""} ${item.content || ""}`));
  const scored = clean
    .map((item) => ({ item, score: scoreSourceForDomain(item, config) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

function metricFromSource(source, config, base) {
  const body = `${source?.title || ""} ${source?.content || ""} ${source?.url || ""} ${config.domain} ${config.query}`;
  let value = base;
  if (/(threads|x\.com|twitter|tiktok|instagram|reddit|togetter|note|yahoo|リアルタイム|trend|トレンド|話題)/i.test(body)) value += 14;
  if (/(コメント|どっち|賛否|あるある|共感|炎上|議論|反応)/i.test(body)) value += 10;
  if (/(保存|方法|コツ|節約|健康|チェック|一覧|比較|Before|After|ビフォー|アフター)/i.test(body)) value += 8;
  if (hasUserInterestBias(body)) value -= 20;
  if (isNoise(body)) value -= 30;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function buildKeyword(config, source) {
  const title = String(source?.title || "").replace(/\s+/g, " ").trim();
  if (title && !isNoise(title) && !hasUserInterestBias(title)) return `${config.domain} / ${title.slice(0, 28)}`;
  return `${config.domain}で今ひっかかる話題`;
}

function scoreCandidate(candidate, selected) {
  let score = Math.round(candidate.trend_strength * 0.45 + candidate.comment_potential * 0.32 + candidate.save_potential * 0.23);
  if (/(SNS|AI|お金|仕事|人間関係|恋愛|健康|炎上|賛否|共感|コメント)/.test(candidate.domain)) score += 4;
  if (hasUserInterestBias(`${candidate.keyword} ${candidate.source_hint}`) && candidate.trend_strength < 82) score -= 45;
  if (isNoise(`${candidate.keyword} ${candidate.source_hint}`)) score -= 35;
  for (const picked of selected) {
    if (picked.domain === candidate.domain) score -= 80;
    score -= similarity(candidate.keyword, picked.keyword) * 34;
    score -= similarity(candidate.suggested_post_angle, picked.suggested_post_angle) * 22;
  }
  return Math.max(1, Math.min(100, Math.round(score)));
}

async function tavily(env, seed) {
  if (!env.TAVILY_API_KEY) return [];
  const seedClause = seed ? ` seed context: ${seed}` : "";
  const query = [
    "日本 SNS 話題 最新 共感 賛否 コメント トレンド",
    "Yahoo リアルタイム note Togetter Reddit X Threads 伸びている話題",
    "人間関係 恋愛 お金 仕事 AI 健康 メンタル エンタメ 炎上 あるある",
    seedClause
  ].join(" ");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: "basic", max_results: 20, include_answer: true })
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

  const candidates = MARKET_DOMAINS.map((config) => {
    const source = pickSource(results, config);
    const sourceScore = source ? scoreSourceForDomain(source, config) : 0;
    const trendStrength = metricFromSource(source, config, source ? 56 + Math.min(26, sourceScore) : 44);
    const commentPotential = metricFromSource(source, config, 52 + (/(コメント|賛否|あるある|共感|恋愛|人間関係|炎上)/.test(config.query) ? 12 : 0));
    const savePotential = metricFromSource(source, config, 48 + (/(節約|お金|健康|ライフハック|Before|After|比較)/.test(config.query) ? 14 : 0));
    const candidate = {
      keyword: buildKeyword(config, source),
      domain: config.domain,
      category: config.category,
      emotional_angle: config.emotionalAngle,
      why_it_may_resonate: `${config.domain}は、${config.emotionalAngle}が起きやすく、今のSNSで自分ごと化されやすい。`,
      source_hint: sourceHint(source, config),
      suggested_post_angle: config.suggestedPostAngle,
      suggested_genre: config.genres[0],
      likely_comments: `${config.domain}で自分の体験や反対意見を置きやすい`,
      trend_strength: trendStrength,
      comment_potential: commentPotential,
      save_potential: savePotential,
      score: 0
    };
    candidate.score = scoreCandidate(candidate, []);
    return candidate;
  });

  const selected = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const scored = { ...candidate, score: scoreCandidate(candidate, selected) };
    if (scored.score < 35) continue;
    if (selected.some((item) => item.domain === scored.domain)) continue;
    if (selected.some((item) => similarity(item.keyword, scored.keyword) > 0.52)) continue;
    selected.push({
      ...scored,
      emotionalAngle: scored.emotional_angle,
      whyItMayResonate: scored.why_it_may_resonate,
      sourceBackedHint: scored.source_hint,
      suggestedPostAngle: scored.suggested_post_angle,
      suggestedGenre: scored.suggested_genre,
      likelyComments: scored.likely_comments,
      trendStrength: scored.trend_strength,
      commentPotential: scored.comment_potential,
      savePotential: scored.save_potential
    });
    if (selected.length >= 10) break;
  }

  if (selected.length >= 10) return selected.slice(0, 10);

  for (const fallback of candidates.sort((a, b) => b.trend_strength - a.trend_strength)) {
    if (selected.some((item) => item.domain === fallback.domain)) continue;
    selected.push({
      ...fallback,
      emotionalAngle: fallback.emotional_angle,
      whyItMayResonate: fallback.why_it_may_resonate,
      sourceBackedHint: fallback.source_hint,
      suggestedPostAngle: fallback.suggested_post_angle,
      suggestedGenre: fallback.suggested_genre,
      likelyComments: fallback.likely_comments,
      trendStrength: fallback.trend_strength,
      commentPotential: fallback.comment_potential,
      savePotential: fallback.save_potential
    });
    if (selected.length >= 10) break;
  }
  return selected.slice(0, 10);
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
    source: env.TAVILY_API_KEY ? "tavily_market_driven" : "local_market_domains",
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
    topic: seedTopic ? `${selectedTrend.keyword} / ${selectedTrend.domain} / ${selectedTrend.suggested_post_angle}` : selectedTrend.keyword,
    trendCategory: selectedTrend.category,
    trendDomain: selectedTrend.domain,
    emotionalAngle: selectedTrend.emotional_angle,
    suggestedPostAngle: selectedTrend.suggested_post_angle,
    trendStrength: selectedTrend.trend_strength,
    commentPotential: selectedTrend.comment_potential,
    savePotential: selectedTrend.save_potential
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
    trendDomain: selectedTrend?.domain,
    trendDiscovery: { success: true, ok: true, topics: trends, pickedTopic: selectedTrend?.keyword || "", selectedTrend },
    sources: [
      {
        sourceType: "trend_discovery",
        priority: "A",
        weight: 0.8,
        title: selectedTrend ? `${selectedTrend.domain}: ${selectedTrend.keyword}` : "Trend discovery",
        summary: selectedTrend?.why_it_may_resonate || "",
        reliability: selectedTrend?.trend_strength || selectedTrend?.score || 0,
        impact: selectedTrend?.comment_potential || selectedTrend?.score || 0,
        extractedElements: selectedTrend ? [selectedTrend.domain, selectedTrend.emotional_angle, selectedTrend.suggested_post_angle] : []
      },
      ...(Array.isArray(data.sources) ? data.sources : [])
    ],
    viralElements: [
      ...(Array.isArray(data.viralElements) ? data.viralElements : []),
      ...(selectedTrend ? [
        { elementType: "trend_category", value: selectedTrend.category, score: selectedTrend.score },
        { elementType: "emotional_angle", value: selectedTrend.emotional_angle, score: selectedTrend.score },
        { elementType: "suggested_post_angle", value: selectedTrend.suggested_post_angle, score: selectedTrend.score },
        { elementType: "angle", value: `domain:${selectedTrend.domain}`, score: selectedTrend.trend_strength }
      ] : [])
    ]
  }, env, request, response.status);
}
