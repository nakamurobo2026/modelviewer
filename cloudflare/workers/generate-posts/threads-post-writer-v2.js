const GENRE_TAXONOMY = [
  { genre: "empathy", label: "共感", angle_type: "shared feeling", trigger: "empathy", buzz_elements: ["あるある", "気持ちの代弁", "コメント余白"], score: 84 },
  { genre: "nostalgia", label: "懐かしさ", angle_type: "memory recall", trigger: "nostalgia", buzz_elements: ["昭和感", "記憶", "保存したくなる"], score: 82 },
  { genre: "curiosity", label: "好奇心", angle_type: "small mystery", trigger: "curiosity", buzz_elements: ["なぜ感", "違和感", "続きを考えたくなる"], score: 83 },
  { genre: "surprise", label: "驚き", angle_type: "unexpected shift", trigger: "surprise", buzz_elements: ["意外性", "見方の反転", "発見"], score: 81 },
  { genre: "controversy", label: "賛否", angle_type: "soft disagreement", trigger: "controversy", buzz_elements: ["賛否", "価値観", "語りたくなる"], score: 80 },
  { genre: "personal_story", label: "個人体験", angle_type: "first person memory", trigger: "empathy", buzz_elements: ["自分語り", "生活感", "人間味"], score: 79 },
  { genre: "local_culture", label: "地元文化", angle_type: "regional identity", trigger: "local observation", buzz_elements: ["地元性", "地域共有", "ローカル拡散"], score: 85 },
  { genre: "one_line_punch", label: "一言パンチ", angle_type: "compressed punch", trigger: "surprise", buzz_elements: ["短文", "刺さる一言", "引用されやすい"], score: 78 },
  { genre: "comment_bait", label: "コメント誘発", angle_type: "open loop", trigger: "comment bait", buzz_elements: ["答えたくなる", "経験募集", "余白"], score: 86 },
  { genre: "creator_process", label: "制作過程", angle_type: "behind the note", trigger: "creator point of view", buzz_elements: ["観察メモ", "作り手視点", "過程"], score: 77 },
  { genre: "failure_story", label: "失敗談", angle_type: "small regret", trigger: "empathy", buzz_elements: ["失敗", "反省", "人間味"], score: 80 },
  { genre: "before_after", label: "Before/After", angle_type: "contrast", trigger: "surprise", buzz_elements: ["変化", "比較", "保存性"], score: 82 },
  { genre: "unpopular_opinion", label: "逆張り", angle_type: "unpopular opinion", trigger: "controversy", buzz_elements: ["少数派", "賛否", "反応"], score: 81 },
  { genre: "micro_observation", label: "微細観察", angle_type: "tiny scene", trigger: "curiosity", buzz_elements: ["細部", "情景", "分かる感"], score: 84 },
  { genre: "weird_gap", label: "変なズレ", angle_type: "weird gap", trigger: "curiosity", buzz_elements: ["違和感", "ズレ", "不思議"], score: 83 }
];

const CATEGORY_TO_GENRES = {
  "自動ミックス": [],
  Auto: [],
  "共感": ["empathy", "personal_story", "failure_story", "micro_observation"],
  "懐かしさ": ["nostalgia", "before_after", "local_culture", "personal_story"],
  "違和感": ["weird_gap", "curiosity", "micro_observation", "surprise"],
  "賛否": ["controversy", "unpopular_opinion", "before_after", "comment_bait"],
  "驚き": ["surprise", "curiosity", "before_after", "weird_gap"],
  "あるある": ["empathy", "micro_observation", "comment_bait", "local_culture"],
  "失敗談": ["failure_story", "personal_story", "empathy", "creator_process"],
  "制作過程": ["creator_process", "micro_observation", "curiosity", "one_line_punch"],
  "一言パンチ": ["one_line_punch", "weird_gap", "unpopular_opinion", "surprise"],
  "コメント誘発": ["comment_bait", "controversy", "empathy", "weird_gap"],
  "地元文化": ["local_culture", "nostalgia", "empathy", "micro_observation"],
  "Before / After": ["before_after", "nostalgia", "surprise", "controversy"],
  "Before/After": ["before_after", "nostalgia", "surprise", "controversy"],
  "炎上注意": ["unpopular_opinion", "controversy", "comment_bait", "before_after"]
};

const PERSONA_PROFILES = {
  "違和感ハンター": { suffix: "あの小さいズレ、見逃せない。", tone: "違和感を見つける観察者", prefer: ["weird_gap", "curiosity", "micro_observation"] },
  "地元あるある職人": { suffix: "地元の人だけ、たぶん分かる。", tone: "地域の共通体験", prefer: ["local_culture", "empathy", "comment_bait"] },
  "昭和ノスタルジー語り": { suffix: "古い光って、記憶まで連れてくる。", tone: "懐かしさと色温度", prefer: ["nostalgia", "before_after", "personal_story"] },
  "炎上しない賛否メーカー": { suffix: "好き嫌いが分かれるけど、少し分かる。", tone: "安全な賛否", prefer: ["controversy", "unpopular_opinion", "before_after"] },
  "深夜ラジオの独白": { suffix: "深夜にだけ言える話として。", tone: "独り言と余白", prefer: ["personal_story", "empathy", "weird_gap"] },
  "町の観察者": { suffix: "町はたまに、音で表情を変える。", tone: "町の細部観察", prefer: ["micro_observation", "local_culture", "curiosity"] },
  "職人の裏側語り": { suffix: "作る側になると、こういう細部ばかり残る。", tone: "制作過程", prefer: ["creator_process", "micro_observation", "one_line_punch"] },
  "失敗談コレクター": { suffix: "こういう小さい失敗ほど、あとで残る。", tone: "失敗と人間味", prefer: ["failure_story", "personal_story", "empathy"] },
  "一言パンチ職人": { suffix: "短いけど、これで十分な気がする。", tone: "短文の切れ味", prefer: ["one_line_punch", "weird_gap", "unpopular_opinion"] },
  "コメント誘発屋": { suffix: "似た場所、思い出した人いそう。", tone: "コメント余白", prefer: ["comment_bait", "empathy", "controversy"] }
};

const BAD_PUBLIC_PHRASES = /調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO|信頼度|取得元|source|research|reliability|score|viralScore|totalScore|source_ids/gi;

function stripBadPhrases(value) {
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  const cleaned = String(value || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/www\.\S+/g, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(BAD_PUBLIC_PHRASES, "")
    .replace(/[{}[\]"]+/g, "")
    .replace(/\b(scoreDetail|hookScore|commentScore|saveScore|shareScore|research_summary|sources|reasoning)\b\s*:?\s*\d*/gi, "")
    .replace(/^\s*(?:[-*・]|\d+[.)、])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return cleaned;
}

function pickFirst(material, patterns, fallback) {
  for (const pattern of patterns) {
    const found = material.match(pattern)?.[0];
    if (found) return found;
  }
  return fallback;
}

function observationFromDrafts(drafts) {
  const material = drafts.map((draft) => `${draft.title || ""} ${draft.hook || ""} ${draft.body || ""} ${draft.cta || ""} ${draft.text || ""}`).join(" ");
  return {
    place: pickFirst(material, [/(地方スーパー|スーパー|商店街|駅前|道の駅|個人店|喫茶店|ドラッグストア|ホームセンター|市役所|地方駅|古い病院|学校|閉店する店|昔からある店|公民館|団地|古い店)/], "スーパー"),
    time: pickFirst(material, [/(閉店前|17時過ぎ|夕方|夜|深夜|雨の日|最後の日|平日の昼過ぎ|朝の開店直後|昼休み後)/], "閉店前"),
    sound: pickFirst(material, [/(レジ音|BGM|店内放送|蛍光灯|台車の音|自動ドア|雨の音|冷蔵ケースの音|チャイム|足音)/], "レジの音"),
    object: pickFirst(material, [/(棚|駐車場|看板|惣菜売り場|入口|袋詰め台|通路|空き店舗|木材売り場|ガラス戸|値引きシール|ベンチ|掲示板)/], "棚"),
    people: pickFirst(material, [/(店員|常連|学生|お年寄り|親子|誰もいない|人が少ない|近所の人)/], "人が少ない"),
    sourceText: stripBadPhrases(material).slice(0, 320)
  };
}

function countJapaneseChars(value) {
  return [...String(value || "")].length;
}

function compactToLimit(text, max = 220) {
  if (countJapaneseChars(text) <= max) return text;
  const sentences = text.split(/(?<=[。])/).filter(Boolean);
  let output = "";
  for (const sentence of sentences) {
    if (countJapaneseChars(output + sentence) > max) break;
    output += sentence;
  }
  return output || [...text].slice(0, max - 1).join("") + "。";
}

function padIfTooShort(text, closing) {
  if (countJapaneseChars(text) >= 80) return text;
  return `${text} ${closing}`.trim();
}

function genreBoost(genre, options) {
  let boost = 0;
  if (options?.prioritizeCommentability && ["comment_bait", "controversy", "empathy", "unpopular_opinion"].includes(genre)) boost += 6;
  if (options?.prioritizeSaveability && ["nostalgia", "before_after", "creator_process", "micro_observation"].includes(genre)) boost += 5;
  if (options?.prioritizeLocalShareability && ["local_culture", "nostalgia", "empathy", "weird_gap"].includes(genre)) boost += 7;
  if (options?.strongStyle && ["one_line_punch", "weird_gap", "unpopular_opinion", "comment_bait"].includes(genre)) boost += 4;
  if (options?.safeMode && ["controversy", "unpopular_opinion"].includes(genre)) boost -= 4;
  return boost;
}

function selectGenres(options = {}) {
  const category = String(options.buzzCategory || "自動ミックス");
  const persona = PERSONA_PROFILES[options.persona] || null;
  const personaPreferred = persona?.prefer || [];
  if (options.mixAllGenres || category === "Auto" || category === "自動ミックス") {
    const preferred = personaPreferred.map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
    const rest = GENRE_TAXONOMY.filter((item) => !personaPreferred.includes(item.genre));
    return [...preferred, ...rest];
  }
  const categoryPreferred = CATEGORY_TO_GENRES[category] || [];
  const merged = [...new Set([...personaPreferred, ...categoryPreferred])];
  const preferredItems = merged.map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
  const rest = GENRE_TAXONOMY.filter((item) => !merged.includes(item.genre));
  return [...preferredItems, ...rest];
}

function buildTextForGenre(item, observation) {
  const { place, time, sound, object, people } = observation;
  const templates = {
    empathy: `${time}の${place}で${sound}だけ聞こえると、急に店全体が終わりに向かってる感じがする。急かされてないのに、こっちまで少し早く帰りたくなる。こういうの、説明しづらい。`,
    nostalgia: `${place}の${object}って、${time}になると急に昔の色に戻る瞬間がある。${sound}の残り方まで古くて、買い物してるだけなのに子どもの頃の記憶が少し混ざる。`,
    curiosity: `${time}の${place}って、なぜか${object}の前だけ空気が変わる。${sound}は同じなのに、そこだけ少し別の店みたいに見える。あれ、何でなんだろう。`,
    surprise: `普通の${place}なのに、${time}になると一瞬だけ知らない場所みたいになる。${object}が広く見えて、${sound}だけ妙に近い。毎日ある景色ほど、急に顔が変わる。`,
    controversy: `${place}って便利になったはずなのに、${time}の${object}を見ると少し寂しくなる。整ってる店より、昔のごちゃっとした店の方が好きだった人もいそう。`,
    personal_story: `前に${time}の${place}で、${object}の前にしばらく立ってしまった。買う物は決まってたのに、${sound}だけ残る感じが妙に引っかかった。たぶんあの日だけじゃない。`,
    local_culture: `地元の${place}は、${time}になると商品より先に町の癖が出る。${people}の動きと${sound}だけで、今日の町の温度がだいたい分かる気がする。`,
    one_line_punch: `${time}の${place}、${object}より先に空気が片付いてる。${sound}だけ残ると、町の電源が少し落ちた感じがする。短いけど、あの感じだけ妙に本当。`,
    comment_bait: `${time}の${place}で${sound}だけ残るあの感じ、場所は違っても見たことある人いそう。${object}の前で一回止まる理由、自分でもよく分からない。`,
    creator_process: `こういう投稿を考える時、派手な出来事より${time}の${place}みたいな小さい場面の方が残る。${object}と${sound}だけで、なぜか一文になりそうな時がある。`,
    failure_story: `${place}で急いで買い物を済ませようとしたのに、${time}の${object}の前で止まってしまった。用事は終わったのに、${sound}だけ持って帰った感じがする。`,
    before_after: `${place}は昼間だと普通なのに、${time}になると別の場所に見える。${object}は同じ、${sound}も同じ。でも人の少なさだけで、景色の意味が変わる。`,
    unpopular_opinion: `正直、明るくて新しい店より、${time}の${place}みたいに少し古い空気が残ってる場所の方が落ち着く。便利さだけで消えない良さってある。`,
    micro_observation: `${time}の${place}、${object}の影だけ少し濃く見える時がある。${sound}は小さいのに、そこだけ妙に目立つ。誰も気にしてなさそうな細部ほど残る。`,
    weird_gap: `${place}の${object}だけ、${time}になると時間の進み方がズレて見える。${sound}は普通なのに、そこだけ一拍遅い。変と言うほどじゃないけど、ずっと気になる。`
  };
  return stripBadPhrases(templates[item.genre] || templates.micro_observation);
}

function applyPersonaTone(text, item, options = {}) {
  const personaName = options.persona || "町の観察者";
  const profile = PERSONA_PROFILES[personaName] || PERSONA_PROFILES["町の観察者"];
  let output = text;
  if (personaName === "一言パンチ職人") output = output.replace(/。/g, "。 ").split("。 ").slice(0, 2).join("。 ").trim();
  if (personaName === "深夜ラジオの独白") output = output.replace(/^/, "これ、夜中にふと思い出したんだけど。 ");
  if (personaName === "炎上しない賛否メーカー" && item.genre === "unpopular_opinion") output = output.replace(/^正直、/, "好み分かれるけど、");
  if (personaName === "職人の裏側語り" && item.genre !== "creator_process") output = `${output} 投稿にするなら、この小さい引っかかりを残したい。`;
  if (personaName === "コメント誘発屋" && item.genre !== "comment_bait") output = `${output} 似た場面、他にもありそう。`;
  if (options.strongStyle) output = output.replace(/気がする/g, "気がしてならない").replace(/少し/g, "妙に");
  if (options.safeMode) output = output.replace(/嫌い/g, "苦手").replace(/おかしい/g, "気になる").replace(/炎上/g, "反応が分かれる");
  return compactToLimit(padIfTooShort(stripBadPhrases(output), profile.suffix), 220);
}

function spreadReason(item, options = {}) {
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["町の観察者"];
  const reasons = {
    empathy: "自分の生活にも置き換えやすく、共感コメントが生まれやすい。",
    nostalgia: "記憶を刺激し、保存や思い出コメントにつながりやすい。",
    curiosity: "理由を考えたくなる余白があり、反応が分散しにくい。",
    surprise: "普通の景色の見方を反転させるため、引用されやすい。",
    controversy: "強すぎない賛否で、自分の好みを言いたくなる。",
    personal_story: "個人体験に見えるため、返信の心理的ハードルが低い。",
    local_culture: "地域差が出るため、地元の人が反応しやすい。",
    one_line_punch: "短く覚えやすく、スクショや引用に向いている。",
    comment_bait: "答えを断定せず、似た体験を集めやすい。",
    creator_process: "作り手目線に寄るため、同業者や発信者に刺さりやすい。",
    failure_story: "小さな失敗は人間味が出て、返信されやすい。",
    before_after: "変化が分かりやすく、保存して見返す理由がある。",
    unpopular_opinion: "安全な逆張りで、賛成と反対の両方を呼びやすい。",
    micro_observation: "細部の発見があり、分かる人だけが反応したくなる。",
    weird_gap: "言語化しにくいズレを代弁し、コメントで補足されやすい。"
  };
  return `${reasons[item.genre] || reasons.micro_observation} 文体: ${persona.tone}。`;
}

function buildPublicPost(item, observation, index, options) {
  const raw = applyPersonaTone(buildTextForGenre(item, observation), item, options);
  const closing = item.genre === "comment_bait" ? "似た場所を思い出した人、たぶんいる。" : item.buzz_elements[0];
  const postText = compactToLimit(padIfTooShort(raw, closing), 220);
  const hook = stripBadPhrases(postText.split("。")[0] + "。");
  const body = stripBadPhrases(postText.replace(hook, "").trim());
  const total = Math.max(0, Math.min(100, item.score + genreBoost(item.genre, options) + ((index * 3) % 7)));
  const why = spreadReason(item, options);
  const persona = options.persona || "町の観察者";
  const detail = {
    post_text: postText,
    hook,
    body,
    closing_line: closing,
    comment_bait: item.genre === "comment_bait" ? "自分の地元にもあるか言いたくなる" : item.buzz_elements.join(" / "),
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    persona,
    genre: item.genre,
    angle_type: item.angle_type,
    angleType: item.angle_type,
    buzz_elements: item.buzz_elements,
    buzzElements: item.buzz_elements,
    why_it_may_spread: why,
    whyItMaySpread: why,
    viral_score: total,
    viralScore: {
      curiosity: item.genre === "curiosity" || item.genre === "weird_gap" ? 86 : 70,
      nostalgia: item.genre === "nostalgia" || item.genre === "before_after" ? 86 : 68,
      surprise: item.genre === "surprise" || item.genre === "one_line_punch" ? 84 : 69,
      empathy: item.genre === "empathy" || item.genre === "personal_story" ? 86 : 70,
      controversy: item.genre === "controversy" || item.genre === "unpopular_opinion" ? 84 : 58,
      commentability: item.genre === "comment_bait" || item.genre === "controversy" ? 90 : 78,
      total
    },
    totalScore: total,
    internal: {
      research_summary: observation.sourceText,
      sources: [],
      scoring: { style: item.trigger, writer: "threads-post-writer-v3", persona, genre: item.genre, angle_type: item.angle_type },
      reasoning: "Generated from diversified genre taxonomy, persona tone, and Japanese UX controls."
    }
  };
  return {
    id: crypto.randomUUID(),
    persona,
    genre: item.genre,
    angle_type: item.angle_type,
    angleType: item.angle_type,
    buzz_elements: item.buzz_elements,
    buzzElements: item.buzz_elements,
    why_it_may_spread: why,
    whyItMaySpread: why,
    post_text: postText,
    postText,
    text: postText,
    hook,
    body,
    closing_line: closing,
    closingLine: closing,
    comment_bait: detail.comment_bait,
    commentBait: detail.comment_bait,
    cta: closing,
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    viral_score: total,
    viralScore: detail.viralScore,
    source_ids: [],
    sourceIds: [],
    category: "threads",
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
  if (countJapaneseChars(text) < 80 || countJapaneseChars(text) > 220) return false;
  if (/https?:\/\/|www\./.test(text)) return false;
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  const hasBadPhrase = BAD_PUBLIC_PHRASES.test(text);
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  if (hasBadPhrase) return false;
  if (/^\s*(?:[-*・]|\d+[.)、])\s+/m.test(text)) return false;
  return true;
}

function similarityKey(draft) {
  const text = draft.post_text || draft.text || "";
  const opening = text.slice(0, 18).replace(/[、。\s]/g, "");
  const conclusion = text.split("。").filter(Boolean).slice(-1)[0]?.slice(0, 18) || "";
  return `${draft.genre}:${opening}:${conclusion}`;
}

function diversify(posts) {
  const seenGenres = new Set();
  const seenOpenings = new Set();
  const selected = [];
  for (const post of posts) {
    const opening = (post.post_text || post.text || "").slice(0, 12).replace(/[、。\s]/g, "");
    if (seenGenres.has(post.genre)) continue;
    if (seenOpenings.has(opening)) continue;
    if (!isUsablePost(post)) continue;
    seenGenres.add(post.genre);
    seenOpenings.add(opening);
    selected.push(post);
    if (selected.length >= 10) break;
  }
  if (selected.length >= 10) return selected;
  const keys = new Set(selected.map(similarityKey));
  for (const post of posts) {
    const key = similarityKey(post);
    if (keys.has(key) || !isUsablePost(post)) continue;
    selected.push(post);
    keys.add(key);
    if (selected.length >= 10) break;
  }
  return selected.slice(0, 10);
}

export function rewriteDraftsToThreadsNative(drafts, researchId, options = {}) {
  const observation = observationFromDrafts(Array.isArray(drafts) ? drafts : []);
  const genres = selectGenres(options);
  const posts = genres.map((item, index) => {
    const post = buildPublicPost(item, observation, index, options);
    post.source_ids = [researchId].filter(Boolean);
    post.sourceIds = post.source_ids;
    post.sourceTrace = post.source_ids;
    post.scoreDetail.source_ids = post.source_ids;
    return post;
  });
  return diversify(posts);
}
