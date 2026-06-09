const STORAGE_KEY = "yume_app_state_v4";

const state = {
  screen: "top",
  plan: null,
  analysis: null,
  step: 0,
  reflection: null,
  reflectionMemo: "",
  copied: false
};

const analysisSteps = [
  "あなたの中に、もうあるものを探しています",
  "今から始められる形を整理しています",
  "小さく動ける一歩を考えています",
  "無理のない道筋を作っています"
];

const agents = [
  "今あるものを探す係",
  "現実に合わせる係",
  "小さな一歩にする係",
  "道筋を整える係"
];

const reflections = [
  ["moved", "動けた", "動けた記録は、次の週の足場になります。小さな前進をそのまま残しておきましょう。"],
  ["small", "少しだけ動けた", "少しだけでも十分です。続ける力は、こういう小さな記録から育ちます。"],
  ["stopped", "動けなかった", "止まる週があるのも普通です。夢が消えたわけではありません。"],
  ["changed", "夢が変わった", "夢が変わるのは、逃げではなく情報が増えたサインかもしれません。今の形に合わせて整理し直せます。"],
  ["anxious", "やっぱり不安になった", "不安は邪魔者ではなく、確認したいことを教えてくれることがあります。ひとつずつ分けましょう。"]
];

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const trimText = (value, max) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.plan && saved?.analysis) {
      state.plan = saved.plan;
      state.analysis = normalizeAnalysis(saved.analysis, saved.plan);
      state.reflection = saved.reflection || null;
      state.reflectionMemo = saved.reflectionMemo || "";
    }
  } catch (_) {}
}

function saveState() {
  if (!state.plan || !state.analysis) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    plan: state.plan,
    analysis: state.analysis,
    reflection: state.reflection,
    reflectionMemo: state.reflectionMemo,
    savedAt: new Date().toISOString()
  }));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state.screen = "top";
  state.plan = null;
  state.analysis = null;
  state.reflection = null;
  state.reflectionMemo = "";
  state.copied = false;
  render();
}

function render() {
  $("#app").innerHTML = views[state.screen]();
  bind();
}

const views = {
  top: () => `
    <section class="page home">
      <div class="shell">
        <header class="nav">
          <div class="brand">夢アプリ</div>
          <button class="ghost-button" data-go="${state.analysis ? "result" : "form"}">${state.analysis ? "前回の整理を見る" : "少し整理する"}</button>
        </header>
        <section class="hero-soft">
          <p class="eyebrow">まだ間に合うか、一緒に調べてみよう</p>
          <h1>今からでも、<br>遅くないかもしれない。</h1>
          <p class="lead">いつかやりたいまま止まってることを、今日できる小さな一歩に変えるAIロードマップです。焦らせず、今あるものから一緒に整理します。</p>
          <div class="actions">
            <button class="primary-button" data-go="form">いつかのことを整理する</button>
            ${state.analysis ? '<button class="quiet-button" data-go="result">今日の一歩を見る</button>' : ""}
          </div>
        </section>
        <section class="soft-grid">
          ${infoCard("今日の一歩", "ロードマップより先に、今日できる最小アクションを出します。")}
          ${infoCard("今あるもの", "普通だと思っている経験の中から、使える材料を見つけます。")}
          ${infoCard("止まっても大丈夫", "動けない週があっても、責めずに次の形へ整えます。")}
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
          <p class="lead small">まとまっていなくて大丈夫です。夢というほど大きくなくても、気になっていることを今の言葉で置いてみましょう。</p>
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
            <p>入力はこのブラウザと、設定済みの場合だけCloudflare Workerへ送られます。</p>
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
          <h2>${analysisSteps[state.step]}</h2>
          <p class="lead small">急がなくて大丈夫です。今あるものから始められる形に、少しずつ分けています。</p>
          <div class="agent-list">
            ${analysisSteps.map((step, index) => `
              <div class="agent ${index === state.step ? "active" : index < state.step ? "done" : ""}">
                <span></span>
                <div>
                  <strong>${agents[index]}</strong>
                  <p>${step}</p>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </section>
  `,
  result: () => {
    const analysis = state.analysis;
    const plan = state.plan;
    const shareText = buildShareText(analysis);
    return `
      <section class="page">
        <div class="shell stack">
          <header class="result-header">
            <div>
              <p class="eyebrow">整理できました</p>
              <h2>まずは、今日の一歩だけ。</h2>
            </div>
            <div class="actions compact">
              <button class="ghost-button" data-go="form">入力を直す</button>
              <button class="ghost-button" data-reset>記録を消す</button>
            </div>
          </header>

          <section class="today-panel">
            <p class="eyebrow">今日の一歩</p>
            <h2>大きく変えなくて大丈夫です。</h2>
            <div class="today-list">
              ${analysis.todayActions.map(todayAction).join("")}
            </div>
          </section>

          <section class="soft-card share-card">
            <div>
              <p class="eyebrow">SNS共有用テキスト</p>
              <h3>言葉にして、少し外へ出す</h3>
            </div>
            <textarea readonly id="share-text">${escapeHtml(shareText)}</textarea>
            <button class="quiet-button" data-copy-share>${state.copied ? "コピーしました" : "共有文をコピー"}</button>
          </section>

          <section class="summary-grid">
            <div class="soft-card">
              <p class="eyebrow">夢の整理</p>
              <h3>${escapeHtml(plan.dreamTitle)}</h3>
              <p class="body-text">${escapeHtml(analysis.summary)}</p>
              <p class="soft-note">${escapeHtml(analysis.message)}</p>
            </div>
            <div class="soft-card">
              <p class="eyebrow">今あるもの</p>
              <h3>あなたが普通だと思っている経験の中に、使える武器があります。</h3>
              <div class="item-list">${analysis.existingAssets.map(asset).join("")}</div>
            </div>
          </section>

          <section class="soft-card">
            <p class="eyebrow">無理のない道筋</p>
            <h2>${plan.currentAge}歳から${plan.targetAge}歳まで</h2>
            <div class="roadmap">${analysis.roadmap.map(roadmapItem).join("")}</div>
          </section>

          <section class="summary-grid">
            <div class="soft-card">
              <p class="eyebrow">足りないもの</p>
              <div class="item-list">${analysis.missingPieces.map(asset).join("")}</div>
            </div>
            <div class="soft-card">
              <p class="eyebrow">避けたいリスク</p>
              <div class="item-list">${analysis.risks.map(risk).join("")}</div>
            </div>
          </section>

          <section class="reflection-cta">
            <h2>止まる週があるのも普通です。</h2>
            <p>夢が消えたわけではありません。動いた記録を少し残して、次の小さな前進を選び直せます。</p>
            <button class="primary-button" data-go="reflection">週1で振り返る</button>
          </section>
        </div>
      </section>
    `;
  },
  reflection: () => {
    const message = reflections.find((item) => item[0] === state.reflection)?.[2] || "止まる週があるのも普通です。夢が消えたわけではありません。";
    return `
      <section class="page">
        <div class="shell narrow">
          <button class="ghost-button" data-go="result">結果へ戻る</button>
          <div class="soft-card reflection-card">
            <p class="eyebrow">動いた記録</p>
            <h2>今週、少しでも動けましたか？</h2>
            <p class="lead small">止まる週があるのも普通です。夢が消えたわけではありません。責めるためではなく、次を少し軽くするための振り返りです。</p>
            <div class="choices">
              ${reflections.map((item) => `<button class="choice ${state.reflection === item[0] ? "selected" : ""}" data-ref="${item[0]}">${item[1]}</button>`).join("")}
            </div>
            <label class="memo-label">
              <span>メモ</span>
              <textarea id="reflection-memo" placeholder="何ができたか、何が重かったか、次に少し軽くできそうなことを書いてください。">${escapeHtml(state.reflectionMemo)}</textarea>
            </label>
            <p class="soft-note">${escapeHtml(message)}</p>
          </div>
        </div>
      </section>
    `;
  }
};

function bind() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.go;
      state.screen = next === "result" && !state.analysis ? "top" : next;
      state.copied = false;
      render();
    });
  });

  document.querySelectorAll("[data-reset]").forEach((button) => button.addEventListener("click", resetState));

  document.querySelectorAll("[data-why]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".road-card").querySelector(".why").classList.toggle("open");
    });
  });

  document.querySelectorAll("[data-ref]").forEach((button) => {
    button.addEventListener("click", () => {
      state.reflection = button.dataset.ref;
      saveState();
      render();
    });
  });

  const memo = $("#reflection-memo");
  if (memo) {
    memo.addEventListener("input", () => {
      state.reflectionMemo = memo.value;
      saveState();
    });
  }

  const copy = $("[data-copy-share]");
  if (copy) {
    copy.addEventListener("click", async () => {
      const text = $("#share-text")?.value || "";
      try {
        await navigator.clipboard.writeText(text);
        state.copied = true;
        render();
      } catch (_) {}
    });
  }

  const form = $("#dream-form");
  if (form) form.addEventListener("submit", submitDream);
}

async function submitDream(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  data.currentAge = Number(data.currentAge);
  data.targetAge = Number(data.targetAge);

  const error = $("#form-error");
  if (!data.dreamTitle || !data.currentAge || !data.targetAge || !data.currentSituation) {
    error.textContent = "いつかやってみたいこと、今の年齢、形にしたい年齢、今の状況を入れてください。";
    error.style.display = "block";
    return;
  }
  if (data.targetAge < data.currentAge) {
    error.textContent = "形にしたい年齢は、今の年齢以上で入力してください。";
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

  const progress = setInterval(() => {
    state.step = Math.min(state.step + 1, analysisSteps.length - 1);
    render();
  }, 1400);

  state.analysis = await analyzePlan(state.plan);
  clearInterval(progress);
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
    const value = await response.json();
    return normalizeAnalysis(value, plan);
  } catch (_) {
    return mockAnalysis(plan);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAnalysis(value, plan) {
  value = value && typeof value === "object" ? value : {};
  const fallback = mockAnalysis(plan);
  return {
    summary: stringOr(value.summary, fallback.summary),
    possibilityLevel: ["low", "medium", "high"].includes(value.possibilityLevel) ? value.possibilityLevel : fallback.possibilityLevel,
    message: stringOr(value.message, fallback.message),
    existingAssets: normalizeTextItems(value.existingAssets, fallback.existingAssets, "今あるもの"),
    missingPieces: normalizeTextItems(value.missingPieces, fallback.missingPieces, "足りないもの"),
    risks: normalizeRisks(value.risks, fallback.risks),
    roadmap: normalizeRoadmap(value.roadmap, fallback.roadmap),
    todayActions: normalizeTodayActions(value.todayActions, fallback.todayActions),
    source: value.source || "mock"
  };
}

function mockAnalysis(plan) {
  const years = Math.max(plan.targetAge - plan.currentAge, 0);
  const level = years >= 5 ? "high" : years >= 2 ? "medium" : "low";
  return {
    summary: `${plan.currentAge}歳の今から「${plan.dreamTitle}」へ向かうために、${plan.targetAge}歳までを小さな検証と積み上げに分けて考えます。`,
    possibilityLevel: level,
    message: "確実とは言えません。でも、今ある経験から始められる一歩はあります。",
    existingAssets: [
      { title: "今の状況を言葉にできていること", description: `「${trimText(plan.currentSituation, 64)}」という現在地は、次の判断材料になります。` },
      { title: "普通だと思っている経験", description: `${trimText(plan.skills, 76)}の中に、使える材料が残っています。` },
      { title: "制約を先に見ていること", description: "時間やお金を先に見ることで、無理のない始め方を選べます。" }
    ],
    missingPieces: [
      { title: "小さく試す場", description: "発信、相談、見学、試作品など、反応を得る場があると進めやすくなります。" },
      { title: "近い実例", description: "年齢や制約が近い人の進み方を見ると、現実的な順番を選べます。" }
    ],
    risks: [
      { title: "最初から大きく賭けすぎる", description: "大きな支出や退職を最初に置くと、戻りにくくなります。", avoidance: "まずは無料から低額で、1週間以内に試せる行動へ落とします。" },
      { title: "調べ続けて動けなくなる", description: "情報収集だけだと、始める日が遠くなります。", avoidance: "調査は30分で区切り、小さな外向き行動を1つ入れます。" }
    ],
    roadmap: buildRoadmap(plan),
    todayActions: [
      { title: "夢を1行にする", description: `「${plan.dreamTitle}」で誰に何を届けたいのか、粗いまま1行で書きます。`, estimatedMinutes: 8, emotionalMessage: "きれいな言葉でなくて大丈夫です。" },
      { title: "近い人を3人保存する", description: "年齢、制約、出発点が少し近い実例を3人だけ保存します。", estimatedMinutes: 15, emotionalMessage: "遠すぎる成功例より、少し近い実例が今日の味方になります。" },
      { title: "1人に小さく話す", description: "信頼できる人に「少し調べていること」として話します。", estimatedMinutes: 10, emotionalMessage: "宣言にしなくて大丈夫です。" }
    ]
  };
}

function buildRoadmap(plan) {
  const ages = Array.from({ length: plan.targetAge - plan.currentAge + 1 }, (_, index) => plan.currentAge + index);
  const total = Math.max(ages.length - 1, 1);
  return ages.map((age, index) => {
    const progress = index / total;
    if (progress === 0) return road(age, "現在地を見える形にする", ["夢を1行で書く", "近い実例を3つ集める"], "最初は夢と制約を同じ場所に置くことが大切です。", "スマホのメモに1行だけ書きます。", "動けない場合は、実例を1つ見るだけに縮めます。");
    if (progress < 0.5) return road(age, "小さく試して反応を見る", ["小さな発信や相談を行う", "必要スキルを1つ練習する"], "早い段階では、現実の反応を集めるほうが判断材料になります。", "15分だけ参考事例を保存します。", "反応が薄い場合は、対象者や出し方を変えます。");
    if (progress < 1) return road(age, "続く形を作る", ["週1回の固定時間を作る", "試したことを記録する"], "戻ってこられるリズムがあると続けやすくなります。", "カレンダーに30分だけ入れます。", "忙しい週は記録だけ残します。");
    return road(age, "形を選び直す", ["到達点を具体化する", "次の小さな目標へ分ける"], "得た反応から、達成の形を選び直します。", "記録を10分だけ読み返します。", "予定より遅れていても、期限や形を調整します。");
  });
}

function road(age, theme, actions, reason, smallStart, fallbackPlan) {
  return { age, theme, actions, reason, smallStart, risks: ["大きな決断を急ぐ", "他人の速度と比べる"], fallbackPlan };
}

function buildShareText(analysis) {
  const first = normalizeTodayAction(analysis.todayActions?.[0], 0).title || "小さく始める";
  return `今からでも遅くないかもしれない。\n今日の一歩：${first}。`;
}

function input(name, label, placeholder, type = "text") {
  return `<label><span>${label}</span><input name="${name}" type="${type}" placeholder="${placeholder}"></label>`;
}

function textarea(name, label, placeholder) {
  return `<label><span>${label}</span><textarea name="${name}" placeholder="${placeholder}"></textarea></label>`;
}

function infoCard(title, body) {
  return `<article class="soft-card info-card"><h3>${title}</h3><p>${body}</p></article>`;
}

function todayAction(action, index) {
  const item = normalizeTodayAction(action, index);
  return `
    <article class="today-card">
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <small>${escapeHtml(item.emotionalMessage)}</small>
      </div>
      <span>${Number(item.estimatedMinutes || 10)}分</span>
    </article>
  `;
}

function asset(item, index) {
  const normalized = normalizeTextItem(item, index, "整理したこと");
  return `<article class="text-item"><h4>${escapeHtml(normalized.title)}</h4><p>${escapeHtml(normalized.description)}</p></article>`;
}

function risk(item, index) {
  const normalized = normalizeRisk(item, index);
  return `<article class="text-item"><h4>${escapeHtml(normalized.title)}</h4><p>${escapeHtml(normalized.description)}</p><small>${escapeHtml(normalized.avoidance)}</small></article>`;
}

function roadmapItem(item, index) {
  const normalized = normalizeRoadmapItem(item, null, index);
  return `
    <article class="road-card">
      <div class="road-head">
        <span>${normalized.age}歳</span>
        <div>
          <h3>${escapeHtml(normalized.theme)}</h3>
          <ul>${normalized.actions.map((action) => `<li>${escapeHtml(textFrom(action, "小さく試す"))}</li>`).join("")}</ul>
          <p class="soft-note">小さく始める方法：${escapeHtml(normalized.smallStart)}</p>
        </div>
        <button class="ghost-button" data-why>なぜ？</button>
      </div>
      <div class="why">
        ${why("この順番にした理由", normalized.reason)}
        ${why("この期間が必要な理由", "調べる、試す、反応を見る、整える時間を分けています。焦りすぎないための区切りです。")}
        ${why("調査・推論の根拠", "年齢差、使える時間、お金、経験、不安から、大きな決断より小さな検証を先に置いています。")}
        ${why("遅れた場合の代替案", normalized.fallbackPlan)}
      </div>
    </article>
  `;
}

function why(title, body) {
  return `<div><strong>${title}</strong><p>${escapeHtml(body)}</p></div>`;
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function arrayOr(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function textFrom(value, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return fallback;
  return stringOr(
    value.title || value.name || value.label || value.action || value.step || value.theme || value.description || value.text || value.reason,
    fallback
  );
}

function normalizeTextItems(value, fallback, label) {
  const source = arrayOr(value, fallback);
  return source.map((item, index) => normalizeTextItem(item, index, label)).filter((item) => item.title || item.description);
}

function normalizeTextItem(item, index, label) {
  const fallbackTitle = `${label}${index + 1}`;
  if (typeof item === "string") {
    return { title: item.trim() || fallbackTitle, description: "今の状況から使える材料として整理しました。" };
  }
  const title = textFrom(item, fallbackTitle);
  const description = stringOr(
    item?.description || item?.detail || item?.body || item?.reason || item?.why,
    title === fallbackTitle ? "小さく分けて確認していきます。" : "小さな前進に使える材料として残しておきます。"
  );
  return { title, description };
}

function normalizeRisks(value, fallback) {
  const source = arrayOr(value, fallback);
  return source.map(normalizeRisk).filter((item) => item.title || item.description);
}

function normalizeRisk(item, index = 0) {
  if (typeof item === "string") {
    return {
      title: item.trim() || `避けたいリスク${index + 1}`,
      description: "焦って大きく動く前に、小さく確認しておきたい点です。",
      avoidance: "小さく試せる形へ戻します。"
    };
  }
  return {
    title: textFrom(item, `避けたいリスク${index + 1}`),
    description: stringOr(item?.description || item?.detail || item?.risk || item?.body, "焦りすぎないために先に見ておきます。"),
    avoidance: stringOr(item?.avoidance || item?.fallbackPlan || item?.fallback || item?.alternative, "小さく試せる形へ戻します。")
  };
}

function normalizeTodayActions(value, fallback) {
  const source = arrayOr(value, fallback);
  return source.map(normalizeTodayAction).filter((item) => item.title || item.description).slice(0, 6);
}

function normalizeTodayAction(item, index = 0) {
  const titles = ["夢を1行にする", "近い人を3人保存する", "1人に小さく話す", "10分だけ調べる", "メモに残す", "小さく試す"];
  if (typeof item === "string") {
    return {
      title: item.trim() || titles[index] || "小さく始める",
      description: "今日できる大きさまで小さくした一歩です。",
      estimatedMinutes: 10,
      emotionalMessage: "大きく変えなくて大丈夫です。"
    };
  }
  const minutes = Number(item?.estimatedMinutes || item?.minutes || item?.time || 10);
  return {
    title: textFrom(item, titles[index] || "小さく始める"),
    description: stringOr(item?.description || item?.detail || item?.body || item?.why, "今日できる大きさまで小さくした一歩です。"),
    estimatedMinutes: Number.isFinite(minutes) ? minutes : 10,
    emotionalMessage: stringOr(item?.emotionalMessage || item?.message || item?.note, "大きく変えなくて大丈夫です。")
  };
}

function normalizeRoadmap(value, fallback) {
  const source = arrayOr(value, fallback);
  return source.map((item, index) => normalizeRoadmapItem(item, fallback[index], index)).filter((item) => item.age);
}

function normalizeRoadmapItem(item, fallback, index = 0) {
  const base = fallback || {};
  if (typeof item === "string") {
    return {
      age: base.age || state.plan?.currentAge + index || index + 1,
      theme: item.trim() || base.theme || "小さく前へ進む",
      actions: base.actions || ["今日できる形に分ける"],
      reason: base.reason || "いきなり大きく動かず、確認しながら進むためです。",
      smallStart: base.smallStart || "10分だけメモに書きます。",
      risks: base.risks || ["焦りすぎる"],
      fallbackPlan: base.fallbackPlan || "動けない場合は、さらに小さい一歩へ戻します。"
    };
  }
  const actions = Array.isArray(item?.actions) && item.actions.length ? item.actions : base.actions || ["今日できる形に分ける"];
  return {
    age: Number(item?.age || base.age || state.plan?.currentAge + index || index + 1),
    theme: textFrom(item, base.theme || "小さく前へ進む"),
    actions,
    reason: stringOr(item?.reason || item?.why || base.reason, "いきなり大きく動かず、確認しながら進むためです。"),
    smallStart: stringOr(item?.smallStart || item?.small_start || item?.firstStep || item?.startSmall || base.smallStart, "10分だけメモに書きます。"),
    risks: Array.isArray(item?.risks) && item.risks.length ? item.risks : base.risks || ["焦りすぎる"],
    fallbackPlan: stringOr(item?.fallbackPlan || item?.fallback || item?.alternative || base.fallbackPlan, "動けない場合は、さらに小さい一歩へ戻します。")
  };
}

loadState();
render();
