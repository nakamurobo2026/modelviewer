const GENRE_TAXONOMY = [
  { genre: "female_truth", label: "女の本音", trigger: "empathy", buzz_elements: ["女の本音", "共感", "余白"], score: 90 },
  { genre: "subtle_hint", label: "匂わせ", trigger: "curiosity", buzz_elements: ["匂わせ", "曖昧さ", "察してほしい"], score: 88 },
  { genre: "night_line", label: "夜のLINE", trigger: "empathy", buzz_elements: ["深夜", "LINE", "未読"], score: 89 },
  { genre: "green_or_red_flag", label: "脈あり脈なし", trigger: "curiosity", buzz_elements: ["脈あり脈なし", "判定", "返信速度"], score: 87 },
  { genre: "ex_memory", label: "元カレ元カノ", trigger: "nostalgia", buzz_elements: ["元カレ", "記憶", "未練"], score: 86 },
  { genre: "jealousy", label: "嫉妬", trigger: "controversy", buzz_elements: ["嫉妬", "ストーリー", "足跡"], score: 88 },
  { genre: "situationship", label: "都合のいい関係", trigger: "controversy", buzz_elements: ["曖昧な関係", "都合のよさ", "距離感"], score: 89 },
  { genre: "more_than_friends", label: "友達以上恋人未満", trigger: "empathy", buzz_elements: ["友達以上恋人未満", "境界線", "言えない"], score: 87 },
  { genre: "strong_girl", label: "強がり", trigger: "empathy", buzz_elements: ["強がり", "本音", "大丈夫じゃない"], score: 86 },
  { genre: "沼", label: "沼", trigger: "curiosity", buzz_elements: ["沼", "依存", "待ってしまう"], score: 88 },
  { genre: "romance_aruaru", label: "恋愛あるある", trigger: "empathy", buzz_elements: ["恋愛あるある", "分かる", "コメント余白"], score: 90 },
  { genre: "comment_bait", label: "コメント誘発", trigger: "comment bait", buzz_elements: ["コメント誘発", "経験募集", "賛否"], score: 91 },
  { genre: "adult_distance", label: "大人の距離感", trigger: "empathy", buzz_elements: ["大人の距離感", "寂しさ", "余裕のふり"], score: 87 },
  { genre: "sns_love", label: "SNSと恋愛", trigger: "surprise", buzz_elements: ["SNS", "恋愛", "承認欲求"], score: 86 }
];

const CATEGORY_TO_GENRES = {
  "自動ミックス": [], Auto: [],
  "女の本音": ["female_truth", "strong_girl", "adult_distance", "romance_aruaru"],
  "匂わせ": ["subtle_hint", "sns_love", "jealousy", "comment_bait"],
  "夜のLINE": ["night_line", "green_or_red_flag", "沼", "adult_distance"],
  "脈あり脈なし": ["green_or_red_flag", "comment_bait", "night_line", "female_truth"],
  "元カレ元カノ": ["ex_memory", "nostalgia", "sns_love", "strong_girl"],
  "嫉妬": ["jealousy", "sns_love", "controversy", "female_truth"],
  "都合のいい関係": ["situationship", "adult_distance", "strong_girl", "comment_bait"],
  "友達以上恋人未満": ["more_than_friends", "subtle_hint", "night_line", "comment_bait"],
  "強がり": ["strong_girl", "female_truth", "adult_distance", "empathy"],
  "沼": ["沼", "night_line", "situationship", "green_or_red_flag"],
  "恋愛あるある": ["romance_aruaru", "female_truth", "comment_bait", "green_or_red_flag"],
  "賛否": ["situationship", "jealousy", "comment_bait", "adult_distance"],
  "コメント誘発": ["comment_bait", "green_or_red_flag", "romance_aruaru", "situationship"]
};

const PERSONA_PROFILES = {
  "匂わせ女子": { tone: "短く曖昧。説明しすぎず、気づいてほしい余白を残す", prefer: ["subtle_hint", "sns_love", "adult_distance"] },
  "夜更かし女子": { tone: "深夜の弱さと鋭さ。やわらかいけど刺さる", prefer: ["night_line", "沼", "strong_girl"] },
  "恋愛相談室のお姉さん": { tone: "落ち着いた経験値。責めずに関係性の本質を見る", prefer: ["female_truth", "adult_distance", "comment_bait"] },
  "元カレ研究家": { tone: "未練を笑える距離で観察する", prefer: ["ex_memory", "sns_love", "strong_girl"] },
  "本音を言わない女": { tone: "言えない本音を短く漏らす", prefer: ["female_truth", "subtle_hint", "more_than_friends"] },
  "強がり女子": { tone: "大丈夫なふりの裏にある弱さ", prefer: ["strong_girl", "night_line", "adult_distance"] },
  "重くならない毒舌女子": { tone: "軽く毒を混ぜる。攻撃的にはしない", prefer: ["green_or_red_flag", "situationship", "comment_bait"] },
  "恋愛あるある収集家": { tone: "あるあるを自然に置く。決めつけない", prefer: ["romance_aruaru", "female_truth", "comment_bait"] },
  "返信速度分析女子": { tone: "返信速度と温度差を観察する", prefer: ["green_or_red_flag", "night_line", "沼"] },
  "脈なし判定女子": { tone: "現実を見るけど冷たすぎない", prefer: ["green_or_red_flag", "situationship", "comment_bait"] },
  "沼らせ観察女子": { tone: "沼る瞬間を少し引いて見る", prefer: ["沼", "subtle_hint", "jealousy"] },
  "大人の距離感女子": { tone: "近づきすぎない寂しさ。静かな恋愛心理", prefer: ["adult_distance", "situationship", "female_truth"] }
};

const COHERENT_SCENE_CARDS = [
  { domain: "恋愛", topic: "夜中だけ優しい人", scene_lines: ["深夜1時のLINE画面。", "青白い通知だけがベッドの上で光っている。", "女の子が返事を打って、送信前に一度だけ消している。"], object: "青白い通知", human_action: "女の子が返事を打って、送信前に一度だけ消している", emotion: "優しいのに、朝にはなかったことにされそうで少し寂しい", meaning: "夜中の優しさって、約束じゃなくて気分のこともある", comment_question: "朝になっても同じ温度でいてくれる人、どれくらいいるんだろう" },
  { domain: "返信速度", topic: "返信遅いのにストーリーは見てる", scene_lines: ["ベッドの上のスマホ。", "未読のLINEの横で、ストーリーの足跡だけが増えている。", "女の子が画面を閉じて、またすぐ開いている。"], object: "ストーリーの足跡", human_action: "女の子が画面を閉じて、またすぐ開いている", emotion: "見てるなら返せるでしょ、って思う自分が少し嫌になる", meaning: "返信より先に足跡が来ると、距離感だけはっきり見える", comment_question: "これ、気にしないでいられる人いる？" },
  { domain: "脈あり脈なし", topic: "即レスと未読の温度差", scene_lines: ["夜のキッチン。", "冷めたマグカップの横でスマホが伏せられている。", "女の子が通知音のたびに、関係ないアプリまで確認している。"], object: "冷めたマグカップ", human_action: "女の子が通知音のたびに、関係ないアプリまで確認している", emotion: "期待してないふりをしてる時ほど、期待してる", meaning: "脈ありかどうかって、相手より自分の待ち方に出る", comment_question: "待ってる時点で、もう負けてる気がする時ない？" },
  { domain: "元カレ元カノ", topic: "元カレの匂わせ投稿", scene_lines: ["帰り道の駅のホーム。", "元カレの新しい投稿が画面に残っている。", "女の子が見なかったふりでスクロールして、結局もう一回戻っている。"], object: "元カレの新しい投稿", human_action: "女の子が見なかったふりでスクロールして、結局もう一回戻っている", emotion: "もう関係ないはずなのに、知らない女の影だけは分かる", meaning: "忘れたかどうかは、名前じゃなくて指の戻り方に出る", comment_question: "見なきゃいいのに見る投稿、あるよね" },
  { domain: "匂わせ", topic: "見てほしい人にだけ届いてほしい投稿", scene_lines: ["夜の部屋。", "消した下書きがスマホのメモに残っている。", "女の子が言えなかった一言の代わりに、何でもないストーリーを上げている。"], object: "消した下書き", human_action: "女の子が言えなかった一言の代わりに、何でもないストーリーを上げている", emotion: "みんなに見せてるふりで、一人だけに気づいてほしい", meaning: "匂わせって、言えない本音のいちばん安全な置き場所かもしれない", comment_question: "見てほしい人ほど、直接送れないのなんでだろう" },
  { domain: "嫉妬", topic: "いいね欄で知る距離感", scene_lines: ["深夜の布団の中。", "相手のいいね欄だけがやけに明るく見える。", "女の子が知らない名前を見つけて、何も起きてないのに胸がざわついている。"], object: "相手のいいね欄", human_action: "女の子が知らない名前を見つけて、何も起きてないのに胸がざわついている", emotion: "責めるほどじゃないのに、平気なふりもできない", meaning: "嫉妬って証拠より、想像の方が先に刺さる", comment_question: "見なきゃいい場所ほど見ちゃうの、あれ何" },
  { domain: "友達以上恋人未満", topic: "言えない関係の帰り道", scene_lines: ["終電前の改札。", "渡せなかったコンビニの袋が手元に残っている。", "女の子がまたねだけ言って、少しだけ振り返っている。"], object: "渡せなかったコンビニの袋", human_action: "女の子がまたねだけ言って、少しだけ振り返っている", emotion: "好きって言ったら終わりそうで、友達のふりをしてる", meaning: "曖昧な関係は、進まないんじゃなくて壊さないように止まってる時がある", comment_question: "友達以上って、どこから恋人未満になるんだろう" },
  { domain: "都合のいい関係", topic: "会いたい時だけ来る連絡", scene_lines: ["金曜の夜のLINE画面。", "短い『今なにしてる？』だけが通知に残っている。", "女の子が返事を打つ前に、前回泣いた日を思い出している。"], object: "短い『今なにしてる？』", human_action: "女の子が返事を打つ前に、前回泣いた日を思い出している", emotion: "分かってるのに、まだ期待してしまう自分がいる", meaning: "都合よく扱われてる時ほど、優しさの一回が重くなる", comment_question: "分かってるのに返したこと、ある？" },
  { domain: "片思い", topic: "送れなかった一言", scene_lines: ["夜中のトーク画面。", "入力欄に『会いたい』だけが残っている。", "女の子が送信ボタンの手前で止まって、全部消している。"], object: "『会いたい』の一言", human_action: "女の子が送信ボタンの手前で止まって、全部消している", emotion: "重いと思われたくなくて、本音だけいつも下書きになる", meaning: "言えない言葉ほど、こっちの中では何回も送ってる", comment_question: "送らなかったLINEの方が、長く残ることない？" },
  { domain: "承認欲求", topic: "好きな人だけに見てほしいSNS", scene_lines: ["夜の洗面台。", "撮り直した自撮りがカメラロールに何枚も残っている。", "女の子が投稿ボタンを押す前に、あの人が見る時間だけ考えている。"], object: "撮り直した自撮り", human_action: "女の子が投稿ボタンを押す前に、あの人が見る時間だけ考えている", emotion: "みんなに褒められたいんじゃなくて、一人に気づかれたい", meaning: "承認欲求って、人数じゃなくて相手が決まってる時がある", comment_question: "誰に見られたいかまで決まってる投稿、あるよね" },
  { domain: "大人の距離感", topic: "踏み込まない優しさ", scene_lines: ["雨上がりの帰り道。", "濡れた傘が駅の壁に立てかけられている。", "女の子が聞きたいことを飲み込んで、今日はありがとうだけ送っている。"], object: "濡れた傘", human_action: "女の子が聞きたいことを飲み込んで、今日はありがとうだけ送っている", emotion: "大人っぽく見える距離感ほど、本当は我慢でできてる", meaning: "踏み込まない優しさと、踏み込めない寂しさは似ている", comment_question: "大人の恋愛って、言わないこと増えすぎない？" },
  { domain: "人間関係", topic: "女友達への嫉妬", scene_lines: ["カフェのテーブル。", "友達のスマホに届いた通知だけがちらっと見える。", "女の子が笑いながら、聞きたいことを聞かずにストローを回している。"], object: "友達のスマホ通知", human_action: "女の子が笑いながら、聞きたいことを聞かずにストローを回している", emotion: "仲良いからこそ、比べちゃう自分を見せたくない", meaning: "女同士の距離感は、好きと嫉妬が同じ場所に置かれる時がある", comment_question: "友達なのに少し苦しくなる瞬間、ない？" },
  { domain: "恋愛あるある", topic: "好きじゃない人からの即レス", scene_lines: ["昼休みのスマホ画面。", "好きじゃない人からの即レスが通知欄に並んでいる。", "女の子がその通知を見ながら、好きな人の未読だけ何度も確認している。"], object: "好きじゃない人からの即レス", human_action: "女の子がその通知を見ながら、好きな人の未読だけ何度も確認している", emotion: "欲しい優しさだけ、なかなか欲しい場所から来ない", meaning: "恋愛って、量より相手で全部変わる", comment_question: "即レスがうれしいかどうか、相手次第すぎる" },
  { domain: "沼", topic: "既読だけで機嫌が変わる", scene_lines: ["朝の電車。", "既読だけついたトーク画面が膝の上で光っている。", "女の子が返信は来てないのに、少しだけ口角を戻している。"], object: "既読だけついたトーク画面", human_action: "女の子が返信は来てないのに、少しだけ口角を戻している", emotion: "返事じゃないのに、見てくれた事実だけで今日が少し持つ", meaning: "沼って、幸せの基準がどんどん低くなる", comment_question: "既読だけで安心したこと、ある？" },
  { domain: "浮気疑惑", topic: "スマホを伏せる瞬間", scene_lines: ["二人でいるテーブル。", "伏せられたスマホがコップの横に置かれている。", "女の子が何も言わずに、その置き方だけ覚えている。"], object: "伏せられたスマホ", human_action: "女の子が何も言わずに、その置き方だけ覚えている", emotion: "証拠はないのに、空気だけ先に変わる", meaning: "疑いって、見たものより見せなかったものから始まる", comment_question: "スマホの置き方で察する瞬間、あるよね" }
];

const BAD_PUBLIC_PHRASES = /調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO|信頼度|取得元|source|research|reliability|score|viralScore|totalScore|source_ids/gi;
const UNSAFE_ROMANCE = /未成年|中学生|高校生|児童|裸|性器|性交|セックス|レイプ|強姦|無理やり|脅し|監禁|盗撮|痴漢|暴力|殴|殺|自殺|死ね|ブス|デブ|消えろ/i;

function stripBadPhrases(value) {
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return String(value || "").replace(/https?:\/\/\S+/g, "").replace(/www\.\S+/g, "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(BAD_PUBLIC_PHRASES, "").replace(/[{}[\]"]+/g, "").replace(/^\s*(?:[-*・]|\d+[.)、])\s+/gm, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function countJapaneseChars(value) { return [...String(value || "")].length; }
function compactToLimit(text, max = 180) {
  const chars = [...String(text || "")];
  if (chars.length <= max) return text;
  const sliced = chars.slice(0, max - 1).join("");
  const lastBreak = Math.max(sliced.lastIndexOf("。"), sliced.lastIndexOf("？"), sliced.lastIndexOf("\n"));
  return (lastBreak > 80 ? sliced.slice(0, lastBreak + 1) : sliced) || sliced;
}
function scoreBoost(genre, options = {}) {
  let boost = 0;
  if (options.prioritizeCommentability && ["comment_bait", "green_or_red_flag", "romance_aruaru", "situationship"].includes(genre)) boost += 8;
  if (options.prioritizeSaveability && ["female_truth", "adult_distance", "ex_memory"].includes(genre)) boost += 4;
  if (options.strongStyle && ["重くならない毒舌女子", "脈なし判定女子"].includes(options.persona)) boost += 5;
  if (options.safeMode && ["jealousy", "situationship"].includes(genre)) boost -= 2;
  return boost;
}
function selectGenres(options = {}) {
  const category = String(options.buzzCategory || "自動ミックス");
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["匂わせ女子"];
  const categoryPreferred = CATEGORY_TO_GENRES[category] || [];
  const personaPreferred = persona?.prefer || [];
  const first = [...new Set([...categoryPreferred, ...personaPreferred])];
  const rest = GENRE_TAXONOMY.map((item) => item.genre).filter((genre) => !first.includes(genre));
  return [...first, ...rest].map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
}
function sceneCardsFromDrafts(drafts, options = {}) {
  const material = stripBadPhrases((drafts || []).map((draft) => `${draft.title || ""} ${draft.text || ""} ${draft.body || ""} ${draft.category || ""}`).join(" "));
  if (!material || String(options.buzzCategory || "自動ミックス") === "自動ミックス") return COHERENT_SCENE_CARDS;
  const matched = COHERENT_SCENE_CARDS.filter((card) => [card.domain, card.topic, card.object, card.meaning].some((value) => material.includes(String(value).slice(0, 5))));
  return matched.length ? [...matched, ...COHERENT_SCENE_CARDS.filter((card) => !matched.includes(card))] : COHERENT_SCENE_CARDS;
}

function buildScene(sceneCard) {
  const sceneText = sceneCard.scene_lines.join("\n");
  return { ...sceneCard, scene: sceneText, place: sceneCard.scene_lines[0].replace(/[。\s]+$/g, ""), human_behavior: sceneCard.human_action, comment_invitation: sceneCard.comment_question, observation: `${sceneCard.object}に、${sceneCard.emotion}。` };
}

function sceneStrength(scene, text) {
  let score = 0;
  if (scene.scene_lines?.length >= 3 && scene.scene_lines.every(Boolean)) score += 18;
  if (scene.object && text.includes(scene.object)) score += 22;
  if (scene.human_action && text.includes(scene.human_action)) score += 24;
  if (scene.emotion && text.includes(scene.emotion)) score += 14;
  if (scene.meaning && text.includes(scene.meaning)) score += 12;
  if (scene.comment_question && text.includes(scene.comment_question)) score += 10;
  return Math.max(0, Math.min(100, score));
}

function clamp100(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function maleAttentionScores(item, scene, text, options = {}) {
  const genre = item.genre || "female_truth";
  const persona = String(options.persona || "匂わせ女子");
  const mysteryHits = (text.match(/匂わせ|言えない|気づいて|見てほしい|曖昧|未読|足跡|送れなかった|消した|伏せられた|夜中|深夜|続き|分からない|気になる/g) || []).length;
  const attractionHits = (text.match(/好き|会いたい|優しい|帰したくない|嫉妬|期待|沼|距離感|本音|弱い|待てる|雑な人|気分|温度差/g) || []).length;
  const commentHits = (text.match(/ある？|あるよね|いる？|ない？|なんで|どれくらい|気にしないでいられる|分からない/g) || []).length;
  const genreBoost = ["subtle_hint", "night_line", "green_or_red_flag", "jealousy", "situationship", "沼", "comment_bait", "sns_love"].includes(genre) ? 10 : 4;
  const personaBoost = /匂わせ|夜更かし|本音|強がり|毒舌|返信速度|脈なし|沼らせ|大人の距離感/.test(persona) ? 8 : 4;
  const ambiguityBoost = /言い切らない|曖昧|匂わせ|余白|気づいて/.test(`${persona} ${text}`) ? 8 : 2;
  const safetyPenalty = UNSAFE_ROMANCE.test(text) ? 100 : 0;

  const male_attention_score = clamp100(48 + genreBoost + personaBoost + ambiguityBoost + mysteryHits * 5 + attractionHits * 3 - safetyPenalty);
  const dm_trigger_score = clamp100(42 + genreBoost + mysteryHits * 5 + (/DM|返信|LINE|会いたい|気づいて|見てほしい|帰したくない/.test(text) ? 10 : 0) + (/直接|送れない|言えない/.test(text) ? 8 : 0) - safetyPenalty);
  const comment_trigger_score = clamp100(45 + commentHits * 10 + (genre === "comment_bait" ? 14 : 0) + (/あるよね|いる？|ない？|なんで/.test(text) ? 9 : 0) - safetyPenalty);
  return { male_attention_score, dm_trigger_score, comment_trigger_score };
}

function buildTextForGenre(item, scene) {
  const intro = {
    female_truth: `${scene.scene}\n\n${scene.emotion}。${scene.meaning}。`,
    subtle_hint: `${scene.scene}\n\n${scene.emotion}。言わないだけで、ちゃんと見てほしい人はいる。`,
    night_line: `${scene.scene}\n\n${scene.emotion}。夜のLINEって、言葉より温度が残る。`,
    green_or_red_flag: `${scene.scene}\n\n${scene.emotion}。脈ありかどうかって、返事の速さより待たされ方に出る。`,
    ex_memory: `${scene.scene}\n\n${scene.emotion}。もう終わったはずの人ほど、変なところで現在形になる。`,
    jealousy: `${scene.scene}\n\n${scene.emotion}。嫉妬って、証拠より想像の方が先に刺さる。`,
    situationship: `${scene.scene}\n\n${scene.emotion}。曖昧な関係って、優しさ一回でまた戻される。`,
    more_than_friends: `${scene.scene}\n\n${scene.emotion}。友達のふりって、好きより難しい日がある。`,
    strong_girl: `${scene.scene}\n\n${scene.emotion}。大丈夫って言う時ほど、全然大丈夫じゃない。`,
    "沼": `${scene.scene}\n\n${scene.emotion}。沼って、うれしいの基準がどんどん低くなる。`,
    romance_aruaru: `${scene.scene}\n\n${scene.emotion}。恋愛あるあるって笑えるけど、当事者の時だけ全然笑えない。`,
    comment_bait: `${scene.scene}\n\n${scene.emotion}。これ、気にする側が重いのか、気にさせる側がずるいのか分からない。`,
    adult_distance: `${scene.scene}\n\n${scene.emotion}。大人の距離感って、余裕じゃなくて我慢でできてる時がある。`,
    sns_love: `${scene.scene}\n\n${scene.emotion}。SNSで恋愛すると、見なくていいものまで見えてしまう。`
  };
  return stripBadPhrases(`${intro[item.genre] || intro.female_truth}\n\n${scene.comment_question}`);
}

function applyPersonaTone(text, item, options = {}) {
  const personaName = options.persona || "匂わせ女子";
  let output = text;
  if (personaName === "匂わせ女子") output = output.replace(/これ、/g, "たぶん、").replace(/分からない。/g, "分からないままにしてる。");
  if (personaName === "夜更かし女子") output = `夜中ってさ。\n\n${output}`;
  if (personaName === "恋愛相談室のお姉さん") output = output.replace(/ずるい/g, "誠実ではない").replace(/重い/g, "少し苦しい");
  if (personaName === "元カレ研究家") output = output.replace(/もう終わったはずの人/g, "元カレ");
  if (personaName === "本音を言わない女") output = output.replace(/見てほしい/g, "気づいてほしい").replace(/言葉/g, "言えないこと");
  if (personaName === "強がり女子") output = output.replace(/寂しい/g, "平気なふりしてるだけで寂しい");
  if (personaName === "重くならない毒舌女子") output = output.replace(/ずるい/g, "まあまあずるい").replace(/待ってる/g, "待ってる自分もだいぶ面白い");
  if (personaName === "返信速度分析女子") output = output.replace(/返事/g, "返信").replace(/待たされ方/g, "返信速度のムラ");
  if (personaName === "脈なし判定女子") output = output.replace(/脈ありかどうか/g, "脈なしって分かる瞬間");
  if (personaName === "沼らせ観察女子") output = output.replace(/沼って/g, "沼らされる時って");
  if (personaName === "大人の距離感女子") output = output.replace(/好き/g, "大事").replace(/恋愛/g, "大人の恋愛");
  if (options.strongStyle) output = output.replace(/少し/g, "ちゃんと").replace(/気がする/g, "気がしてしまう");
  if (options.safeMode) output = output.replace(/ずるい/g, "曖昧").replace(/毒/g, "本音");
  return stripBadPhrases(output);
}

function validateSceneCoherence(draft) {
  const scene = draft.scene || draft.scoreDetail?.scene || {};
  const text = draft.post_text || draft.postText || draft.text || "";
  if (!scene.object || !text.includes(scene.object)) return { ok: false, reason: "missing_scene_object" };
  if (!scene.human_action || !text.includes(scene.human_action)) return { ok: false, reason: "missing_scene_human_action" };
  if (scene.domain !== draft.domain) return { ok: false, reason: "domain_mismatch" };
  if (/前で[\s\S]*前で/.test(text)) return { ok: false, reason: "duplicated_location_grammar" };
  if (!scene.comment_question || !text.includes(scene.comment_question)) return { ok: false, reason: "unrelated_comment_question" };
  return { ok: true, reason: "" };
}

function rejectReason(draft) {
  const text = draft.post_text || draft.text || "";
  if (UNSAFE_ROMANCE.test(text)) return "unsafe_romance_content";
  const coherence = validateSceneCoherence(draft);
  if (!coherence.ok) return coherence.reason;
  if (!/(寂し|好き|嫉妬|未読|返信|元カレ|匂わせ|脈|沼|会いたい|大丈夫|距離|優し|期待|本音|恋愛|大人)/.test(text)) return "missing_romance_tension";
  if (!/(ある？|よね|なんで|どれくらい|ない？|分からない|だろう)/.test(text)) return "missing_comment_space";
  const chars = countJapaneseChars(text);
  if (chars < 55 || chars > 190) return "length_outside_romance_target";
  return "";
}

function spreadReason(item, scene, sceneScore, options = {}, maleScores = {}) {
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["匂わせ女子"];
  const maleLine = maleScores.male_attention_score
    ? `男性注意 ${maleScores.male_attention_score} / DM誘発 ${maleScores.dm_trigger_score} / コメント誘発 ${maleScores.comment_trigger_score}。`
    : "男性読者が距離感を想像しやすい。";
  return `${scene.place}の${scene.object}という恋愛シーンが明確で、${scene.domain}の温度差を自分ごと化しやすい。${maleLine}scene_strength ${sceneScore}。文体: ${persona.tone}。`;
}

function sceneScoreFromDraft(draft) {
  return Number(draft.scene_strength ?? draft.sceneStrength ?? draft.scoreDetail?.scene_strength ?? draft.scoreDetail?.sceneStrength ?? 0);
}

function buildPublicPost(item, sceneCard, index, options) {
  const scene = buildScene(sceneCard);
  const raw = applyPersonaTone(buildTextForGenre(item, scene), item, options);
  const postText = compactToLimit(raw, 180);
  const sceneScore = sceneStrength(scene, postText);
  const maleScores = maleAttentionScores(item, scene, postText, options);
  const total = Math.max(0, Math.min(100, Math.round(item.score + scoreBoost(item.genre, options) + sceneScore * 0.18 + maleScores.male_attention_score * 0.18 + maleScores.dm_trigger_score * 0.12 + maleScores.comment_trigger_score * 0.14 + ((index * 3) % 5))));
  const persona = options.persona || "匂わせ女子";
  const buzzElements = [...new Set([scene.domain, item.label, "female_voice", "male_attention", "romance_tension", "romance_scene", ...item.buzz_elements])];
  const why = spreadReason(item, scene, sceneScore, options, maleScores);
  const detail = { post_text: postText, hook: scene.scene_lines[0], body: scene.observation, closing_line: scene.comment_question, comment_bait: scene.comment_question, emotional_trigger: item.trigger, emotionalTrigger: item.trigger, persona, target_audience: "adult_men", targetAudience: "adult_men", domain: scene.domain, genre: item.genre, angle_type: item.label, angleType: item.label, buzz_elements: buzzElements, buzzElements, scene_strength: sceneScore, sceneStrength: sceneScore, ...maleScores, maleAttentionScore: maleScores.male_attention_score, dmTriggerScore: maleScores.dm_trigger_score, commentTriggerScore: maleScores.comment_trigger_score, scene, why_it_may_spread: why, whyItMaySpread: why, viral_score: total, viralScore: { curiosity: ["subtle_hint", "green_or_red_flag", "沼"].includes(item.genre) ? 90 : 72, nostalgia: item.genre === "ex_memory" ? 88 : 64, surprise: ["sns_love", "comment_bait"].includes(item.genre) ? 84 : 70, empathy: ["female_truth", "romance_aruaru", "strong_girl"].includes(item.genre) ? 91 : 74, controversy: ["situationship", "jealousy"].includes(item.genre) ? 88 : 58, commentability: ["comment_bait", "green_or_red_flag", "romance_aruaru"].includes(item.genre) ? 94 : 80, male_attention: maleScores.male_attention_score, dm_trigger: maleScores.dm_trigger_score, comment_trigger: maleScores.comment_trigger_score, total }, totalScore: total, internal: { domain: scene.domain, source_topic: scene.topic, writer: "female-romance-scene-engine", target_audience: "adult_men" } };
  const draft = { id: crypto.randomUUID(), persona, target_audience: "adult_men", targetAudience: "adult_men", domain: scene.domain, genre: item.genre, angle_type: item.label, angleType: item.label, buzz_elements: buzzElements, buzzElements, scene_strength: sceneScore, sceneStrength: sceneScore, ...maleScores, maleAttentionScore: maleScores.male_attention_score, dmTriggerScore: maleScores.dm_trigger_score, commentTriggerScore: maleScores.comment_trigger_score, scene, why_it_may_spread: why, whyItMaySpread: why, post_text: postText, postText, text: postText, hook: detail.hook, body: detail.body, closing_line: scene.comment_question, closingLine: scene.comment_question, comment_bait: scene.comment_question, commentBait: scene.comment_question, cta: scene.comment_question, emotional_trigger: item.trigger, emotionalTrigger: item.trigger, viral_score: total, viralScore: detail.viralScore, source_ids: [], sourceIds: [], category: scene.domain, hookType: item.genre, score: total, scoreTotal: total, totalScore: total, scoreDetail: detail, sourceTrace: [] };
  const reason = rejectReason(draft);
  if (reason) draft.rejectedBySceneEngine = reason;
  return draft;
}

function isUsablePost(draft) {
  const text = draft.post_text || draft.postText || draft.text || "";
  if (draft.rejectedBySceneEngine) return false;
  if (sceneScoreFromDraft(draft) < 70) return false;
  if (/https?:\/\/|www\./.test(text)) return false;
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  const hasBadPhrase = BAD_PUBLIC_PHRASES.test(text);
  BAD_PUBLIC_PHRASES.lastIndex = 0;
  return !hasBadPhrase && !UNSAFE_ROMANCE.test(text) && (draft.male_attention_score ?? draft.scoreDetail?.male_attention_score ?? 0) >= 58;
}

function diversify(posts) {
  const selected = [];
  const seenDomains = new Map();
  const seenGenres = new Set();
  const canUseDomain = (post) => (seenDomains.get(post.domain || post.category || "romance") || 0) < 2;
  const rememberDomain = (post) => {
    const domain = post.domain || post.category || "romance";
    seenDomains.set(domain, (seenDomains.get(domain) || 0) + 1);
  };
  for (const post of posts.sort((a, b) => sceneScoreFromDraft(b) - sceneScoreFromDraft(a))) {
    if (!isUsablePost(post) || !canUseDomain(post) || seenGenres.has(post.genre)) continue;
    selected.push(post);
    seenGenres.add(post.genre);
    rememberDomain(post);
    if (selected.length >= 10) break;
  }
  for (const post of posts.sort((a, b) => ((b.totalScore || 0) + sceneScoreFromDraft(b) * 0.18 + (b.male_attention_score || b.scoreDetail?.male_attention_score || 0) * 0.2 + (b.dm_trigger_score || b.scoreDetail?.dm_trigger_score || 0) * 0.12 + (b.comment_trigger_score || b.scoreDetail?.comment_trigger_score || 0) * 0.14) - ((a.totalScore || 0) + sceneScoreFromDraft(a) * 0.18 + (a.male_attention_score || a.scoreDetail?.male_attention_score || 0) * 0.2 + (a.dm_trigger_score || a.scoreDetail?.dm_trigger_score || 0) * 0.12 + (a.comment_trigger_score || a.scoreDetail?.comment_trigger_score || 0) * 0.14))) {
    if (selected.includes(post) || !isUsablePost(post) || !canUseDomain(post)) continue;
    selected.push(post);
    rememberDomain(post);
    if (selected.length >= 10) break;
  }
  return selected.slice(0, 10);
}

export function rewriteDraftsToThreadsNative(drafts, researchId, options = {}) {
  const scenes = sceneCardsFromDrafts(Array.isArray(drafts) ? drafts : [], options);
  const genres = selectGenres(options);
  const posts = [];
  const count = Math.max(18, Math.min(28, genres.length + scenes.length));
  for (let index = 0; index < count; index += 1) {
    const item = genres[index % genres.length];
    const sceneCard = scenes[index % scenes.length];
    const post = buildPublicPost(item, sceneCard, index, options);
    post.source_ids = [researchId].filter(Boolean);
    post.sourceIds = post.source_ids;
    post.sourceTrace = post.source_ids;
    post.scoreDetail.source_ids = post.source_ids;
    posts.push(post);
  }
  return diversify(posts);
}
