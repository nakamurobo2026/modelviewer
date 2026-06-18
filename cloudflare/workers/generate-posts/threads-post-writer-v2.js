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
  "自動ミックス": [], Auto: [],
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
  "地元あるある職人": { tone: "生活のあるある", prefer: ["empathy", "comment_bait", "micro_observation"] },
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
  { domain: "人間関係", topic: "返信が遅いだけで距離を感じる瞬間", object: "未読の通知", people: "友達", tension: "嫌われたわけじゃないのに気になる", question: "返信速度って、どこから距離になるんだろう" },
  { domain: "恋愛", topic: "好きなのに疲れる関係", object: "短いLINE", people: "待っている人", tension: "楽しいはずなのに少し消耗する", question: "安心できる恋愛って、どんな状態なんだろう" },
  { domain: "仕事", topic: "頑張ってる人ほど損して見える職場", object: "コピー用紙", people: "真面目な人", tension: "評価されないのに仕事だけ増える", question: "真面目さって武器なのか罰なのか" },
  { domain: "お金", topic: "節約してるのに不安が減らない", object: "家計簿の端数", people: "レシートを見返す人", tension: "削っても安心が増えない", question: "節約ってどこから我慢になるんだろう" },
  { domain: "AI", topic: "AIで楽になるはずなのに考える量が増える", object: "生成された文章", people: "画面の前で止まる人", tension: "便利なのに判断が増える", question: "AI時代に残る仕事って何なんだろう" },
  { domain: "SNS", topic: "投稿しない人の方が幸せそうに見える", object: "更新されないプロフィール", people: "見る専の人", tension: "発信してる方が疲れている", question: "見せない生活の方が強いのかもしれない" },
  { domain: "メンタル", topic: "休んでいるのに休まらない日", object: "スマホの通知", people: "布団の中の人", tension: "何もしてないのに脳だけ忙しい", question: "本当に休むってどういう状態なんだろう" },
  { domain: "子育て", topic: "親の普通が子どもには重い瞬間", object: "置きっぱなしのランドセル", people: "注意する親", tension: "心配のつもりが圧になる", question: "心配とコントロールの境目ってどこだろう" },
  { domain: "健康", topic: "健康のための行動がストレスになる", object: "歩数アプリ", people: "夜に数字を見る人", tension: "正しい習慣ほど続けるのがしんどい", question: "健康って数字で追うほど遠くなる時がある" },
  { domain: "学校", topic: "学校でしか通じない謎ルール", object: "誰も説明しない掲示物", people: "廊下で立ち止まる学生", tension: "守ってる理由が誰にも分からない", question: "あれ、大人になっても残ってる気がする" },
  { domain: "エンタメ", topic: "倍速視聴で感動だけ薄くなる", object: "再生速度ボタン", people: "ソファでリモコンを持つ人", tension: "効率よく見たのに何も残らない", question: "楽しむことまで時短していいのか" },
  { domain: "都市伝説", topic: "みんなが一度は聞いた根拠のない噂", object: "古い貼り紙", people: "帰り道で思い出す人", tension: "嘘っぽいのに記憶に残る", question: "根拠がない話ほど広がるのはなぜだろう" },
  { domain: "ライフハック", topic: "便利グッズを買うほど部屋が散らかる", object: "使っていない収納用品", people: "片付けようとする人", tension: "整えるための物が増えていく", question: "便利さって物を減らすことじゃなかったっけ" },
  { domain: "転職", topic: "辞めたい理由が給料だけじゃない時", object: "朝の改札", people: "通勤列に並ぶ人", tension: "条件は悪くないのに気持ちが削れる", question: "何を我慢できないかで仕事は決まるのかもしれない" },
  { domain: "炎上話題", topic: "正論なのに嫌われる言い方", object: "短いコメント", people: "投稿ボタンの前で迷う人", tension: "内容より温度で反発される", question: "正しさって伝え方で負けることがある" },
  { domain: "比較ネタ", topic: "昔より便利なのに幸福感が増えない", object: "増えた選択肢", people: "メニューの前で迷う人", tension: "選べるほど迷う", question: "不便だった頃の方が迷わなかったのかもしれない" }
];

const SCENE_PLACES = {
  人間関係: ["22時の部屋", "駅のホーム", "昼休みの机"],
  恋愛: ["夜のコンビニ前", "改札の横", "帰り道の信号待ち"],
  仕事: ["18時のオフィス", "誰もいないコピー機の前", "朝の給湯室"],
  お金: ["スーパーの袋詰め台", "レジ横", "家のテーブル"],
  AI: ["深夜のデスク", "会議前のノートPC", "生成画面の前"],
  SNS: ["寝る前の布団", "電車の中", "通知欄の画面"],
  メンタル: ["休日の昼の部屋", "布団の中", "カーテンを閉めた部屋"],
  子育て: ["朝の玄関", "夕方のリビング", "学校帰りの廊下"],
  健康: ["夜の洗面所", "駅の階段", "寝る前のスマホ画面"],
  学校: ["放課後の廊下", "職員室前", "雨の日の昇降口"],
  エンタメ: ["ソファの上", "帰りの電車", "テレビの前"],
  都市伝説: ["古い団地の掲示板", "夜の帰り道", "駅裏の道"],
  ライフハック: ["片付け途中の部屋", "キッチンの引き出し", "玄関の棚"],
  転職: ["朝の改札", "会社のエレベーター", "昼休みのベンチ"],
  炎上話題: ["投稿画面の前", "コメント欄", "通知が増えるスマホ"],
  比較ネタ: ["店のメニュー前", "家電売り場", "ネット注文の画面"]
};

const ACTIONS = ["立ち止まっている", "画面を閉じたり開いたりしている", "誰にも言わずに片付けている", "同じ場所を何度も見ている", "送信ボタンの前で止まっている", "小さい数字だけ見ている", "何も買わずに戻している", "少しだけため息をついている"];
const BAD_PUBLIC_PHRASES = /調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO|信頼度|取得元|source|research|reliability|score|viralScore|totalScore|source_ids/gi;
const ABSTRACT_ONLY = /^(頑張ってる人|人間関係|恋愛|仕事|お金|AI|SNS|健康|メンタル|共感|賛否|違和感|懐かしさ|幸せ|不安|孤独|努力|正論|便利)[^。！？]{0,40}$/;

function stripBadPhrases(value) {
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return String(value || "").replace(/https?:\/\/\S+/g, "").replace(/www\.\S+/g, "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(BAD_PUBLIC_PHRASES, "").replace(/[{}[\]"]+/g, "").replace(/^\s*(?:[-*・]|\d+[.)、])\s+/gm, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function countJapaneseChars(value) { return [...String(value || "")].length; }
function compactToLimit(text, max = 220) {
  const chars = [...String(text || "")];
  if (chars.length <= max) return text;
  return chars.slice(0, max - 1).join("") + "。";
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
  const first = options.mixAllGenres !== false || !categoryPreferred.length ? [...new Set([...categoryPreferred, ...personaPreferred])] : [...new Set([...categoryPreferred, ...personaPreferred])];
  const rest = GENRE_TAXONOMY.map((item) => item.genre).filter((genre) => !first.includes(genre));
  return [...first, ...rest].map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
}
function marketTopicsFromDrafts(drafts, options = {}) {
  const material = stripBadPhrases((drafts || []).map((draft) => `${draft.title || ""} ${draft.text || ""} ${draft.body || ""}`).join(" "));
  if (!material || String(options.buzzCategory || "自動ミックス") === "自動ミックス") return MARKET_TOPICS;
  const matched = MARKET_TOPICS.filter((topic) => material.includes(topic.domain) || material.includes(topic.topic.slice(0, 6)));
  return matched.length ? [...matched, ...MARKET_TOPICS.filter((topic) => !matched.includes(topic))] : MARKET_TOPICS;
}

function buildScene(topic, index) {
  const places = SCENE_PLACES[topic.domain] || ["夜の部屋", "駅前", "帰り道"];
  const place = places[index % places.length];
  const action = ACTIONS[(index + topic.domain.length) % ACTIONS.length];
  return {
    place,
    object: topic.object,
    human_behavior: `${topic.people}が${action}`,
    scene: `${place}。\n${topic.object}の前で\n${topic.people}が${action}。`,
    observation: `${topic.object}だけが妙に目立って、そこに${topic.tension}が出ている。`,
    meaning: topic.tension,
    comment_invitation: topic.question
  };
}

function sceneStrength(scene, text) {
  let score = 0;
  if (scene.place && /[0-9時朝昼夜夕方深夜駅部屋机前横中]/.test(scene.place)) score += 22;
  if (scene.object && text.includes(scene.object.slice(0, 4))) score += 24;
  if (scene.human_behavior && /(いる|している|見ている|止まっている|戻している|並ぶ|迷う|片付け)/.test(scene.human_behavior)) score += 24;
  if (/(不安|疲れ|距離|消耗|寂し|怖|気になる|迷う|引っかかる|残る)/.test(text)) score += 16;
  if (/(だろう|かもしれない|ありそう|どこから|何なんだろう)/.test(text)) score += 14;
  return Math.max(0, Math.min(100, score));
}

function buildTextForGenre(item, topic, scene) {
  const separator = "\n\n";
  const endings = {
    empathy: `こういう小さい行動に、${topic.tension}が出る気がする。`,
    nostalgia: `昔は気にしてなかったのに、今見ると妙に残る。`,
    curiosity: `なんでここで一回止まるんだろう。`,
    surprise: `ただの物なのに、見方が急に変わる。`,
    controversy: `これ、気にする人と気にしない人で分かれそう。`,
    personal_story: `自分も同じ場面で止まったことがある。`,
    one_line_punch: `${topic.object}の前で止まる人、だいたい何かを飲み込んでる。`,
    comment_bait: `似た場面、どの場所で見たことある？`,
    failure_story: `見なかったことにした時ほど、あとで残る。`,
    before_after: `前は普通だったのに、今はそこだけ意味が変わって見える。`,
    unpopular_opinion: `正直、ここを気にする人の方が信用できる。`,
    micro_observation: `派手な出来事より、こういう細部の方が生活の本音に近い。`,
    weird_gap: `変と言うほどじゃない。でも、ずっと引っかかる。`,
    lifehack: `こういう時は、気合いより仕組みを変えた方が早い。`,
    hot_take: `言い方を間違えると反応が分かれるけど、見ないふりもできない。`
  };
  return stripBadPhrases([scene.scene, scene.observation, endings[item.genre] || endings.micro_observation, scene.comment_invitation].join(separator));
}

function applyPersonaTone(text, item, options = {}) {
  const personaName = options.persona || "町の観察者";
  let output = text;
  if (personaName === "一言パンチ職人") output = output.split("\n\n").slice(0, 3).join("\n\n");
  if (personaName === "深夜ラジオの独白") output = `これ、夜中にふと思い出したんだけど。\n\n${output}`;
  if (personaName === "炎上しない賛否メーカー") output = output.replace(/正直、/, "好み分かれるけど、");
  if (personaName === "コメント誘発屋" && item.genre !== "comment_bait") output = `${output}\n\n似た場面、他にもありそう。`;
  if (options.strongStyle) output = output.replace(/小さい/g, "妙に小さい").replace(/気になる/g, "引っかかる");
  if (options.safeMode) output = output.replace(/信用できる/g, "分かる気がする").replace(/反応が分かれる/g, "意見が分かれる");
  return stripBadPhrases(output);
}

function rejectReason(draft, scene) {
  const text = draft.post_text || draft.text || "";
  if (ABSTRACT_ONLY.test(text.replace(/\n/g, ""))) return "abstract_only";
  if (!scene.object || !text.includes(scene.object.slice(0, 4))) return "missing_object";
  if (!/(いる|している|見ている|止まっている|戻している|並ぶ|迷う|片付け)/.test(text)) return "missing_human_action";
  if (!/(不安|疲れ|距離|消耗|寂し|怖|気になる|迷う|引っかかる|残る|分かれそう)/.test(text)) return "missing_emotional_interpretation";
  if (!/(だろう|かもしれない|ありそう|どこから|何なんだろう|ある？|気がする)/.test(text)) return "missing_comment_space";
  return "";
}

function spreadReason(item, topic, scene, sceneScore, options = {}) {
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["町の観察者"];
  return `${scene.place}の${scene.object}という具体場面があり、${topic.domain}の話を自分の経験に置き換えやすい。scene_strength ${sceneScore}。文体: ${persona.tone}。`;
}

function sceneScoreFromDraft(draft) {
  return Number(draft.scene_strength ?? draft.sceneStrength ?? draft.scoreDetail?.scene_strength ?? draft.scoreDetail?.sceneStrength ?? 0);
}

function buildPublicPost(item, topic, index, options) {
  const scene = buildScene(topic, index);
  const raw = applyPersonaTone(buildTextForGenre(item, topic, scene), item, options);
  const postText = compactToLimit(raw, 220);
  const sceneScore = sceneStrength(scene, postText);
  const total = Math.max(0, Math.min(100, Math.round(item.score + scoreBoost(item.genre, options) + sceneScore * 0.22 + ((index * 3) % 6))));
  const persona = options.persona || "町の観察者";
  const buzzElements = [...new Set([topic.domain, item.label, "scene", ...item.buzz_elements])];
  const why = spreadReason(item, topic, scene, sceneScore, options);
  const detail = {
    post_text: postText,
    hook: scene.scene.split("\n")[0],
    body: scene.observation,
    closing_line: scene.comment_invitation,
    comment_bait: scene.comment_invitation,
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    persona,
    domain: topic.domain,
    genre: item.genre,
    angle_type: item.label,
    angleType: item.label,
    buzz_elements: buzzElements,
    buzzElements,
    scene_strength: sceneScore,
    sceneStrength: sceneScore,
    scene,
    why_it_may_spread: why,
    whyItMaySpread: why,
    viral_score: total,
    viralScore: { curiosity: item.genre === "curiosity" || item.genre === "weird_gap" ? 88 : 70, nostalgia: item.genre === "nostalgia" || item.genre === "before_after" ? 86 : 68, surprise: item.genre === "surprise" || item.genre === "one_line_punch" ? 85 : 69, empathy: item.genre === "empathy" || item.genre === "personal_story" ? 88 : 70, controversy: item.genre === "controversy" || item.genre === "unpopular_opinion" || item.genre === "hot_take" ? 86 : 58, commentability: item.genre === "comment_bait" || item.genre === "controversy" ? 92 : 78, total },
    totalScore: total,
    internal: { domain: topic.domain, source_topic: topic.topic, writer: "scene-engine-v1" }
  };
  const draft = { id: crypto.randomUUID(), persona, domain: topic.domain, genre: item.genre, angle_type: item.label, angleType: item.label, buzz_elements: buzzElements, buzzElements, scene_strength: sceneScore, sceneStrength: sceneScore, why_it_may_spread: why, whyItMaySpread: why, post_text: postText, postText, text: postText, hook: detail.hook, body: detail.body, closing_line: scene.comment_invitation, closingLine: scene.comment_invitation, comment_bait: scene.comment_invitation, commentBait: scene.comment_invitation, cta: scene.comment_invitation, emotional_trigger: item.trigger, emotionalTrigger: item.trigger, viral_score: total, viralScore: detail.viralScore, source_ids: [], sourceIds: [], category: topic.domain, hookType: item.genre, score: total, scoreTotal: total, totalScore: total, scoreDetail: detail, sourceTrace: [] };
  const reason = rejectReason(draft, scene);
  if (reason) draft.rejectedBySceneEngine = reason;
  return draft;
}

function isUsablePost(draft) {
  const text = draft.post_text || draft.postText || draft.text || "";
  if (draft.rejectedBySceneEngine) return false;
  if (sceneScoreFromDraft(draft) < 70) return false;
  if (countJapaneseChars(text) < 50 || countJapaneseChars(text) > 230) return false;
  if (/https?:\/\/|www\./.test(text)) return false;
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  const hasBadPhrase = BAD_PUBLIC_PHRASES.test(text);
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return !hasBadPhrase;
}

function diversify(posts) {
  const selected = [];
  const seenDomains = new Map();
  const seenGenres = new Set();
  const canUseDomain = (post) => (seenDomains.get(post.domain || post.category || "general") || 0) < 2;
  const rememberDomain = (post) => {
    const domain = post.domain || post.category || "general";
    seenDomains.set(domain, (seenDomains.get(domain) || 0) + 1);
  };

  for (const post of posts.sort((a, b) => sceneScoreFromDraft(b) - sceneScoreFromDraft(a))) {
    if (!isUsablePost(post)) continue;
    if (!canUseDomain(post)) continue;
    if (seenGenres.has(post.genre)) continue;
    selected.push(post);
    seenGenres.add(post.genre);
    rememberDomain(post);
    if (selected.length >= 10) break;
  }
  for (const post of posts.sort((a, b) => ((b.totalScore || 0) + sceneScoreFromDraft(b) * 0.2) - ((a.totalScore || 0) + sceneScoreFromDraft(a) * 0.2))) {
    if (selected.includes(post) || !isUsablePost(post)) continue;
    if (!canUseDomain(post)) continue;
    selected.push(post);
    rememberDomain(post);
    if (selected.length >= 10) break;
  }
  return selected.slice(0, 10);
}

export function rewriteDraftsToThreadsNative(drafts, researchId, options = {}) {
  const topics = marketTopicsFromDrafts(Array.isArray(drafts) ? drafts : [], options);
  const genres = selectGenres(options);
  const posts = [];
  const count = Math.max(14, Math.min(20, genres.length + topics.length));
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
