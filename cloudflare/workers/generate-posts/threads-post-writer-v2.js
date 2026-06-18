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
  "制作過程": ["failure_story", "lifehack", "personal_story", "micro_observation"],
  "地元文化": ["micro_observation", "nostalgia", "empathy", "comment_bait"],
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

const COHERENT_SCENE_CARDS = [
  {
    domain: "人間関係",
    topic: "返信が遅いだけで距離を感じる瞬間",
    scene_lines: ["22時の部屋。", "スマホの通知欄に未読が一つだけ残っている。", "友達が返事を打ちかけて画面を閉じている。"],
    object: "未読の通知",
    human_action: "友達が返事を打ちかけて画面を閉じている",
    emotion: "嫌われたわけじゃないのに少し気になる",
    meaning: "返信速度より、止まっている時間の方に距離が出る",
    comment_question: "返信って、どこから遅いと感じるんだろう"
  },
  {
    domain: "恋愛",
    topic: "好きなのに疲れる関係",
    scene_lines: ["夜のコンビニ前。", "買ったコーヒーが少しぬるくなっている。", "待っている人が短いLINEを何度も読み返している。"],
    object: "ぬるくなったコーヒー",
    human_action: "待っている人が短いLINEを何度も読み返している",
    emotion: "楽しいはずなのに少し消耗する",
    meaning: "好きな気持ちと安心できる気持ちは別物かもしれない",
    comment_question: "安心できる恋愛って、どんな状態なんだろう"
  },
  {
    domain: "仕事",
    topic: "頑張ってる人ほど損して見える職場",
    scene_lines: ["18時のオフィス。", "コピー機の横に空の用紙箱が置かれている。", "真面目な人が誰にも言わずにコピー用紙を補充している。"],
    object: "コピー用紙",
    human_action: "真面目な人が誰にも言わずにコピー用紙を補充している",
    emotion: "評価されない仕事だけが静かに増える",
    meaning: "頑張りが見えない場所ほど、誰かの負担で回っている",
    comment_question: "こういう小さい仕事、誰が気づいてるんだろう"
  },
  {
    domain: "お金",
    topic: "節約してるのに不安が減らない",
    scene_lines: ["スーパーの袋詰め台。", "レシートの端に数十円の差額が残っている。", "買い物を終えた人が袋を持ったまま家計簿アプリを開いている。"],
    object: "レシートの端数",
    human_action: "買い物を終えた人が袋を持ったまま家計簿アプリを開いている",
    emotion: "削っているのに安心が増えない",
    meaning: "節約は数字を減らすことより、不安と付き合う作業に近い",
    comment_question: "節約って、どこから我慢になるんだろう"
  },
  {
    domain: "AI",
    topic: "AIで楽になるはずなのに考える量が増える",
    scene_lines: ["深夜のデスク。", "生成された文章が画面いっぱいに並んでいる。", "作業している人が採用する一文を選べずにカーソルだけ動かしている。"],
    object: "生成された文章",
    human_action: "作業している人が採用する一文を選べずにカーソルだけ動かしている",
    emotion: "便利なのに判断だけが増えている",
    meaning: "AIが減らすのは作業で、迷いはまだ人間側に残る",
    comment_question: "AIで楽になったはずなのに、別の疲れ方してない？"
  },
  {
    domain: "SNS",
    topic: "投稿しない人の方が幸せそうに見える",
    scene_lines: ["寝る前の布団。", "更新されないプロフィールがそのまま残っている。", "見るだけの人が通知を消してスマホを伏せている。"],
    object: "更新されないプロフィール",
    human_action: "見るだけの人が通知を消してスマホを伏せている",
    emotion: "見せない生活の方が軽く見える",
    meaning: "発信しない選択にも、ちゃんと強さがある",
    comment_question: "投稿しない人の方が生活うまそうに見える時ない？"
  },
  {
    domain: "メンタル",
    topic: "休んでいるのに休まらない日",
    scene_lines: ["休日の昼の部屋。", "閉めたカーテンの隙間から細い光が入っている。", "布団の中の人が通知だけ消してまた目を閉じている。"],
    object: "閉めたカーテン",
    human_action: "布団の中の人が通知だけ消してまた目を閉じている",
    emotion: "何もしていないのに頭だけ忙しい",
    meaning: "休むことと、回復することは同じじゃない",
    comment_question: "本当に休めた日って、最近いつだったんだろう"
  },
  {
    domain: "子育て",
    topic: "親の普通が子どもには重い瞬間",
    scene_lines: ["朝の玄関。", "ランドセルが少し開いたまま置かれている。", "親が忘れ物を確認しながら子どもの顔色を見ている。"],
    object: "開いたランドセル",
    human_action: "親が忘れ物を確認しながら子どもの顔色を見ている",
    emotion: "心配のつもりが少し圧になる",
    meaning: "正しさは近すぎると、相手には管理に見えることがある",
    comment_question: "心配とコントロールの境目ってどこだろう"
  },
  {
    domain: "健康",
    topic: "健康のための行動がストレスになる",
    scene_lines: ["夜の洗面所。", "歩数アプリの数字だけが明るく表示されている。", "寝る前の人が歯ブラシを持ったまま今日の歩数を見ている。"],
    object: "歩数アプリ",
    human_action: "寝る前の人が歯ブラシを持ったまま今日の歩数を見ている",
    emotion: "正しい習慣なのに少し追われている",
    meaning: "健康を数字で追いすぎると、体より先に気持ちが疲れる",
    comment_question: "健康管理って、いつから義務っぽくなるんだろう"
  },
  {
    domain: "学校",
    topic: "学校でしか通じない謎ルール",
    scene_lines: ["放課後の廊下。", "誰も説明しない古い掲示物が曲がって貼られている。", "学生がその前で一度止まってから何も言わずに通り過ぎている。"],
    object: "古い掲示物",
    human_action: "学生がその前で一度止まってから何も言わずに通り過ぎている",
    emotion: "守っている理由が誰にも分からない感じが残る",
    meaning: "謎ルールは、説明されないまま空気として受け継がれる",
    comment_question: "学校にしかない謎ルール、まだ覚えてる？"
  },
  {
    domain: "エンタメ",
    topic: "倍速視聴で感動だけ薄くなる",
    scene_lines: ["ソファの上。", "再生速度ボタンが1.5倍のまま光っている。", "見ている人が泣く場面だけ通常速度に戻している。"],
    object: "再生速度ボタン",
    human_action: "見ている人が泣く場面だけ通常速度に戻している",
    emotion: "効率よく見たのに何かが残りにくい",
    meaning: "物語は短くできても、気持ちは倍速に追いつかない",
    comment_question: "楽しむことまで時短していいのか、たまに迷う"
  },
  {
    domain: "都市伝説",
    topic: "みんなが一度は聞いた根拠のない噂",
    scene_lines: ["古い団地の掲示板。", "色あせた貼り紙の角だけがめくれている。", "帰り道の人が一度だけ振り返って掲示板を見ている。"],
    object: "色あせた貼り紙",
    human_action: "帰り道の人が一度だけ振り返って掲示板を見ている",
    emotion: "嘘っぽいのに記憶から消えない",
    meaning: "根拠がない話ほど、場所と一緒に残ることがある",
    comment_question: "子どもの頃に聞いた変な噂、まだ覚えてる？"
  },
  {
    domain: "ライフハック",
    topic: "便利グッズを買うほど部屋が散らかる",
    scene_lines: ["片付け途中の部屋。", "使っていない収納用品が床に二つ並んでいる。", "片付けようとした人が空のケースを持ったまま置き場所を探している。"],
    object: "使っていない収納用品",
    human_action: "片付けようとした人が空のケースを持ったまま置き場所を探している",
    emotion: "整えるための物がまた増えている",
    meaning: "便利さは、買うより減らす方が難しい",
    comment_question: "片付けグッズで散らかったこと、普通にあるよね"
  },
  {
    domain: "転職",
    topic: "辞めたい理由が給料だけじゃない時",
    scene_lines: ["朝の改札。", "通勤定期が読み取られて小さく音が鳴る。", "会社へ向かう人が改札を抜けたあと一瞬だけ立ち止まっている。"],
    object: "通勤定期",
    human_action: "会社へ向かう人が改札を抜けたあと一瞬だけ立ち止まっている",
    emotion: "条件は悪くないのに気持ちだけ削れている",
    meaning: "辞めたい理由は、数字より朝の体の重さに出る",
    comment_question: "仕事を変えたい理由って、言葉にしにくい時ある"
  },
  {
    domain: "炎上話題",
    topic: "正論なのに嫌われる言い方",
    scene_lines: ["投稿画面の前。", "短いコメントが入力欄に残ったままになっている。", "書いた人が送信せずに語尾だけ何度も直している。"],
    object: "短いコメント",
    human_action: "書いた人が送信せずに語尾だけ何度も直している",
    emotion: "内容より温度で反発される怖さがある",
    meaning: "正しさは、言い方で負けることがある",
    comment_question: "同じこと言ってるのに、言い方で全然変わるよね"
  },
  {
    domain: "比較ネタ",
    topic: "昔より便利なのに幸福感が増えない",
    scene_lines: ["店のメニュー前。", "選択肢が多いタッチパネルが光っている。", "注文する人が戻るボタンを押してまた最初から見直している。"],
    object: "タッチパネル",
    human_action: "注文する人が戻るボタンを押してまた最初から見直している",
    emotion: "選べるほど迷いが増える",
    meaning: "便利になるほど、決める疲れが増えることがある",
    comment_question: "選択肢が多いほど幸せ、って本当なんだろうか"
  },
  {
    domain: "地域ネタ",
    topic: "地方スーパーの閉店前",
    scene_lines: ["17時過ぎの地方スーパー。", "半額シールの貼られた惣菜だけが棚に残っている。", "買い物客が惣菜棚の前で一度止まり、買わずに通り過ぎている。"],
    object: "半額シールの惣菜",
    human_action: "買い物客が惣菜棚の前で一度止まり、買わずに通り過ぎている",
    emotion: "店内より町の静けさの方が濃く見える",
    meaning: "地方の夕方は、売れ残りより人の少なさが先に目に入る",
    comment_question: "夕方のスーパーだけ空気が変わる感じ、あるよね"
  }
];

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
  if (options.prioritizeLocalShareability) boost += 2;
  if (options.strongStyle && ["one_line_punch", "weird_gap", "unpopular_opinion", "hot_take"].includes(genre)) boost += 4;
  if (options.safeMode && ["hot_take", "unpopular_opinion", "controversy"].includes(genre)) boost -= 4;
  return boost;
}
function selectGenres(options = {}) {
  const category = String(options.buzzCategory || "自動ミックス");
  const persona = PERSONA_PROFILES[options.persona] || null;
  const categoryPreferred = CATEGORY_TO_GENRES[category] || [];
  const personaPreferred = persona?.prefer || [];
  const first = [...new Set([...categoryPreferred, ...personaPreferred])];
  const rest = GENRE_TAXONOMY.map((item) => item.genre).filter((genre) => !first.includes(genre));
  return [...first, ...rest].map((genre) => GENRE_TAXONOMY.find((item) => item.genre === genre)).filter(Boolean);
}
function sceneCardsFromDrafts(drafts, options = {}) {
  const material = stripBadPhrases((drafts || []).map((draft) => `${draft.title || ""} ${draft.text || ""} ${draft.body || ""} ${draft.category || ""}`).join(" "));
  if (!material || String(options.buzzCategory || "自動ミックス") === "自動ミックス") return COHERENT_SCENE_CARDS;
  const matched = COHERENT_SCENE_CARDS.filter((card) => [card.domain, card.topic, card.object, card.meaning].some((value) => material.includes(String(value).slice(0, 6))));
  return matched.length ? [...matched, ...COHERENT_SCENE_CARDS.filter((card) => !matched.includes(card))] : COHERENT_SCENE_CARDS;
}

function buildScene(sceneCard) {
  const sceneText = sceneCard.scene_lines.join("\n");
  return {
    ...sceneCard,
    scene: sceneText,
    place: sceneCard.scene_lines[0].replace(/[。\s]+$/g, ""),
    human_behavior: sceneCard.human_action,
    comment_invitation: sceneCard.comment_question,
    observation: `${sceneCard.object}に、${sceneCard.emotion}が出ている。`
  };
}

function sceneStrength(scene, text) {
  let score = 0;
  if (scene.scene_lines?.length >= 3 && scene.scene_lines.every(Boolean)) score += 20;
  if (scene.object && text.includes(scene.object)) score += 22;
  if (scene.human_action && text.includes(scene.human_action)) score += 24;
  if (scene.emotion && text.includes(scene.emotion)) score += 12;
  if (scene.meaning && text.includes(scene.meaning)) score += 12;
  if (scene.comment_question && text.includes(scene.comment_question)) score += 10;
  return Math.max(0, Math.min(100, score));
}

function buildTextForGenre(item, scene) {
  const separator = "\n\n";
  const endings = {
    empathy: `${scene.emotion}。こういう小さい場面に本音が出る気がする。`,
    nostalgia: `${scene.emotion}。昔は気にしてなかったのに、今見ると妙に残る。`,
    curiosity: `${scene.emotion}。なんでここで一回止まるんだろう。`,
    surprise: `${scene.emotion}。ただの${scene.object}なのに、見方が急に変わる。`,
    controversy: `${scene.emotion}。これ、気にする人と気にしない人で分かれそう。`,
    personal_story: `${scene.emotion}。自分も同じ場面で止まったことがある。`,
    one_line_punch: `${scene.object}のところで止まる人、だいたい何かを飲み込んでる。`,
    comment_bait: `${scene.emotion}。似た場面、ほかにもありそう。`,
    failure_story: `${scene.emotion}。見なかったことにした時ほど、あとで残る。`,
    before_after: `${scene.emotion}。前は普通だったのに、今はそこだけ意味が変わって見える。`,
    unpopular_opinion: `${scene.emotion}。正直、ここを気にする人の方が信用できる。`,
    micro_observation: `${scene.emotion}。派手な出来事より、こういう細部の方が生活の本音に近い。`,
    weird_gap: `${scene.emotion}。変と言うほどじゃない。でも、ずっと引っかかる。`,
    lifehack: `${scene.emotion}。気合いより、仕組みを変えた方が早い時がある。`,
    hot_take: `${scene.emotion}。言い方を間違えると反応が分かれるけど、見ないふりもできない。`
  };
  return stripBadPhrases([scene.scene, endings[item.genre] || endings.micro_observation, scene.meaning, scene.comment_question].join(separator));
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

function validateSceneCoherence(draft) {
  const scene = draft.scene || draft.scoreDetail?.scene || {};
  const text = draft.post_text || draft.postText || draft.text || "";
  if (!scene.object || !text.includes(scene.object)) return { ok: false, reason: "missing_scene_object" };
  if (!scene.human_action || !text.includes(scene.human_action)) return { ok: false, reason: "missing_scene_human_action" };
  if (scene.domain !== draft.domain) return { ok: false, reason: "domain_mismatch" };
  if (/前で[\s\S]*前で/.test(text)) return { ok: false, reason: "duplicated_location_grammar" };
  if (/(の前で|前で).{0,18}(の前で|前で)/.test(text)) return { ok: false, reason: "duplicated_location_grammar" };
  if (!scene.comment_question || !text.includes(scene.comment_question)) return { ok: false, reason: "unrelated_comment_question" };
  if (scene.object === "未読の通知" && /送信ボタン/.test(text)) return { ok: false, reason: "mixed_action_from_other_scene" };
  if (scene.object === "コピー用紙" && !/コピー用紙|コピー機/.test(scene.human_action)) return { ok: false, reason: "object_action_mismatch" };
  return { ok: true, reason: "" };
}

function rejectReason(draft) {
  const text = draft.post_text || draft.text || "";
  if (ABSTRACT_ONLY.test(text.replace(/\n/g, ""))) return "abstract_only";
  const coherence = validateSceneCoherence(draft);
  if (!coherence.ok) return coherence.reason;
  if (!/(不安|疲れ|距離|消耗|寂し|怖|気になる|迷う|引っかかる|残る|分かれそう|軽く見える|削れている|濃く見える)/.test(text)) return "missing_emotional_interpretation";
  if (!/(だろう|かもしれない|ありそう|どこから|何なんだろう|ある？|よね|ない？|迷う)/.test(text)) return "missing_comment_space";
  return "";
}

function spreadReason(item, scene, sceneScore, options = {}) {
  const persona = PERSONA_PROFILES[options.persona] || PERSONA_PROFILES["町の観察者"];
  return `${scene.place}の${scene.object}という一貫した場面があり、${scene.domain}の話を自分の経験に置き換えやすい。scene_strength ${sceneScore}。文体: ${persona.tone}。`;
}

function sceneScoreFromDraft(draft) {
  return Number(draft.scene_strength ?? draft.sceneStrength ?? draft.scoreDetail?.scene_strength ?? draft.scoreDetail?.sceneStrength ?? 0);
}

function buildPublicPost(item, sceneCard, index, options) {
  const scene = buildScene(sceneCard);
  const raw = applyPersonaTone(buildTextForGenre(item, scene), item, options);
  const postText = compactToLimit(raw, 220);
  const sceneScore = sceneStrength(scene, postText);
  const total = Math.max(0, Math.min(100, Math.round(item.score + scoreBoost(item.genre, options) + sceneScore * 0.24 + ((index * 3) % 6))));
  const persona = options.persona || "町の観察者";
  const buzzElements = [...new Set([scene.domain, item.label, "coherent_scene", ...item.buzz_elements])];
  const why = spreadReason(item, scene, sceneScore, options);
  const detail = {
    post_text: postText,
    hook: scene.scene_lines[0],
    body: `${scene.object}に、${scene.emotion}が出ている。`,
    closing_line: scene.comment_question,
    comment_bait: scene.comment_question,
    emotional_trigger: item.trigger,
    emotionalTrigger: item.trigger,
    persona,
    domain: scene.domain,
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
    internal: { domain: scene.domain, source_topic: scene.topic, writer: "scene-engine-v2" }
  };
  const draft = { id: crypto.randomUUID(), persona, domain: scene.domain, genre: item.genre, angle_type: item.label, angleType: item.label, buzz_elements: buzzElements, buzzElements, scene_strength: sceneScore, sceneStrength: sceneScore, scene, why_it_may_spread: why, whyItMaySpread: why, post_text: postText, postText, text: postText, hook: detail.hook, body: detail.body, closing_line: scene.comment_question, closingLine: scene.comment_question, comment_bait: scene.comment_question, commentBait: scene.comment_question, cta: scene.comment_question, emotional_trigger: item.trigger, emotionalTrigger: item.trigger, viral_score: total, viralScore: detail.viralScore, source_ids: [], sourceIds: [], category: scene.domain, hookType: item.genre, score: total, scoreTotal: total, totalScore: total, scoreDetail: detail, sourceTrace: [] };
  const reason = rejectReason(draft);
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
  const scenes = sceneCardsFromDrafts(Array.isArray(drafts) ? drafts : [], options);
  const genres = selectGenres(options);
  const posts = [];
  const count = Math.max(14, Math.min(24, genres.length + scenes.length));
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
