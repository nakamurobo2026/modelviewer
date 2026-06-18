const GENRE_TAXONOMY = [
  { genre: "empathy", label: "共感", trigger: "empathy", buzz_elements: ["共感", "あるある", "コメント余白"], score: 86 },
  { genre: "nostalgia", label: "懐かしさ", trigger: "nostalgia", buzz_elements: ["懐かしさ", "記憶", "保存されやすい"], score: 82 },
  { genre: "curiosity", label: "好奇心", trigger: "curiosity", buzz_elements: ["なぜ感", "違和感", "続きを考えたくなる"], score: 84 },
  { genre: "surprise", label: "驚き", trigger: "surprise", buzz_elements: ["意外性", "見方の反転", "発見"], score: 83 },
  { genre: "controversy", label: "賛否", trigger: "controversy", buzz_elements: ["賛否", "価値観", "語りたくなる"], score: 85 },
  { genre: "personal_story", label: "個人体験", trigger: "empathy", buzz_elements: ["自分語り", "生活感", "人間味"], score: 81 },
  { genre: "one_line_punch", label: "一言パンチ", trigger: "surprise", buzz_elements: ["短文", "刺さる一言", "引用されやすい"], score: 80 },
  { genre: "comment_bait", label: "コメント誘発", trigger: "comment bait", buzz_elements: ["答えたくなる", "経験募集", "余白"], score: 88 },
  { genre: "failure_story", label: "失敗談", trigger: "empathy", buzz_elements: ["失敗", "反省", "人間味"], score: 83 },
  { genre: "before_after", label: "Before/After", trigger: "surprise", buzz_elements: ["変化", "比較", "保存性"], score: 84 },
  { genre: "unpopular_opinion", label: "逆張り", trigger: "controversy", buzz_elements: ["少数派", "賛否", "反応"], score: 84 },
  { genre: "micro_observation", label: "微細観察", trigger: "curiosity", buzz_elements: ["細部", "情景", "分かる感"], score: 82 },
  { genre: "weird_gap", label: "変なズレ", trigger: "curiosity", buzz_elements: ["違和感", "ズレ", "不思議"], score: 83 },
  { genre: "lifehack", label: "ライフハック", trigger: "save", buzz_elements: ["保存", "実用", "あとで使える"], score: 85 },
  { genre: "hot_take", label: "炎上話題", trigger: "controversy", buzz_elements: ["反応が分かれる", "意見募集", "注意"], score: 82 }
];

const CATEGORY_TO_GENRES = {
  "自動ミックス": [],
  Auto: [],
  "共感": ["empathy", "personal_story", "micro_observation", "comment_bait"],
  "懐かしさ": ["nostalgia", "before_after", "personal_story", "empathy"],
  "違和感": ["weird_gap", "curiosity", "micro_observation", "surprise"],
  "賛否": ["controversy", "unpopular_opinion", "hot_take", "comment_bait"],
  "驚き": ["surprise", "curiosity", "before_after", "weird_gap"],
  "あるある": ["empathy", "micro_observation", "comment_bait", "personal_story"],
  "失敗談": ["failure_story", "personal_story", "empathy", "comment_bait"],
  "一言パンチ": ["one_line_punch", "weird_gap", "unpopular_opinion", "surprise"],
  "コメント誘発": ["comment_bait", "controversy", "empathy", "weird_gap"],
  "Before / After": ["before_after", "nostalgia", "surprise", "lifehack"],
  "Before/After": ["before_after", "nostalgia", "surprise", "lifehack"],
  "炎上注意": ["hot_take", "unpopular_opinion", "controversy", "comment_bait"]
};

const PERSONA_PROFILES = {
  "違和感ハンター": { tone: "違和感を短く言語化", prefer: ["weird_gap", "curiosity", "micro_observation"] },
  "地元あるある職人": { tone: "地域差より生活のあるある", prefer: ["empathy", "comment_bait", "micro_observation"] },
  "昭和ノスタルジー語り": { tone: "懐かしさと記憶", prefer: ["nostalgia", "before_after", "personal_story"] },
  "炎上しない賛否メーカー": { tone: "安全な賛否", prefer: ["controversy", "unpopular_opinion", "hot_take"] },
  "深夜ラジオの独白": { tone: "独り言と余白", prefer: ["personal_story", "empathy", "weird_gap"] },
  "町の観察者": { tone: "生活の細部観察", prefer: ["micro_observation", "curiosity", "empathy"] },
  "職人の裏側語り": { tone: "過程と気づき", prefer: ["failure_story", "lifehack", "one_line_punch"] },
  "失敗談コレクター": { tone: "失敗と人間味", prefer: ["failure_story", "personal_story", "empathy"] },
  "一言パンチ職人": { tone: "短文の切れ味", prefer: ["one_line_punch", "weird_gap", "unpopular_opinion"] },
  "コメント誘発屋": { tone: "答えたくなる余白", prefer: ["comment_bait", "controversy", "empathy"] }
};

const MARKET_TOPICS = [
  { domain: "人間関係", topic: "返信が遅いだけで距離を感じる瞬間", object: "未読のまま残る通知", people: "友達や同僚", tension: "嫌われたわけじゃないのに気になる", question: "返信速度って、どこから失礼になるんだろう" },
  { domain: "恋愛", topic: "好きなのに疲れる関係", object: "何気ない一言", people: "付き合う前後の二人", tension: "楽しいはずなのに少し消耗する", question: "安心できる恋愛って、どんな状態なんだろう" },
  { domain: "仕事", topic: "頑張ってる人ほど損して見える職場", object: "誰も見ていない雑務", people: "真面目な人", tension: "評価されないのに仕事だけ増える", question: "真面目さって武器なのか罰なのか" },
  { domain: "お金", topic: "節約してるのに不安が減らない", object: "家計簿の小さな数字", people: "生活を守りたい人", tension: "削っても安心が増えない", question: "節約ってどこから我慢になるんだろう" },
  { domain: "AI/仕事", topic: "AIで楽になるはずなのに考える量が増える", object: "生成された文章", people: "AIを使い始めた人", tension: "便利なのに判断が増える", question: "AI時代に残る仕事って何なんだろう" },
  { domain: "SNS", topic: "投稿しない人の方が幸せそうに見える", object: "何も更新されないプロフィール", people: "見る専の人", tension: "発信してる方が疲れている", question: "見せない生活の方が強いのかもしれない" },
  { domain: "メンタル", topic: "休んでいるのに休まらない日", object: "スマホの通知", people: "疲れている人", tension: "何もしてないのに脳だけ忙しい", question: "本当に休むってどういう状態なんだろう" },
  { domain: "子育て", topic: "親の普通が子どもには重い瞬間", object: "何気ない注意", people: "親子", tension: "心配のつもりが圧になる", question: "心配とコントロールの境目ってどこだろう" },
  { domain: "健康", topic: "健康のための行動がストレスになる", object: "歩数やカロリーの数字", people: "頑張りたい人", tension: "正しい習慣ほど続けるのがしんどい", question: "健康って数字で追うほど遠くなる時がある" },
  { domain: "学校", topic: "学校でしか通じない謎ルール", object: "誰も説明しない決まり", people: "学生や先生", tension: "守ってる理由が誰にも分からない", question: "あれ、大人になっても残ってる気がする" },
  { domain: "エンタメ", topic: "倍速視聴で感動だけ薄くなる", object: "再生速度ボタン", people: "忙しい視聴者", tension: "効率よく見たのに何も残らない", question: "楽しむことまで時短していいのか" },
  { domain: "都市伝説", topic: "みんなが一度は聞いた根拠のない噂", object: "昔からある言い伝え", people: "なぜか信じていた人", tension: "嘘っぽいのに記憶に残る", question: "根拠がない話ほど広がるのはなぜだろう" },
  { domain: "ライフハック", topic: "便利グッズを買うほど部屋が散らかる", object: "使っていない収納用品", people: "暮らしを良くしたい人", tension: "整えるための物が増えていく", question: "便利さって物を減らすことじゃなかったっけ" },
  { domain: "転職", topic: "辞めたい理由が給料だけじゃない時", object: "朝の通勤時間", people: "転職を考える人", tension: "条件は悪くないのに気持ちが削れる", question: "何を我慢できないかで仕事は決まるのかもしれない" },
  { domain: "炎上話題", topic: "正論なのに嫌われる言い方", object: "短いコメント", people: "意見を言う人", tension: "内容より温度で反発される", question: "正しさって伝え方で負けることがある" },
  { domain: "比較ネタ", topic: "昔より便利なのに幸福感が増えない", object: "増えた選択肢", people: "便利さに慣れた人", tension: "選べるほど迷う", question: "不便だった頃の方が迷わなかったのかもしれない" }
];

const BAD_PUBLIC_PHRASES = /調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO|信頼度|取得元|source|research|reliability|score|viralScore|totalScore|source_ids/gi;
const SUPERMARKET_WORDS = /地方スーパー|スーパー|閉店前|レジ音|棚|惣菜売り場|値引きシール/g;

function stripBadPhrases(value) {
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return String(value || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/www\.\S+/g, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(BAD_PUBLIC_PHRASES, "")
    .replace(/[{}[\]"]+/g, "")
    .replace(/^\s*(?:[-*・]|\d+[.)、])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countJapaneseChars(value) {
  return [...String(value || "")].length;
}

function compactToLimit(text, max = 220) {
  const chars = [...String(text || "")];
  if (chars.length <= max) return text;
  const sentences = String(text).split(/(?<=[。！？])/).filter(Boolean);
  let output = "";
  for (const sentence of sentences) {
    if ([...output, ...sentence].length > max) break;
    output += sentence;
  }
  return output || chars.slice(0, max - 1).join("") + "。";
}

function padIfTooShort(text, topic) {
  if (countJapaneseChars(text) >= 80) return text;
  return `${text} ${topic.question}`.trim();
}

function scoreBoost(genre, options = {}) {
  let boost = 0;
  if (options.prioritizeCommentability && ["comment_bait", "controversy", "hot_take", "empathy"].includes(genre)) boost += 7;
  if (options.prioritizeSaveability && ["lifehack", "before_after", "nostalgia", "micro_observation"].includes(genre)) boost += 6;
  if (options.strongStyle && ["one_line_punch", "weird_gap", "unpopular_opinion", "hot_take"].includes(genre)) boost += 4;
  if (options.safeMode && ["hot_take", "unpopular_opinion", "controversy"].includes(genre)) boost -= 4;
  return boost;
}

function selectGenres(options = {}) {
  const category = String(options.buzzCategory || "自動ミックス");
  const persona = PERSONA_PROFILES[options.persona] || null;
  const categoryPreferred = CATEGORY_TO_GENRES[category] || [];
  const personaPreferred = persona?.prefer || [];
  if (options.mixAllGenres !== false || !categoryPreferred.length) {
    const first = [...new Set([...categoryPreferred, ...personaPreferred])];
    const rest = GENRE_TAXONOMY.map((item) => item.genre).filter((genre) => !first.includes(genre));
    return [...first, ...rest].map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
  }
  const merged = [...new Set([...categoryPreferred, ...personaPreferred])];
  const rest = GENRE_TAXONOMY.map((item) => item.genre).filter((genre) => !merged.includes(genre));
  return [...merged, ...rest].map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
}

function marketTopicsFromDrafts(drafts, options = {}) {
  const material = stripBadPhrases((drafts || []).map((draft) => `${draft.title || ""} ${draft.text || ""} ${draft.body || ""}`).join(" "));
  const isSupermarketOnly = SUPERMARKET_WORDS.test(material) && !/(人間関係|恋愛|仕事|お金|AI|SNS|健康|学校|転職|メンタル|子育て|炎上|ライフハック)/.test(material);
  SUPERMARKET_WORDS.lastIndex = 0;
  if (!material || isSupermarketOnly || String(options.buzzCategory || "自動ミックス") === "自動ミックス") return MARKET_TOPICS;
  const matched = MARKET_TOPICS.filter((topic) => material.includes(topic.domain) || material.includes(topic.topic.slice(0, 6)));
  return matched.length ? [...matched, ...MARKET_TOPICS.filter((topic) => !matched.includes(topic))] : MARKET_TOPICS;
}

function buildTextForGenre(item, topic, index) {
  const templates = {
    empathy: `${topic.topic}って、言葉にすると小さいけど毎日の中ではけっこう刺さる。${topic.tension}。同じことを気にしてる人、たぶん思ってるより多い。`,
    nostalgia: `昔は気にしてなかったのに、大人になると${topic.object}みたいなものに引っかかる。${topic.topic}って、今の話のようで少し昔の自分も混ざる。`,
    curiosity: `${topic.topic}、なんでこんなに気になるんだろう。${topic.object}ひとつで空気が変わる時がある。理由は分からないけど、みんなの中にも似た場面がありそう。`,
    surprise: `普通に見えてたものが、ある日急に別物に見えることがある。${topic.topic}もそれで、${topic.object}だけで見方が変わる。小さいのに意外と残る。`,
    controversy: `${topic.topic}って、正直かなり意見が分かれそう。${topic.tension}。どっちが正しいというより、自分が何に疲れるかが出る話だと思う。`,
    personal_story: `前に${topic.topic}で、妙に引っかかったことがある。大きな事件じゃないのに、${topic.object}だけ覚えてる。こういう小さい違和感の方があとで残る。`,
    one_line_punch: `${topic.topic}。便利になったのに、気持ちは軽くならないことがある。${topic.question}。`,
    comment_bait: `${topic.topic}、自分だけかと思ってたけど多分ちがう。${topic.tension}。似た経験ある人、どの場面で感じるのか聞いてみたい。`,
    failure_story: `${topic.topic}で一回失敗したことがある。大げさじゃないけど、${topic.object}の扱いを間違えると地味にしんどい。小さい後悔ほど人に言いにくい。`,
    before_after: `前は平気だったのに、今は${topic.topic}が少し気になる。${topic.object}の見え方が変わっただけで、生活の感じ方まで変わることがある。`,
    unpopular_opinion: `少数派かもしれないけど、${topic.topic}は無理に前向きにしなくてもいいと思う。${topic.tension}なら、まず距離を取るのも普通に選択肢。`,
    micro_observation: `${topic.object}みたいな小さいものに、その人の疲れ方が出る時がある。${topic.topic}って派手じゃないけど、生活の本音が漏れやすい。`,
    weird_gap: `${topic.topic}には、説明しにくいズレがある。頭では分かってるのに、${topic.object}を見ると気持ちだけ遅れて反応する。あの感じ、名前がほしい。`,
    lifehack: `${topic.topic}で迷った時は、感情じゃなくて回数で見ると少し楽になる。何度も同じところで疲れるなら、それは気合いじゃなく仕組みの問題かもしれない。`,
    hot_take: `${topic.topic}、優しい言い方をしても刺さる人には刺さる話だと思う。${topic.tension}。でも、ここを曖昧にするとずっと消耗する。`
  };
  return stripBadPhrases(templates[item.genre] || templates.micro_observation).replace(SUPERMARKET_WORDS, "生活の場面");
}

function applyPersonaTone(text, item, options = {}) {
  const personaName = options.persona || "町の観察者";
  let output = text;
  if (personaName === "一言パンチ職人") output = output.split("。 ").slice(0, 2).join("。 ").trim();
  if (personaName === "深夜ラジオの独白") output = `これ、夜中にふと思い出したんだけど。${output}`;
  if (personaName === "炎上しない賛否メーカー") output = output.replace(/^少数派かもしれないけど、/, "好み分かれるけど、");
  if (personaName === "コメント誘発屋" && item.genre !== "comment_bait") output = `${output} 似た経験ある人いそう。`;
  if (options.strongStyle) output = output.replace(/少し/g, "かなり").replace(/気になる/g, "引っかかる");
  if (options.safeMode) output = output.replace(/無理/g, "しんどい").replace(/刺さる/g, "反応が分かれる");
  return stripBadPhrases(output);
}

function spreadReason(item, topic, options = {}) {
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["町の観察者"];
  return `${topic.domain}は反応母数が広く、${item.label}の切り口で自分の経験を書き込みやすい。文体: ${persona.tone}。`;
}

function buildPublicPost(item, topic, index, options) {
  const raw = applyPersonaTone(buildTextForGenre(item, topic, index), item, options);
  const postText = compactToLimit(padIfTooShort(raw, topic), 220);
  const hook = stripBadPhrases(postText.split("。")[0] + "。");
  const body = stripBadPhrases(postText.replace(hook, "").trim());
  const total = Math.max(0, Math.min(100, item.score + scoreBoost(item.genre, options) + ((index * 3) % 8)));
  const persona = options.persona || "町の観察者";
  const buzzElements = [...new Set([topic.domain, item.label, ...item.buzz_elements])];
  const why = spreadReason(item, topic, options);
  const detail = {
    post_text: postText,
    hook,
    body,
    closing_line: topic.question,
    comment_bait: topic.question,
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    persona,
    genre: item.genre,
    angle_type: item.label,
    angleType: item.label,
    buzz_elements: buzzElements,
    buzzElements,
    why_it_may_spread: why,
    whyItMaySpread: why,
    viral_score: total,
    viralScore: {
      curiosity: item.genre === "curiosity" || item.genre === "weird_gap" ? 88 : 70,
      nostalgia: item.genre === "nostalgia" || item.genre === "before_after" ? 86 : 68,
      surprise: item.genre === "surprise" || item.genre === "one_line_punch" ? 85 : 69,
      empathy: item.genre === "empathy" || item.genre === "personal_story" ? 88 : 70,
      controversy: item.genre === "controversy" || item.genre === "unpopular_opinion" || item.genre === "hot_take" ? 86 : 58,
      commentability: item.genre === "comment_bait" || item.genre === "controversy" ? 92 : 78,
      total
    },
    totalScore: total,
    internal: { domain: topic.domain, source_topic: topic.topic, writer: "market-diversity-writer-v4" }
  };
  return {
    id: crypto.randomUUID(),
    persona,
    genre: item.genre,
    angle_type: item.label,
    angleType: item.label,
    buzz_elements: buzzElements,
    buzzElements,
    why_it_may_spread: why,
    whyItMaySpread: why,
    post_text: postText,
    postText,
    text: postText,
    hook,
    body,
    closing_line: topic.question,
    closingLine: topic.question,
    comment_bait: topic.question,
    commentBait: topic.question,
    cta: topic.question,
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    viral_score: total,
    viralScore: detail.viralScore,
    source_ids: [],
    sourceIds: [],
    category: topic.domain,
    hookType: item.genre,
    score: total,
    scoreTotal: total,
    totalScore: total,
    scoreDetail: detail,
    sourceTrace: []
  };
}

function isUsablePost(draft) {
  const text = draft.post_text || draft.postText || draft.text || "";
  if (countJapaneseChars(text) < 70 || countJapaneseChars(text) > 230) return false;
  if (/https?:\/\/|www\./.test(text)) return false;
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  const hasBadPhrase = BAD_PUBLIC_PHRASES.test(text);
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  if (hasBadPhrase) return false;
  if (/^\s*(?:[-*・]|\d+[.)、])\s+/m.test(text)) return false;
  return true;
}

function diversify(posts) {
  const selected = [];
  const seenDomains = new Map();
  const seenGenres = new Set();
  const seenNouns = new Map();
  for (const post of posts) {
    if (!isUsablePost(post)) continue;
    const domain = post.category || post.scoreDetail?.internal?.domain || "general";
    if ((seenDomains.get(domain) || 0) >= 2) continue;
    if (seenGenres.has(post.genre)) continue;
    const text = post.post_text || post.text || "";
    const repeatedBad = ["スーパー", "閉店前", "レジ", "棚"].some((noun) => text.includes(noun) && (seenNouns.get(noun) || 0) >= 1);
    if (repeatedBad) continue;
    selected.push(post);
    seenGenres.add(post.genre);
    seenDomains.set(domain, (seenDomains.get(domain) || 0) + 1);
    ["スーパー", "閉店前", "レジ", "棚"].forEach((noun) => { if (text.includes(noun)) seenNouns.set(noun, (seenNouns.get(noun) || 0) + 1); });
    if (selected.length >= 10) break;
  }
  if (selected.length >= 10) return selected;
  for (const post of posts) {
    if (selected.includes(post) || !isUsablePost(post)) continue;
    selected.push(post);
    if (selected.length >= 10) break;
  }
  return selected.slice(0, 10);
}

export function rewriteDraftsToThreadsNative(drafts, researchId, options = {}) {
  const topics = marketTopicsFromDrafts(Array.isArray(drafts) ? drafts : [], options);
  const genres = selectGenres(options);
  const posts = [];
  const count = Math.max(10, Math.min(16, genres.length));
  for (let index = 0; index < count; index += 1) {
    const item = genres[index % genres.length];
    const topic = topics[index % topics.length];
    const post = buildPublicPost(item, topic, index, options);
    post.source_ids = [researchId].filter(Boolean);
    post.sourceIds = post.source_ids;
    post.sourceTrace = post.source_ids;
    post.scoreDetail.source_ids = post.source_ids;
    posts.push(post);
  }
  return diversify(posts);
}
