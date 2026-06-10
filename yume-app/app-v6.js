const KEY = "yume_app_state_v10";
const appConfig = {
  name: "ここから",
  subtitle: "止まっていたものを、少しだけ動かすノート",
  ...(window.YUME_APP_CONFIG || {})
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const shortText = (value, max = 58) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};
const asArray = (value, fallback = []) => Array.isArray(value) && value.length ? value : fallback;
const pickText = (value, fallback = "") => typeof value === "string" && value.trim() ? value : fallback;

const loadingSteps = [
  "入力を読んでいます",
  "Web上の情報を見ています",
  "似た人の流れを探しています",
  "今日できそうな形にしています"
];

let state = { screen: "top", plan: null, result: null, loadingStep: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved?.plan && saved?.result) state = { ...state, ...saved, screen: "result" };
} catch (_) {}

function render() {
  ensureExtraStyles();
  const root = $("#app");
  root.innerHTML = views[state.screen]();
  bindEvents();
}

const views = {
  top: () => `
    <section class="page home">
      <div class="shell">
        <header class="nav">
          <div class="brand">${escapeHtml(appConfig.name)}</div>
          <button class="ghost-button" data-go="form">少し整理する</button>
        </header>
        <section class="hero-soft">
          <p class="eyebrow">${escapeHtml(appConfig.subtitle)}</p>
          <h1>止まっていたものを、<br>少しだけ動かす。</h1>
          <p class="lead">Web上の事例を見て、今の状況に近い一歩へ分けます。</p>
          <button class="primary-button" data-go="form">市場を見て整理する</button>
        </section>
      </div>
    </section>`,
  form: () => `
    <section class="page">
      <div class="shell narrow">
        <button class="ghost-button" data-go="top">戻る</button>
        <div class="intro">
          <p class="eyebrow">まずは、軽く聞かせてください</p>
          <h2>いつかやりたいまま止まってること、ありますか？</h2>
        </div>
        <form class="soft-card form-card" id="dream-form">
          <div class="form-grid">
            ${input("dreamTitle", "いつかやってみたいこと", "地方でCNC加工の小さな工場を持ちたい")}
            ${input("currentAge", "今の年齢", "44", "number")}
            ${input("targetAge", "何歳くらいまでに形にしたいか", "50", "number")}
            ${input("availableTime", "使えそうな時間", "平日30分、週末2時間")}
            ${input("availableMoney", "使えそうなお金", "月1万円くらい")}
            ${input("skills", "これまでの経験", "CNC経験14年、過去作品あり")}
          </div>
          ${textarea("targetDescription", "どんな形になったら少しうれしいですか？", "小さな受注、SNS発信、工場を持つ準備など")}
          ${textarea("currentSituation", "今の状況", "子供4人。会社員で平日は忙しい。")}
          ${textarea("anxieties", "気になっていること", "今さら感とお金の不安")}
          <p class="error" id="form-error"></p>
          <div class="form-footer">
            <p>Cloudflare WorkerでWeb調査してから整理します。</p>
            <button class="primary-button">調べて整理する</button>
          </div>
        </form>
      </div>
    </section>`,
  loading: () => `
    <section class="page center-page">
      <div class="shell narrow">
        <div class="soft-card breathing">
          <p class="eyebrow">調べています</p>
          <h2>${escapeHtml(loadingSteps[state.loadingStep])}</h2>
          <p class="lead small">市場情報、似た事例、落とし穴を見ています。</p>
          <div class="agent-list">
            ${loadingSteps.map((step, index) => `
              <div class="agent ${index === state.loadingStep ? "active" : index < state.loadingStep ? "done" : ""}">
                <span></span><div><strong>${["入力", "市場", "事例", "一歩"][index]}</strong><p>${escapeHtml(step)}</p></div>
              </div>`).join("")}
          </div>
        </div>
      </div>
    </section>`,
  result: () => {
    const result = normalizeResult(state.result, state.plan);
    const firstAction = result.todayActions[0];
    return `
      <section class="page">
        <div class="shell stack">
          <header class="result-header">
            <div><p class="eyebrow">Web調査から整理しました</p><h2>まずこれだけ。</h2></div>
            <div class="actions compact">
              <button class="ghost-button" data-go="form">入力を直す</button>
              <button class="ghost-button" id="reset-state">記録を消す</button>
            </div>
          </header>

          <section class="conclusion-panel">
            <p class="eyebrow">まず結論</p>
            <h2>${escapeHtml(result.conclusion.title)}</h2>
            <p>${escapeHtml(result.conclusion.body)}</p>
            <div class="tag-row">${result.conclusion.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          </section>

          <section class="today-panel">
            <p class="eyebrow">今日の一歩</p>
            <h2>${escapeHtml(firstAction.title)}</h2>
            <p class="panel-note">${escapeHtml(firstAction.description)}</p>
            ${loadMeter(firstAction.estimatedMinutes)}
            <div class="today-list">${result.todayActions.map(actionCard).join("")}</div>
          </section>

          <section class="soft-card">
            <details class="why" open>
              <summary>なぜそう見えた？</summary>
              <div class="why-grid">${result.reasoningLinks.slice(0, 4).map(reasonCard).join("")}</div>
            </details>
          </section>

          <section class="soft-card">
            <p class="eyebrow">今の重さ</p>
            <div class="score-grid">${scoreCards(result.scores).join("")}</div>
          </section>

          <section class="soft-card">
            <p class="eyebrow">市場では</p>
            <div class="market-list">${result.researchNotes.slice(0, 3).map(researchCard).join("")}</div>
          </section>

          <section class="soft-card">
            <p class="eyebrow">似た人の流れ</p>
            <div class="similar-list">${similarTimeline(result.similarPatterns[0]).join("")}</div>
          </section>

          <section class="soft-card">
            <p class="eyebrow">よくある落とし穴</p>
            <div class="mistake-grid">${result.commonMistakes.slice(0, 4).map(mistakeCard).join("")}</div>
          </section>

          <section class="insight-panel">
            <p class="eyebrow">今止まってる理由</p>
            <h3>${escapeHtml(result.emotionalInsight.plainSummary)}</h3>
            <p class="panel-note">${escapeHtml(result.emotionalInsight.detectedConflict)}</p>
          </section>

          <section class="soft-card">
            <p class="eyebrow">小さな次の流れ</p>
            <div class="phase-cards">${result.phaseTimeline.slice(0, 4).map(flowCard).join("")}</div>
          </section>
        </div>
      </section>`;
  }
};

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      state.screen = button.dataset.go;
      render();
    });
  });
  const resetButton = $("#reset-state");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      localStorage.removeItem(KEY);
      state = { screen: "top", plan: null, result: null, loadingStep: 0 };
      render();
    });
  }
  const form = $("#dream-form");
  if (form) form.addEventListener("submit", submitDream);
}

async function submitDream(event) {
  event.preventDefault();
  const plan = Object.fromEntries(new FormData(event.currentTarget).entries());
  plan.currentAge = Number(plan.currentAge);
  plan.targetAge = Number(plan.targetAge);
  if (!plan.dreamTitle || !plan.currentAge || !plan.targetAge || !plan.currentSituation) {
    const error = $("#form-error");
    error.textContent = "やりたいこと、年齢、今の状況だけ入れてください。";
    error.style.display = "block";
    return;
  }
  state = { screen: "loading", plan, result: null, loadingStep: 0 };
  render();
  const timer = setInterval(() => {
    state.loadingStep = Math.min(state.loadingStep + 1, loadingSteps.length - 1);
    render();
  }, 1200);
  state.result = await analyze(plan);
  clearInterval(timer);
  state.screen = "result";
  localStorage.setItem(KEY, JSON.stringify({ plan, result: state.result }));
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function analyze(plan) {
  const endpoint = window.YUME_AI_ENDPOINT;
  if (!endpoint) return fallbackResult(plan);
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 90000);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, researchContext: { provider: "worker", generatedQueries: buildQueries(plan), notes: [] } }),
      signal: controller.signal
    });
    if (!response.ok) return fallbackResult(plan);
    return await response.json();
  } catch (_) {
    return fallbackResult(plan);
  }
}

function buildQueries(plan) {
  const text = [plan.dreamTitle, plan.currentSituation, plan.skills, plan.anxieties].join(" ");
  const age = plan.currentAge >= 50 ? "50代" : plan.currentAge >= 40 ? "40代" : "中高年";
  const isMaking = /CNC|加工|製造|工場|工房|ものづくり|作品/.test(text);
  const category = isMaking ? "ものづくり" : "副業";
  return [
    `${age} 副業 ${category} 始め方 実例`,
    /地方|地域|地元/.test(text) ? `地方 起業 ${category} 小さく始める 事例` : `${category} 個人事業 小さく始める 事例`,
    /子供|家族|育児|介護/.test(text) ? `家族あり 副業 ${category} 始め方` : `中高年 再挑戦 ${category} 始め方`,
    isMaking ? "CNC 個人事業 SNS 集客 小受注" : `${category} SNS 発信 個人販売`
  ];
}

function normalizeResult(value, plan) {
  const fallback = fallbackResult(plan);
  const source = value && typeof value === "object" ? value : {};
  const actions = asArray(source.todayActions, fallback.todayActions).slice(0, 3).map((action, index) => ({
    title: pickText(action.title || action.action, fallback.todayActions[index]?.title),
    description: pickText(action.description, fallback.todayActions[index]?.description),
    estimatedMinutes: Number(action.estimatedMinutes || fallback.todayActions[index]?.estimatedMinutes || 10),
    whyThisAction: pickText(action.whyThisAction || action.actionReason || action.reason, fallback.todayActions[index]?.whyThisAction),
    researchBasis: pickText(action.researchBasis || action.basis, fallback.todayActions[index]?.researchBasis)
  }));
  return {
    conclusion: {
      title: pickText(source.conclusion?.title, fallback.conclusion.title),
      body: pickText(source.conclusion?.body, fallback.conclusion.body),
      tags: asArray(source.conclusion?.tags, fallback.conclusion.tags).slice(0, 4)
    },
    todayActions: actions,
    researchNotes: asArray(source.researchNotes, fallback.researchNotes),
    reasoningLinks: asArray(source.reasoningLinks, fallback.reasoningLinks),
    scores: source.scores || fallback.scores,
    similarPatterns: asArray(source.similarPatterns, fallback.similarPatterns),
    commonMistakes: asArray(source.commonMistakes, fallback.commonMistakes),
    phaseTimeline: asArray(source.phaseTimeline, fallback.phaseTimeline),
    detectedBlocks: asArray(source.detectedBlocks, fallback.detectedBlocks),
    emotionalInsight: {
      plainSummary: pickText(source.emotionalInsight?.plainSummary || source.emotionalInsight?.summary, fallback.emotionalInsight.plainSummary),
      detectedConflict: pickText(source.emotionalInsight?.detectedConflict, fallback.emotionalInsight.detectedConflict)
    }
  };
}

function fallbackResult(plan) {
  const action = {
    title: "作れるものを5個だけ書く",
    description: "売れるかは考えず、手元の経験だけを書きます。",
    estimatedMinutes: 8,
    whyThisAction: "頭の中だけに置くより、次の一歩が見えやすいからです。",
    researchBasis: "Workerに接続できないため、ローカル整理です。"
  };
  return {
    conclusion: {
      title: "今あるものから、小さく外へ出すのがよさそうです。",
      body: "大きく決める前に、手元の経験を見える形にします。",
      tags: ["ローカル整理", "8分", "無理しない"]
    },
    todayActions: [action],
    researchNotes: [{ title: "Worker未接続", finding: "市場調査にはCloudflare Worker接続が必要です。", sourceType: "risk", whyItMatters: "本番ではTavily検索結果がここに出ます。", confidence: "low", url: "" }],
    reasoningLinks: [{ fact: `経験: ${shortText(plan.skills)}`, research: "手元の経験を外に出す方が軽いです。", therefore: action.title }],
    scores: { financialPressure: 70, executionPower: 55, socialResistance: 68, burnoutRisk: 62, stabilityNeed: 76 },
    similarPatterns: [{ label: "似た流れ", summary: "今あるものを出す → 近い人に見せる → 少し直す", timeline: ["今あるものを出す", "近い人に見せる", "少し直す"] }],
    commonMistakes: [{ label: "大きく始めすぎる", whyCommon: "形から入ると重くなります。", softAvoidance: "今日できそうな一歩へ戻します。" }],
    phaseTimeline: [{ title: "今あるものを出す", goal: "手元の経験を見える形にする。", smallAction: action.title, whyNow: "新しく作るより軽いからです。", researchBasis: "ローカル整理です。" }],
    detectedBlocks: [{ title: "お金の不安", plainDescription: `「${shortText(plan.availableMoney)}」が気になっています。`, softCounterAction: "0円でできる一歩へ戻す。" }],
    emotionalInsight: { plainSummary: "動きたい気持ちと、怖さが同時にあります。", detectedConflict: `「${shortText(plan.anxieties)}」が重さになっていそうです。` }
  };
}

function input(name, label, placeholder, type = "text") {
  return `<label><span>${escapeHtml(label)}</span><input name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}"></label>`;
}
function textarea(name, label, placeholder) {
  return `<label><span>${escapeHtml(label)}</span><textarea name="${name}" placeholder="${escapeHtml(placeholder)}"></textarea></label>`;
}
function loadMeter(minutes) {
  const safeMinutes = Math.max(5, Math.min(15, Number(minutes) || 10));
  const level = safeMinutes <= 7 ? 1 : safeMinutes <= 11 ? 2 : 3;
  return `<div class="load-meter"><p>行動負荷</p><div class="load-bars">${[1, 2, 3].map((item) => `<span class="${item <= level ? "on" : ""}"></span>`).join("")}</div><strong>${safeMinutes}分</strong></div>`;
}
function actionCard(action) {
  return `<article class="today-card"><div><h3>${escapeHtml(action.title)}</h3><p>${escapeHtml(action.description)}</p><p class="reason-line"><strong>なぜ今これ？</strong>${escapeHtml(action.whyThisAction)}</p><small>${escapeHtml(action.researchBasis)}</small></div><span>${escapeHtml(action.estimatedMinutes)}分</span></article>`;
}
function reasonCard(item) {
  return `<article class="reason-card"><span>入力</span><p>${escapeHtml(item.fact)}</p><span>市場</span><p>${escapeHtml(item.research)}</p><strong>${escapeHtml(item.therefore)}</strong></article>`;
}
function researchCard(item) {
  const sourceLabel = { market: "市場", case: "似た人", risk: "注意", trend: "流れ" }[item.sourceType] || "メモ";
  const confidence = { high: "高", medium: "中", low: "低" }[item.confidence] || "中";
  const url = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">参照元を見る</a>` : "";
  return `<article class="research-card"><div><span>${escapeHtml(sourceLabel)}</span><small>${escapeHtml(confidence)}</small></div><strong>${escapeHtml(item.title || item.topic)}</strong><p>${escapeHtml(item.finding)}</p><small>${escapeHtml(item.whyItMatters)}</small>${url}</article>`;
}
function scoreCards(scores = {}) {
  return [
    ["お金の重さ", scores.financialPressure],
    ["人に見せる重さ", scores.socialResistance],
    ["疲れやすさ", scores.burnoutRisk],
    ["生活を守りたい気持ち", scores.stabilityNeed]
  ].map(([label, rawValue]) => {
    const value = Math.max(0, Math.min(100, Number(rawValue) || 0));
    return `<article class="score-card"><div><strong>${escapeHtml(label)}</strong><span>${value}</span></div><div class="score-bar"><i style="width:${value}%"></i></div></article>`;
  });
}
function similarTimeline(pattern) {
  const item = pattern || { label: "似た流れ", summary: "今あるものを出す → 近い人に見せる → 少し直す", timeline: ["今あるものを出す", "近い人に見せる", "少し直す"] };
  return [
    `<article class="similar-head"><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.summary || item.evidence || "")}</p></article>`,
    ...asArray(item.timeline, []).slice(0, 4).map((step, index) => `<article class="similar-step"><span>${index + 1}</span><p>${escapeHtml(step)}</p></article>`)
  ];
}
function mistakeCard(item) {
  return `<article class="mistake-card"><strong>${escapeHtml(item.label || item.title)}</strong><p>${escapeHtml(item.whyCommon || item.description)}</p><small>${escapeHtml(item.softAvoidance || item.avoidance)}</small></article>`;
}
function flowCard(item) {
  return `<article class="phase-card"><h3>${escapeHtml(item.title || item.phase)}</h3><p>${escapeHtml(item.goal)}</p><strong>${escapeHtml(item.smallAction)}</strong><div class="phase-reasons"><article><span>なぜ今</span><p>${escapeHtml(item.whyNow || item.reason)}</p></article><article><span>市場</span><p>${escapeHtml(item.researchBasis)}</p></article></div></article>`;
}

function ensureExtraStyles() {
  if ($("#app-v6-style")) return;
  const style = document.createElement("style");
  style.id = "app-v6-style";
  style.textContent = `
    .conclusion-panel{border:1px solid rgba(139,187,194,.38);border-radius:26px;background:linear-gradient(135deg,rgba(255,253,247,.94),rgba(220,238,241,.56));padding:24px;box-shadow:0 18px 60px rgba(96,111,99,.08)}
    .conclusion-panel h2{font-size:clamp(28px,5vw,44px);letter-spacing:0}.tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.tag-row span{border:1px solid rgba(139,187,194,.36);border-radius:999px;background:rgba(255,253,247,.8);padding:8px 12px;color:#527a80;font-weight:900}
    .why-grid,.phase-reasons,.market-list,.phase-cards,.mistake-grid,.score-grid{display:grid;gap:12px;margin-top:16px}.reason-card,.research-card,.phase-card,.score-card,.mistake-card,.similar-head,.similar-step{border:1px solid rgba(231,222,207,.9);border-radius:18px;background:rgba(255,253,247,.75);padding:14px}.reason-card span,.research-card span,.phase-reasons span{color:#527a80;font-size:12px;font-weight:900}.research-card>div,.score-card>div:first-child{display:flex;justify-content:space-between;gap:10px}.research-card a{display:inline-block;margin-top:8px;color:#66865e;font-weight:900}
    .score-bar{height:9px;border-radius:999px;background:rgba(231,222,207,.8);overflow:hidden;margin-top:10px}.score-bar i{display:block;height:100%;background:linear-gradient(90deg,#8bbd92,#95cfd8)}.load-meter{display:flex;align-items:center;gap:12px;width:fit-content;margin-top:18px;border:1px solid rgba(139,187,194,.42);border-radius:999px;background:rgba(255,253,247,.78);padding:9px 12px}.load-bars{display:flex;gap:5px}.load-bars span{width:22px;height:8px;border-radius:999px;background:rgba(231,222,207,.9)}.load-bars .on{background:var(--leaf-strong)}
    .similar-list{display:grid;gap:10px;margin-top:16px}.similar-step{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px}.similar-step span{width:28px;height:28px;display:grid;place-items:center;border-radius:999px;background:var(--sky);color:#527a80;font-size:12px;font-weight:900}.phase-card>strong,.reason-card strong{display:block;margin-top:10px;border-radius:14px;background:rgba(223,234,217,.62);color:#66865e;padding:10px 12px}
    @media(min-width:760px){.why-grid,.phase-reasons,.mistake-grid,.score-grid{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
}

render();
