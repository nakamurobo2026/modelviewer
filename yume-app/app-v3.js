const STORAGE_KEY = "yume_app_state_v6";

const APP_CONFIG = {
name: "ここから",
subtitle: "止まっていたものを、少しだけ動かすノート",
heroMessage: "深夜でも開ける、再起動のための小さな場所。",
theme: { ink: "#4b4f4a", accent: "#8aa982", calm: "#dceef1" },
...(window.YUME_APP_CONFIG || {})
};

const state = {
screen: "top",
plan: null,
analysis: null,
step: 0,
reflection: null,
memo: "",
copied: false
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
const short = (value, max = 44) => {
const text = String(value || "").trim();
return text.length > max ? `${text.slice(0, max)}...` : text;
};

const steps = [
"あなたの中に、もうあるものを探しています",
"今から始められる形を整理しています",
"小さく動ける一歩を考えています",
"無理のない道筋を作っています"
];

const reflectionChoices = [
["moved", "動けた", "動けた記録は、次の週の足場になります。"],
["small", "少しだけ動けた", "少しだけでも十分です。小さな前進として残しておきましょう。"],
["stopped", "動けなかった", "止まる週があるのも普通です。夢が消えたわけではありません。"],
["changed", "夢が変わった", "夢が変わるのは、情報が増えたサインかもしれません。"],
["anxious", "やっぱり不安になった", "不安は、確認したいことを教えてくれることがあります。"]
];

function loadState() {
try {
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
if (saved?.plan && saved?.analysis) {
state.plan = saved.plan;
state.analysis = normalizeAnalysis(saved.analysis, saved.plan);
state.reflection = saved.reflection || null;
state.memo = saved.memo || "";
}
} catch (_) {}
}

function saveState() {
if (!state.plan || !state.analysis) return;
localStorage.setItem(STORAGE_KEY, JSON.stringify({
plan: state.plan,
analysis: state.analysis,
reflection: state.reflection,
memo: state.memo
}));
}

function resetState() {
localStorage.removeItem(STORAGE_KEY);
Object.assign(state, { screen: "top", plan: null, analysis: null, reflection: null, memo: "", copied: false });
render();
}

function render() {
injectStyles();
$("#app").innerHTML = views[state.screen]();
bind();
}

const views = {
top: () => `
<section class="page home">
<div class="shell">
<header class="nav">
<div class="brand">${esc(APP_CONFIG.name)}</div>
<button class="ghost-button" data-go="${state.analysis ? "result" : "form"}">${state.analysis ? "前回の整理を見る" : "少し整理する"}</button>
</header>
<section class="hero-soft">
<p class="eyebrow">${esc(APP_CONFIG.subtitle)}</p>
<h1>止まっていたものを、<br>少しだけ動かす。</h1>
<p class="lead">${esc(APP_CONFIG.heroMessage)} いつかやりたいままのことを、今日できる一歩だけに分けます。</p>
<div class="actions">
<button class="primary-button" data-go="form">いまの状態を置いてみる</button>
${state.analysis ? '<button class="quiet-button" data-go="result">今日の一歩を見る</button>' : ""}
</div>
</section>
<section class="soft-grid">
${info("今日1個だけ", "大きな計画より先に、10分でできることへ。")}
${info("今あるもの", "過去経験、続いたこと、人との関係を拾います。")}
${info("止まる日も前提", "できない週を責めず、再開しやすく整えます。")}
</section>
</div>
</section>
`,
form: () => `
<section class="page">
<div class="shell narrow">
<button class="ghost-button" data-go="top">戻る</button>
<div class="intro">
<p class="eyebrow">まずは、軽く聞かせてください</p>
<h2>いつかやりたいまま止まってること、ありますか？</h2>
<p class="lead small">まとまっていなくて大丈夫です。気になっていることを今の言葉で置いてみましょう。</p>
</div>
<form class="soft-card form-card" id="dream-form">
<div class="form-grid">
${input("dreamTitle", "いつかやってみたいこと", "例：小さなカフェを開きたい")}
${input("currentAge", "今の年齢", "44", "number")}
${input("targetAge", "何歳くらいまでに形にしたいか", "50", "number")}
${input("availableTime", "使えそうな時間", "例：平日30分、週末2時間")}
${input("availableMoney", "使えそうなお金", "例：月1万円くらい")}
${input("skills", "これまでの経験・得意なこと", "例：接客、料理、SNS、経理")}
</div>
${textarea("targetDescription", "どんな形になったら少しうれしいですか？", "お店、活動、収入、誰かに届けたいことなど。")}
${textarea("currentSituation", "今の状況", "仕事、家庭、体力、時間、気持ちの余裕など。")}
${textarea("anxieties", "気になっていること", "遅いかも、お金が不安、何から始めるかわからない、など。")}
<p class="error" id="form-error"></p>
<div class="form-footer">
<p>設定済みの場合だけCloudflare Workerへ送られます。未設定ならブラウザ内のモックで動きます。</p>
<button class="primary-button" type="submit">今日の一歩を見つける</button>
</div>
</form>
</div>
</section>
`,
analyzing: () => `
<section class="page center-page">
<div class="shell narrow">
<div class="soft-card breathing">
<p class="eyebrow">整理しています</p>
<h2>${esc(steps[state.step])}</h2>
<p class="lead small">急がなくて大丈夫です。今あるものから始められる形に分けています。</p>
<div class="agent-list">${steps.map((s, i) => `<div class="agent ${i === state.step ? "active" : i < state.step ? "done" : ""}"><span></span><div><strong>${["共感", "資産発見", "ブレーキ検知", "小さな一歩"][i]}</strong><p>${esc(s)}</p></div></div>`).join("")}</div>
</div>
</div>
</section>
`,
result: () => {
const a = state.analysis;
const first = a.todayActions[0];
return `
<section class="page">
<div class="shell stack">
<header class="result-header">
<div><p class="eyebrow">整理できました</p><h2>今日、ひとつだけ。</h2></div>
<div class="actions compact"><button class="ghost-button" data-go="form">入力を直す</button><button class="ghost-button" data-reset>記録を消す</button></div>
</header>
<section class="today-panel">
<p class="eyebrow">今日の一歩</p>
<h2>${esc(first.title)}</h2>
<p class="panel-note">${esc(first.description)}</p>
${loadMeter(first.estimatedMinutes)}
<div class="today-list">${a.todayActions.map(todayCard).join("")}</div>
</section>
<section class="why-panel">
<p class="eyebrow">なぜ、その一歩か</p>
<div class="why-grid">${miniReason("理由", first.actionReason)}${miniReason("リサーチ視点", first.researchBasis)}</div>
</section>
<section class="soft-card">
<div class="now-row"><div><p class="eyebrow">今ここ</p><h3>${esc(currentPosition(state.plan))}</h3></div><span>${esc(state.plan.currentAge)}歳</span></div>
<div class="phase-line">${a.phaseTimeline.map((p, i) => `<div class="phase ${i === 0 ? "active" : ""}"><span></span><p>${esc(p.phase)}</p></div>`).join("")}</div>
</section>
<section class="soft-card share-card">
<div><p class="eyebrow">SNS共有用テキスト</p><h3>言葉にして、少し外へ出す</h3></div>
<textarea readonly id="share-text">${esc(buildShareText(a))}</textarea>
<button class="quiet-button" data-copy-share>${state.copied ? "コピーしました" : "共有文をコピー"}</button>
</section>
<section class="insight-panel">
<div><p class="eyebrow">気持ちの整理</p><h3>${esc(a.emotionalInsight.summary)}</h3><p class="panel-note">${esc(a.emotionalInsight.detectedConflict)}</p></div>
<div class="evidence-list">${a.evidence.map(evidenceCard).join("")}</div>
</section>
<section class="summary-grid">
<div class="soft-card"><p class="eyebrow">世の中の情報から見た現実</p><div class="research-list">${a.researchNotes.map(researchCard).join("")}</div></div>
<div class="soft-card"><p class="eyebrow">今あるもの</p><h3>普通だと思っていることの中に、再開の材料があります。</h3><div class="asset-cards">${a.existingAssets.map(assetCard).join("")}</div></div>
</section>
<section class="soft-card"><p class="eyebrow">フェーズ型タイムライン</p><h2>年齢ではなく、進み方で見る。</h2><div class="phase-cards">${a.phaseTimeline.map(phaseCard).join("")}</div></section>
<section class="summary-grid">
<div class="soft-card"><p class="eyebrow">次にやること</p><div class="next-list">${a.visualSummary.nextSteps.map((x, i) => `<article class="next-step"><span>${i + 1}</span><p>${esc(x)}</p></article>`).join("")}</div></div>
<div class="soft-card"><p class="eyebrow">そっと避けたいこと</p><div class="item-list">${a.risks.slice(0, 2).map(riskCard).join("")}</div></div>
</section>
<section class="soft-card"><p class="eyebrow">止まりやすいところ</p><h3>動けない理由も、責める材料ではなく整理の材料です。</h3><div class="emotion-chips">${a.detectedBlocks.map(blockCard).join("")}</div></section>
<section class="reflection-cta"><h2>止まる週があるのも普通です。</h2><p>夢が消えたわけではありません。動いた記録を少し残して、次の小さな前進を選び直せます。</p><button class="primary-button" data-go="reflection">週1で振り返る</button></section>
</div>
</section>
`;
},
reflection: () => {
const msg = reflectionChoices.find((x) => x[0] === state.reflection)?.[2] || "止まる週があるのも普通です。夢が消えたわけではありません。";
return `<section class="page"><div class="shell narrow"><button class="ghost-button" data-go="result">結果へ戻る</button><div class="soft-card reflection-card"><p class="eyebrow">動いた記録</p><h2>今週、少しでも動けましたか？</h2><p class="lead small">止まる週があるのも普通です。夢が消えたわけではありません。</p><div class="choices">${reflectionChoices.map((x) => `<button class="choice ${state.reflection === x[0] ? "selected" : ""}" data-ref="${x[0]}">${x[1]}</button>`).join("")}</div><label class="memo-label"><span>メモ</span><textarea id="reflection-memo" placeholder="何ができたか、何が重かったか、次に少し軽くできそうなことを書いてください。">${esc(state.memo)}</textarea></label><p class="soft-note">${esc(msg)}</p></div></div></section>`;
}
};

function bind() {
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
state.screen = b.dataset.go === "result" && !state.analysis ? "top" : b.dataset.go;
state.copied = false;
render();
}));
document.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", resetState));
document.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", () => {
state.reflection = b.dataset.ref;
saveState();
render();
}));
$("#reflection-memo")?.addEventListener("input", (e) => {
state.memo = e.target.value;
saveState();
});
$("[data-copy-share]")?.addEventListener("click", async () => {
try {
await navigator.clipboard.writeText($("#share-text")?.value || "");
state.copied = true;
render();
} catch (_) {}
});
$("#dream-form")?.addEventListener("submit", submitDream);
}

async function submitDream(event) {
event.preventDefault();
const data = Object.fromEntries(new FormData(event.currentTarget).entries());
const error = $("#form-error");
data.currentAge = Number(data.currentAge);
data.targetAge = Number(data.targetAge);
if (!data.dreamTitle || !data.currentAge || !data.targetAge || !data.currentSituation) {
error.textContent = "気になっていること、年齢、今の状況だけ入れてください。";
error.style.display = "block";
return;
}
state.plan = {
...data,
availableTime: data.availableTime || "まだ決められていない",
availableMoney: data.availableMoney || "大きくは使えない",
skills: data.skills || "まだ言葉にできていない経験",
anxieties: data.anxieties || "何から始めればいいかわからない"
};
state.step = 0;
state.screen = "analyzing";
render();
const timer = setInterval(() => {
state.step = Math.min(state.step + 1, steps.length - 1);
render();
}, 1200);
state.analysis = await analyzePlan(state.plan);
clearInterval(timer);
saveState();
state.screen = "result";
render();
scrollTo({ top: 0, behavior: "smooth" });
}

async function analyzePlan(plan) {
const endpoint = window.YUME_AI_ENDPOINT;
if (!endpoint) return mockAnalysis(plan);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 76000);
try {
const response = await fetch(endpoint, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(plan),
signal: controller.signal
});
if (!response.ok) return mockAnalysis(plan);
return normalizeAnalysis(await response.json(), plan);
} catch (_) {
return mockAnalysis(plan);
} finally {
clearTimeout(timeout);
}
}

function normalizeAnalysis(value, plan) {
const fallback = mockAnalysis(plan);
const v = value && typeof value === "object" ? value : {};
return {
summary: str(v.summary, fallback.summary),
possibilityLevel: ["low", "medium", "high"].includes(v.possibilityLevel) ? v.possibilityLevel : fallback.possibilityLevel,
message: str(v.message, fallback.message),
reasoning: str(v.reasoning, fallback.reasoning),
emotionalInsight: obj(v.emotionalInsight, fallback.emotionalInsight, ["summary", "detectedConflict", "gentleMessage"]),
evidence: arr(v.evidence || v.userAssets, fallback.evidence).slice(0, 4).map((x, i) => evidence(x, fallback.evidence[i], i)),
researchNotes: arr(v.researchNotes, fallback.researchNotes).slice(0, 3).map((x, i) => research(x, fallback.researchNotes[i], i)),
existingAssets: arr(v.existingAssets, fallback.existingAssets).slice(0, 3).map((x, i) => textItem(x, fallback.existingAssets[i], "今あるもの", i)),
risks: arr(v.risks, fallback.risks).slice(0, 3).map((x, i) => risk(x, fallback.risks[i], i)),
detectedBlocks: arr(v.detectedBlocks || v.blocks || v.brakes, fallback.detectedBlocks).slice(0, 3).map((x, i) => block(x, fallback.detectedBlocks[i], i)),
phaseTimeline: arr(v.phaseTimeline, fallback.phaseTimeline).slice(0, 6).map((x, i) => phase(x, fallback.phaseTimeline[i], i)),
visualSummary: normalizeVisual(v.visualSummary, fallback.visualSummary),
todayActions: normalizeToday(v.todayActions, fallback.todayActions),
roadmap: []
};
}

function normalizeToday(value, fallback) {
const source = Array.isArray(value) && value.length ? value : fallback;
return source.slice(0, 3).map((x, i) => {
if (!x || typeof x !== "object" || !x.researchBasis) return fallback[i];
return {
title: str(x.title || x.action || x.step, fallback[i].title),
description: str(x.description || x.detail, fallback[i].description),
estimatedMinutes: Number(x.estimatedMinutes || x.minutes || fallback[i].estimatedMinutes),
emotionalMessage: str(x.emotionalMessage || x.message, fallback[i].emotionalMessage),
actionReason: str(x.actionReason || x.reason || x.why, fallback[i].actionReason),
researchBasis: str(x.researchBasis || x.basis || x.research, fallback[i].researchBasis)
};
});
}

function mockAnalysis(plan) {
const level = Math.max(plan.targetAge - plan.currentAge, 0) >= 4 ? "high" : "medium";
return {
summary: `「${plan.dreamTitle}」は、今の生活を大きく変える前に、手元にある経験を外に出して反応を見るほうが始めやすそうです。`,
possibilityLevel: level,
message: "確実とは言えません。でも、今日ひとつだけ外に出せる材料はあります。",
reasoning: `「${short(plan.currentSituation)}」と「${short(plan.availableTime, 26)}」「${short(plan.availableMoney, 26)}」を見ると、大きな決断より小さな外向き行動が合いやすそうです。`,
emotionalInsight: {
summary: "やりたい気持ちと、不安が同時に出ています。",
detectedConflict: `「${short(plan.anxieties, 42)}」があるので、いきなり形にしようとすると重くなりやすいです。`,
gentleMessage: "止まっていた時間は、材料を持ったまま置いていた時間かもしれません。"
},
evidence: [
{ label: "今の状況", quote: short(plan.currentSituation, 58), interpretation: "現在地が言葉になっているので、無理のない始め方を選びやすくなります。" },
{ label: "使える時間", quote: short(plan.availableTime, 42), interpretation: "まとまった時間より、短い行動に分けるほうが戻りやすい可能性があります。" },
{ label: "経験・スキル", quote: short(plan.skills, 58), interpretation: "普通だと思っている経験の中に、最初に見せられる材料があります。" }
],
researchNotes: [
{ topic: "小規模な副業・個人活動", finding: "最初から大きな投資をするより、既存の経験や作品を見せて反応を見る流れが現実的です。", whyItMatters: `「${short(plan.availableMoney, 28)}」という制約があるため、先に需要を確かめるほうが負担が少ないです。` },
{ topic: "個人ブランドの始め方", finding: "肩書きより、過去に作ったもの・続いたこと・人に喜ばれたことが最初の信頼材料になります。", whyItMatters: `「${short(plan.skills, 36)}」を、まず見える形にする価値があります。` },
{ topic: "再開の心理負荷", finding: "5〜15分で終わる具体行動は、再開の抵抗を下げやすいです。", whyItMatters: `「${short(plan.availableTime, 28)}」なら、長い計画より今日の1個が合っています。` }
],
existingAssets: [
{ title: "今の状況を言葉にできていること", description: `「${short(plan.currentSituation, 62)}」は、次の判断材料になります。` },
{ title: "普通だと思っている経験", description: `${short(plan.skills, 70)}の中に、使える材料が残っています。` },
{ title: "制約を先に見ていること", description: "時間やお金を先に見ることで、無理のない始め方を選べます。" }
],
risks: [
{ title: "最初から大きく賭けすぎる", description: "大きな支出や退職を最初に置くと、戻りにくくなります。", avoidance: "無料から低額で、1週間以内に試せる行動へ落とします。" },
{ title: "調べ続けて動けなくなる", description: "情報収集だけだと、始める日が遠くなります。", avoidance: "30分で区切り、外向き行動を1つ入れます。" }
],
detectedBlocks: [
{ title: "今さら感", description: `「${short(plan.anxieties, 32)}」があると、始める前に比べて疲れやすいです。`, softCounterAction: "同じ制約に近い人を3人だけ保存する。" },
{ title: "お金の不安", description: `「${short(plan.availableMoney, 24)}」の範囲なら、投資より先に反応を見るのが現実的です。`, softCounterAction: "0円で見せられる実績を1つ選ぶ。" },
{ title: "完璧に始めたい気持ち", description: "最初から完成形を作ろうとすると重くなります。", softCounterAction: "下書き、写真、メモのどれか1つだけ外に出す。" }
],
phaseTimeline: buildPhaseTimeline(plan),
visualSummary: { currentState: ["止まっていた", "少し気になる", "不安もある"], assets: ["経験", "使える時間", "過去に続いたこと"], blocks: ["今さら感", "お金不安", "完璧に始めたい"], nextSteps: ["写真を1枚撮る", "参考3人を保存", "価格を10分メモ"] },
todayActions: [
{ title: "過去に作ったものを1つ写真に撮る", description: "新しく作らず、手元にあるものを1つだけ選んで撮ります。", estimatedMinutes: 10, emotionalMessage: "完成していなくて大丈夫です。", actionReason: "すでに経験や作品がある場合、新しく始めるより、今あるものを外に出す方が負担が少ないため。", researchBasis: "小規模な副業や個人活動では、最初から大きな投資をするより、既存の実績を見せて反応を見る流れが現実的です。" },
{ title: "参考になる人を3人だけ保存する", description: "年齢・予算・生活が近い人を、SNSや検索で3人保存します。", estimatedMinutes: 12, emotionalMessage: "遠い成功例は今日は見なくて大丈夫です。", actionReason: "比較疲れを避け、今の制約に近い始め方だけを見るため。", researchBasis: "近い条件の事例を見ると、必要な準備や現実的な順番を見積もりやすくなります。" },
{ title: "10分だけ価格をメモする", description: "無料、500円、1000円の3つだけ仮で書きます。", estimatedMinutes: 10, emotionalMessage: "決めるのではなく、置いてみるだけです。", actionReason: "お金の不安がある時は、曖昧なままより小さな数字にした方が扱いやすいため。", researchBasis: "小さな販売や相談では、最初は仮価格で反応を見る流れが現実的です。" }
]
};
}

function buildPhaseTimeline(plan) {
return [
["今ここ", "今あるものを整理する", "新しく作る前に、手元に残っている経験を見える形にします。", "過去に作ったものを1つ写真に撮る", `「${short(plan.skills, 34)}」があるなら、ゼロから作るより手元の材料を出すほうが軽いため。`, "最初の信頼材料は肩書きより既存の実績になりやすいです。"],
["小さく試す", "外に出す量を1つに絞る", "完成版ではなく、見せても疲れにくい断片を1つだけ作ります。", "1投稿だけ下書きする", `「${short(plan.availableTime, 28)}」なら、長い準備より短い下書きが生活を壊しにくいため。`, "準備を増やすより小さな発信で反応の方向を知るほうが現実的です。"],
["反応を見る", "信頼できる人にだけ見せる", "広く出す前に、近い人から言葉を1つもらいます。", "信頼できる人に「これ少し考えてる」とだけ送る", "不安が強い時は、公開より小さな相談のほうが戻ってきやすいため。", "小さな検証では、近い1人の反応が次の修正材料になります。"],
["続けやすくする", "戻れる場所を作る", "毎日やる前提を置かず、週に1回だけ戻る場所を決めます。", "週に使える30分を1枠だけ仮置きする", "止まる週がある前提なら、頻度より戻りやすさを先に作るほうが軽いため。", "短い固定枠があると再開の判断に使いやすくなります。"],
["生活に馴染ませる", "やらない日の扱いを決める", "動けなかった日を責めず、次の入口を残します。", "再開メモを1行作る", `「${short(plan.currentSituation, 34)}」がある中では、止まる日の扱いまで決めたほうが折れにくいため。`, "毎回の熱量より再開しやすい記録が支えになります。"],
["必要なら大きくする", "数字を小さく置いてみる", "投資や退職の前に、値段や必要額を小さく仮置きします。", "無料・500円・1000円の3つをメモする", `「${short(plan.availableMoney, 28)}」という不安を、扱える数字に分けるため。`, "最初から大きな金額を決めるより仮価格で反応を見る流れが現実的です。"]
].map(([phase, title, goal, smallAction, reason, researchBasis]) => ({ phase, title, goal, smallAction, reason, researchBasis }));
}

function str(value, fallback) {
return typeof value === "string" && value.trim() ? value : fallback;
}
function arr(value, fallback) {
return Array.isArray(value) && value.length ? value : fallback;
}
function obj(value, fallback, keys) {
value = value && typeof value === "object" ? value : {};
return Object.fromEntries(keys.map((key) => [key, str(value[key], fallback[key])]));
}
function textItem(value, fallback, label, index) {
if (!value || typeof value !== "object") return fallback || { title: `${label}${index + 1}`, description: "今ある材料として残します。" };
return { title: str(value.title || value.name || value.label, fallback.title), description: str(value.description || value.detail || value.reason, fallback.description) };
}
function risk(value, fallback, index) {
if (!value || typeof value !== "object") return fallback || { title: `避けたいこと${index + 1}`, description: "焦る前に見ておきたい点です。", avoidance: "小さく試せる形へ戻します。" };
return { title: str(value.title || value.risk, fallback.title), description: str(value.description || value.detail, fallback.description), avoidance: str(value.avoidance || value.fallbackPlan || value.fallback, fallback.avoidance) };
}
function block(value, fallback, index) {
const base = textItem(value, fallback, "止まりやすいところ", index);
return { ...base, softCounterAction: str(value?.softCounterAction || value?.smallAction, fallback.softCounterAction) };
}
function evidence(value, fallback, index) {
if (!value || typeof value !== "object") return fallback || { label: `手がかり${index + 1}`, quote: String(value || ""), interpretation: "ここから今日できる大きさへ分けています。" };
return { label: str(value.label || value.title || value.source, fallback.label), quote: str(value.quote || value.input || value.value || value.text, fallback.quote), interpretation: str(value.interpretation || value.reason || value.description, fallback.interpretation) };
}
function research(value, fallback, index) {
if (!value || typeof value !== "object") return fallback || { topic: `現実メモ${index + 1}`, finding: String(value || ""), whyItMatters: "今の状況に近い順番を選ぶための視点です。" };
return { topic: str(value.topic || value.title, fallback.topic), finding: str(value.finding || value.description || value.fact, fallback.finding), whyItMatters: str(value.whyItMatters || value.reason || value.basis, fallback.whyItMatters) };
}
function phase(value, fallback, index) {
if (!value || typeof value !== "object") return fallback || buildPhaseTimeline(state.plan || {})[index];
return { phase: str(value.phase || value.label, fallback.phase), title: str(value.title || value.theme, fallback.title), goal: str(value.goal || value.description, fallback.goal), smallAction: str(value.smallAction || value.action || value.firstStep, fallback.smallAction), reason: str(value.reason || value.why, fallback.reason), researchBasis: str(value.researchBasis || value.basis || value.research, fallback.researchBasis) };
}
function normalizeVisual(value, fallback) {
value = value && typeof value === "object" ? value : {};
const list = (x, fb) => Array.isArray(x) && x.length ? x.map((v) => String(v.title || v.description || v.text || v)).filter(Boolean) : fb;
return { currentState: list(value.currentState, fallback.currentState), assets: list(value.assets, fallback.assets), blocks: list(value.blocks, fallback.blocks), nextSteps: list(value.nextSteps, fallback.nextSteps).slice(0, 4) };
}

function input(name, label, placeholder, type = "text") {
return `<label><span>${esc(label)}</span><input name="${name}" type="${type}" placeholder="${esc(placeholder)}"></label>`;
}
function textarea(name, label, placeholder) {
return `<label><span>${esc(label)}</span><textarea name="${name}" placeholder="${esc(placeholder)}"></textarea></label>`;
}
function info(title, body) {
return `<article class="soft-card info-card"><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`;
}
function currentPosition(plan) {
return `「${short(plan.dreamTitle, 24)}」を、今の生活の中で少し動かせる形に分けています。`;
}
function loadMeter(minutes) {
const safe = Math.max(5, Math.min(15, Number(minutes || 10)));
const level = safe <= 7 ? 1 : safe <= 11 ? 2 : 3;
return `<div class="load-meter"><p>行動負荷</p><div class="load-bars">${[1, 2, 3].map((x) => `<span class="${x <= level ? "on" : ""}"></span>`).join("")}</div><strong>${safe}分</strong></div>`;
}
function miniReason(title, body) {
return `<article class="mini-reason"><span>${esc(title)}</span><p>${esc(body)}</p></article>`;
}
function todayCard(x) {
return `<article class="today-card"><div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><p class="reason-line"><strong>なぜ今これ？</strong>${esc(x.actionReason)}</p><small>${esc(x.emotionalMessage)}</small></div><span>${Number(x.estimatedMinutes || 10)}分</span></article>`;
}
function evidenceCard(x) {
return `<article class="evidence-item"><span>${esc(x.label)}</span><q>${esc(x.quote)}</q><p>${esc(x.interpretation)}</p></article>`;
}
function researchCard(x) {
return `<article class="research-card"><span>${esc(x.topic)}</span><strong>${esc(x.finding)}</strong><p>${esc(x.whyItMatters)}</p></article>`;
}
function assetCard(x, i) {
return `<article class="asset-card"><span>${i + 1}</span><h4>${esc(x.title)}</h4><p>${esc(x.description)}</p></article>`;
}
function riskCard(x) {
return `<article class="text-item"><h4>${esc(x.title)}</h4><p>${esc(x.description)}</p><small>${esc(x.avoidance)}</small></article>`;
}
function blockCard(x) {
return `<article class="emotion-chip"><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p><small>${esc(x.softCounterAction)}</small></article>`;
}
function phaseCard(x, i) {
return `<article class="phase-card ${i === 0 ? "current" : ""}"><div class="phase-card-head"><span>${esc(x.phase)}</span><h3>${esc(x.title)}</h3></div><p>${esc(x.goal)}</p><strong>${esc(x.smallAction)}</strong><div class="phase-reasons">${miniReason("理由", x.reason)}${miniReason("リサーチ視点", x.researchBasis)}</div></article>`;
}
function buildShareText(analysis) {
return `今からでも遅くないかもしれない。\n今日の一歩：${analysis.todayActions[0]?.title || "小さな前進"}。`;
}

function injectStyles() {
if ($("#yume-dynamic-styles")) return;
const style = document.createElement("style");
style.id = "yume-dynamic-styles";
style.textContent = `
.why-panel{border:1px solid rgba(231,222,207,.9);border-radius:22px;background:rgba(255,253,247,.84);box-shadow:var(--shadow);padding:22px}
.why-grid,.phase-reasons{display:grid;gap:12px;margin-top:14px}
.mini-reason{border-left:4px solid var(--sky-strong);border-radius:14px;background:rgba(220,238,241,.32);padding:12px 14px}
.mini-reason span,.research-card span{color:#527a80;font-size:12px;font-weight:900}
.mini-reason p,.research-card p,.phase-card p,.emotion-chip small{margin-top:7px;color:var(--muted);line-height:1.65}
.load-meter{display:flex;align-items:center;gap:12px;width:fit-content;margin-top:18px;border:1px solid rgba(139,187,194,.42);border-radius:999px;background:rgba(255,253,247,.78);padding:9px 12px}
.load-meter p,.load-meter strong{color:#527a80;font-size:13px;font-weight:900}
.load-bars{display:flex;gap:5px}.load-bars span{width:22px;height:8px;border-radius:999px;background:rgba(231,222,207,.9)}.load-bars .on{background:var(--leaf-strong)}
.research-list,.phase-cards,.next-list{display:grid;gap:12px;margin-top:16px}
.research-card,.phase-card,.next-step{border:1px solid rgba(231,222,207,.9);border-radius:18px;background:rgba(255,253,247,.72);padding:14px}
.research-card strong{display:block;margin-top:6px;color:var(--ink);line-height:1.55}
.phase-card.current{border-color:rgba(139,187,194,.7);background:rgba(220,238,241,.34)}
.phase-card-head{display:flex;align-items:flex-start;gap:12px}.phase-card-head span,.next-step span{border-radius:999px;background:var(--sky);color:#527a80;padding:7px 10px;font-size:12px;font-weight:900}
.phase-card>strong{display:block;width:fit-content;margin-top:12px;border-radius:14px;background:rgba(223,234,217,.62);color:#66865e;padding:10px 12px;line-height:1.5}
.emotion-chip small{display:block;border-radius:12px;background:rgba(223,234,217,.48);padding:9px 10px}
.next-step{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}.next-step span{width:28px;height:28px;display:grid;place-items:center;padding:0}.next-step p{color:var(--ink);line-height:1.55}
@media(min-width:760px){.why-grid,.phase-reasons{grid-template-columns:repeat(2,1fr)}}
`;
document.head.appendChild(style);
}

loadState();
render();
