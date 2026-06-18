const MARKET_DOMAINS = [
  { domain: "恋愛", category: "女の本音", query: "恋愛 女の本音 Threads 共感 話題", emotionalAngle: "好きなのに素直になれない温度差", suggestedPostAngle: "恋愛心理を説明せず、女性目線の一場面で置く", genres: ["female_truth", "romance_aruaru"] },
  { domain: "男女の温度差", category: "賛否", query: "男女の温度差 恋愛 あるある SNS 話題", emotionalAngle: "同じ出来事でも感じ方が違うもどかしさ", suggestedPostAngle: "責めずに、気づいてほしいズレとして書く", genres: ["comment_bait", "female_truth"] },
  { domain: "夜のLINE", category: "夜のLINE", query: "夜 LINE 恋愛 返信 未読 SNS 共感", emotionalAngle: "深夜だけ近くなる関係の寂しさ", suggestedPostAngle: "夜中の通知や未読を情景化する", genres: ["night_line", "沼"] },
  { domain: "返信速度", category: "脈あり脈なし", query: "返信速度 恋愛 脈あり 脈なし SNS 話題", emotionalAngle: "返信の速さで一日が揺れる感じ", suggestedPostAngle: "返信速度そのものより待っている女の子の動きを書く", genres: ["green_or_red_flag", "comment_bait"] },
  { domain: "脈あり脈なし", category: "脈あり脈なし", query: "脈あり 脈なし 判定 恋愛 SNS", emotionalAngle: "分かっているのに期待してしまう矛盾", suggestedPostAngle: "判定口調ではなく、自分で察してしまう瞬間にする", genres: ["green_or_red_flag", "female_truth"] },
  { domain: "元カレ元カノ", category: "元カレ元カノ", query: "元カレ 元カノ 未練 SNS 投稿 話題", emotionalAngle: "終わったはずの人がSNSで現在形になる", suggestedPostAngle: "元カレの投稿を見てしまう指の動きで書く", genres: ["ex_memory", "sns_love"] },
  { domain: "匂わせ", category: "匂わせ", query: "匂わせ 恋愛 SNS ストーリー あるある", emotionalAngle: "直接言えない本音を遠回しに置く", suggestedPostAngle: "ストーリーや下書きを使って、見てほしい人だけを匂わせる", genres: ["subtle_hint", "sns_love"] },
  { domain: "浮気疑惑", category: "賛否", query: "浮気疑惑 スマホ 彼氏 SNS 恋愛 あるある", emotionalAngle: "証拠はないのに空気で察する怖さ", suggestedPostAngle: "断罪せず、スマホの置き方や通知だけで不安を描く", genres: ["jealousy", "comment_bait"] },
  { domain: "友達以上恋人未満", category: "友達以上恋人未満", query: "友達以上恋人未満 恋愛 SNS 共感", emotionalAngle: "壊したくなくて進めない関係", suggestedPostAngle: "改札や帰り道で言えなかった一言を描く", genres: ["more_than_friends", "subtle_hint"] },
  { domain: "片思い", category: "女の本音", query: "片思い LINE 送れない 恋愛 SNS", emotionalAngle: "重いと思われたくなくて本音を消す", suggestedPostAngle: "送信前に消した一言を中心にする", genres: ["strong_girl", "night_line"] },
  { domain: "依存", category: "沼", query: "恋愛 依存 沼 SNS あるある", emotionalAngle: "小さな反応だけで機嫌が変わる怖さ", suggestedPostAngle: "既読や足跡だけで安心してしまう場面にする", genres: ["沼", "green_or_red_flag"] },
  { domain: "嫉妬", category: "嫉妬", query: "嫉妬 恋愛 SNS いいね欄 ストーリー", emotionalAngle: "責められないのに平気ではいられない", suggestedPostAngle: "いいね欄や足跡を見た女の子の沈黙を書く", genres: ["jealousy", "comment_bait"] },
  { domain: "都合のいい関係", category: "都合のいい関係", query: "都合のいい関係 恋愛 夜 LINE SNS", emotionalAngle: "分かっていても一回の優しさで戻される", suggestedPostAngle: "短い連絡と前回泣いた記憶をつなげる", genres: ["situationship", "adult_distance"] },
  { domain: "女の本音", category: "女の本音", query: "女の本音 恋愛 あるある Threads", emotionalAngle: "言わないだけで本当は気づいてほしい", suggestedPostAngle: "一人称の本音を短く、説明しすぎず書く", genres: ["female_truth", "subtle_hint"] },
  { domain: "恋愛あるある", category: "恋愛あるある", query: "恋愛あるある 共感 SNS Threads", emotionalAngle: "笑えるけど当事者だと笑えない矛盾", suggestedPostAngle: "好きじゃない人と好きな人で反応が変わる場面にする", genres: ["romance_aruaru", "comment_bait"] },
  { domain: "人間関係", category: "女の本音", query: "人間関係 女友達 嫉妬 SNS 共感", emotionalAngle: "仲がいいからこそ比べてしまう気まずさ", suggestedPostAngle: "女友達との会話や通知の見え方で書く", genres: ["female_truth", "comment_bait"] },
  { domain: "承認欲求", category: "匂わせ", query: "承認欲求 恋愛 SNS ストーリー 好きな人", emotionalAngle: "みんなじゃなく一人に見てほしい気持ち", suggestedPostAngle: "投稿時間や自撮りの撮り直しで見せる", genres: ["sns_love", "subtle_hint"] },
  { domain: "SNSと恋愛", category: "匂わせ", query: "SNS 恋愛 ストーリー 足跡 いいね あるある", emotionalAngle: "見なくていいものまで見えてしまう恋愛", suggestedPostAngle: "足跡、いいね欄、未読を具体物として使う", genres: ["sns_love", "jealousy"] },
  { domain: "大人の距離感", category: "都合のいい関係", query: "大人の距離感 恋愛 曖昧な関係 SNS", emotionalAngle: "余裕のふりをした我慢", suggestedPostAngle: "聞きたいことを飲み込む帰り道として描く", genres: ["adult_distance", "female_truth"] },
  { domain: "寂しさ", category: "夜のLINE", query: "寂しさ 恋愛 夜 SNS 共感", emotionalAngle: "夜だけ本音が出る弱さ", suggestedPostAngle: "ベッドの上のスマホや消した下書きで描く", genres: ["night_line", "strong_girl"] }
];

const NOISE = ["fast.com", "speedtest", "login", "signup", "pricing", "affiliate", "coupon", "求人", "広告", "まとめランキング", "テスト", "計測", "通信速度", "アダルト", "出会い系", "マッチングアプリ 比較"];
const UNSAFE_TERMS = ["未成年", "中学生", "高校生", "児童", "裸", "性器", "性交", "セックス", "レイプ", "強姦", "無理やり", "脅し", "監禁", "盗撮", "痴漢"];

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
  return NOISE.some((item) => normalized.includes(text(item))) || UNSAFE_TERMS.some((item) => normalized.includes(text(item)));
}

function similarity(a, b) {
  const left = new Set(text(a).split(" ").filter(Boolean));
  const right = new Set(text(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceHint(source, config) {
  if (!source) return `romance market fallback / ${config.domain}`;
  try {
    const host = new URL(source.url || "https://local.invalid").hostname.replace(/^www\./, "");
    return `${host} / ${String(source.title || config.domain).slice(0, 42)}`;
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
  const socialBoost = /(threads|x\.com|twitter|instagram|tiktok|note|togetter|yahoo|sns|コメント|恋愛|共感|賛否|あるある|匂わせ|line|ストーリー)/i.test(`${source.url || ""} ${source.title || ""} ${source.content || ""}`) ? 16 : 0;
  const freshnessBoost = /(2026|2025|最新|今日|昨日|話題|急増|トレンド|リアルタイム)/i.test(`${source.title || ""} ${source.content || ""}`) ? 10 : 0;
  const noisePenalty = isNoise(`${source.title || ""} ${source.url || ""} ${source.content || ""}`) ? 90 : 0;
  return matches * 6 + socialBoost + freshnessBoost - noisePenalty;
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
  if (/(threads|x\.com|twitter|instagram|tiktok|note|togetter|yahoo|リアルタイム|trend|トレンド|話題|sns)/i.test(body)) value += 14;
  if (/(コメント|どっち|賛否|あるある|共感|嫉妬|脈あり|脈なし|匂わせ|LINE|未読|元カレ|沼)/i.test(body)) value += 12;
  if (/(心理|本音|相談|対処|見極め|チェック|保存|まとめ)/i.test(body)) value += 6;
  if (isNoise(body)) value -= 35;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function buildKeyword(config, source) {
  const title = String(source?.title || "").replace(/\s+/g, " ").trim();
  if (title && !isNoise(title)) return `${config.domain} / ${title.slice(0, 28)}`;
  return `${config.domain}で今刺さる恋愛感情`;
}

function scoreCandidate(candidate, selected) {
  let score = Math.round(candidate.trend_strength * 0.4 + candidate.comment_potential * 0.42 + candidate.save_potential * 0.18);
  if (/(恋愛|LINE|返信|脈|元カレ|匂わせ|嫉妬|沼|女の本音|SNS)/.test(candidate.domain + candidate.category)) score += 6;
  if (isNoise(`${candidate.keyword} ${candidate.source_hint}`)) score -= 50;
  for (const picked of selected) {
    if (picked.domain === candidate.domain) score -= 75;
    score -= similarity(candidate.keyword, picked.keyword) * 32;
    score -= similarity(candidate.suggested_post_angle, picked.suggested_post_angle) * 20;
  }
  return Math.max(1, Math.min(100, Math.round(score)));
}

async function tavily(env, seed) {
  if (!env.TAVILY_API_KEY) return [];
  const seedClause = seed ? ` seed context: ${seed}` : "";
  const query = [
    "日本 Threads 恋愛 女の本音 LINE 未読 返信速度 匂わせ SNS 話題",
    "恋愛あるある 脈あり 脈なし 元カレ 嫉妬 都合のいい関係 コメント 共感",
    "夜のLINE ストーリー 足跡 友達以上恋人未満 大人の距離感 SNS",
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
    console.error("romance trend discovery tavily fallback", error);
  }

  const candidates = MARKET_DOMAINS.map((config) => {
    const source = pickSource(results, config);
    const sourceScore = source ? scoreSourceForDomain(source, config) : 0;
    const trendStrength = metricFromSource(source, config, source ? 58 + Math.min(24, sourceScore) : 50);
    const commentPotential = metricFromSource(source, config, 58 + (/(コメント|賛否|あるある|恋愛|脈|嫉妬|匂わせ|LINE)/.test(config.query) ? 14 : 0));
    const savePotential = metricFromSource(source, config, 45 + (/(心理|見極め|判定|対処|女の本音|大人の距離感)/.test(config.query) ? 12 : 0));
    const candidate = {
      keyword: buildKeyword(config, source),
      domain: config.domain,
      category: config.category,
      emotional_angle: config.emotionalAngle,
      why_it_may_resonate: `${config.domain}は、${config.emotionalAngle}が起きやすく、女性目線のThreadsで自分ごと化されやすい。`,
      source_hint: sourceHint(source, config),
      suggested_post_angle: config.suggestedPostAngle,
      suggested_genre: config.genres[0],
      likely_comments: `${config.domain}で、自分の経験・賛否・元カレ元カノ話を置きやすい`,
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
    source: env.TAVILY_API_KEY ? "tavily_romance_market" : "local_romance_market_domains",
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
        sourceType: "romance_trend_discovery",
        priority: "A",
        weight: 0.8,
        title: selectedTrend ? `${selectedTrend.domain}: ${selectedTrend.keyword}` : "Romance trend discovery",
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
