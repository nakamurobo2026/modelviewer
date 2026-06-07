const STORAGE_KEY = "iwakan_lab_ideas_v1";
const LAST_INPUT_KEY = "iwakan_lab_last_input_v1";
const VIEW_KEY = "iwakan_lab_view_v1";
const IDEA_COUNT = 50;

const hookTypes = [
  "本音メモ",
  "違和感メモ",
  "問いかけ",
  "深夜メモ",
  "余白オチ",
  "記憶の断片",
  "地方の空気",
  "薄い不穏"
];

const categoryTemplates = {
  "共感": [
    { hookType: "本音メモ", text: "{theme}、平気なふりしてる人ほど分かる気がする。" },
    { hookType: "問いかけ", text: "{theme}って、みんな本当はちょっと疲れてない？" },
    { hookType: "余白オチ", text: "{theme}。言わないだけで、抱えてる人多そう。" },
    { hookType: "本音メモ", text: "ちゃんとしたいのに、{theme}で止まる日がある。" },
    { hookType: "問いかけ", text: "{theme}がしんどいの、自分だけじゃないと思いたい。" },
    { hookType: "本音メモ", text: "大げさじゃなく、{theme}で一日が少し重くなる。" },
    { hookType: "余白オチ", text: "{theme}。笑えるけど、少しだけ本気でつらい。" },
    { hookType: "問いかけ", text: "誰にも言ってないけど、{theme}で地味に消耗する。" },
    { hookType: "本音メモ", text: "{theme}を気にしない人になりたかった。" },
    { hookType: "余白オチ", text: "{theme}、小さいことなのに心に残る。" },
    { hookType: "問いかけ", text: "{theme}の話、ちゃんとすると長くなる人いる？" },
    { hookType: "本音メモ", text: "余裕がない日は、{theme}すら刺さる。" },
    { hookType: "余白オチ", text: "{theme}って、生活の端っこにある本音かも。" },
    { hookType: "問いかけ", text: "{theme}で黙っちゃう瞬間、あるよね。" },
    { hookType: "本音メモ", text: "強く言えないけど、{theme}はけっこう分かる。" },
    { hookType: "余白オチ", text: "{theme}、なんでもない顔で残り続ける。" },
    { hookType: "問いかけ", text: "{theme}を見て、ちょっと安心した人いる？" },
    { hookType: "本音メモ", text: "本当に疲れてる時、{theme}みたいなことが響く。" },
    { hookType: "余白オチ", text: "{theme}。これだけで今日の説明になる。" },
    { hookType: "問いかけ", text: "分かる人だけでいい。{theme}、ちょっとあるよね。" },
    { hookType: "本音メモ", text: "{theme}を笑える日は、たぶんまだ大丈夫。" },
    { hookType: "余白オチ", text: "言葉にすると軽いけど、{theme}は重い。" }
  ],
  "違和感": [
    { hookType: "違和感メモ", text: "{theme}、普通っぽいのに少しだけ変。" },
    { hookType: "問いかけ", text: "{theme}を見て、なんか引っかかったの自分だけ？" },
    { hookType: "余白オチ", text: "{theme}。説明できないズレだけ残った。" },
    { hookType: "違和感メモ", text: "{theme}って、正しそうで少し怖い。" },
    { hookType: "問いかけ", text: "みんな流してるけど、{theme}って変じゃない？" },
    { hookType: "違和感メモ", text: "{theme}の中に、言葉にしにくいノイズがある。" },
    { hookType: "余白オチ", text: "{theme}。気づいた瞬間、戻れなくなる。" },
    { hookType: "問いかけ", text: "{theme}に慣れたら終わりな気がしてる。" },
    { hookType: "違和感メモ", text: "便利なのに、{theme}だけ妙にざらつく。" },
    { hookType: "余白オチ", text: "{theme}、たぶん小さい違和感の入口。" },
    { hookType: "問いかけ", text: "{theme}を笑って済ませていいのかな。" },
    { hookType: "違和感メモ", text: "{theme}が当たり前になる空気、少しこわい。" },
    { hookType: "余白オチ", text: "{theme}。嫌いじゃないのに落ち着かない。" },
    { hookType: "問いかけ", text: "{theme}、なぜか心が一歩引く。" },
    { hookType: "違和感メモ", text: "きれいに見えるほど、{theme}の違和感が残る。" },
    { hookType: "余白オチ", text: "{theme}には、まだ名前のないズレがある。" },
    { hookType: "問いかけ", text: "{theme}を見て黙った人、たぶん同じ。" },
    { hookType: "違和感メモ", text: "{theme}、正解っぽい顔をした未解決。" },
    { hookType: "余白オチ", text: "{theme}。気にしない人には見えない線。" },
    { hookType: "問いかけ", text: "{theme}って、どこから普通じゃなくなった？" },
    { hookType: "違和感メモ", text: "{theme}を言語化すると、少し空気が変わる。" },
    { hookType: "余白オチ", text: "{theme}、小さいのに無視できない。" }
  ],
  "懐かしさ": [
    { hookType: "記憶の断片", text: "{theme}、昔どこかで見た気がする。" },
    { hookType: "余白オチ", text: "{theme}。懐かしいのに、少しだけ寂しい。" },
    { hookType: "問いかけ", text: "{theme}で急に昔を思い出す人いる？" },
    { hookType: "記憶の断片", text: "{theme}には、夕方の匂いがある。" },
    { hookType: "余白オチ", text: "{theme}、戻れない場所みたいで残る。" },
    { hookType: "問いかけ", text: "{theme}が懐かしい理由、うまく言えない。" },
    { hookType: "記憶の断片", text: "{theme}を見ると、古い記憶が少し起きる。" },
    { hookType: "余白オチ", text: "{theme}。忘れてた温度だけ戻ってきた。" },
    { hookType: "問いかけ", text: "{theme}って、なぜか平成の端っこ感ある。" },
    { hookType: "記憶の断片", text: "{theme}、誰かの実家みたいな安心感がある。" },
    { hookType: "余白オチ", text: "{theme}は、懐かしさと不安の間にある。" },
    { hookType: "問いかけ", text: "{theme}で胸が少し痛いの、何なんだろう。" },
    { hookType: "記憶の断片", text: "{theme}には、もう戻れない日の光がある。" },
    { hookType: "余白オチ", text: "{theme}。古いけど、終わってない感じがする。" },
    { hookType: "問いかけ", text: "{theme}を見て静かになる人、いると思う。" },
    { hookType: "記憶の断片", text: "{theme}、記憶のすみに残ってた景色みたい。" },
    { hookType: "余白オチ", text: "{theme}。懐かしいものほど、少し怖い。" },
    { hookType: "問いかけ", text: "{theme}って、誰の記憶にも少しありそう。" },
    { hookType: "記憶の断片", text: "{theme}を見た瞬間、昔の音がした。" },
    { hookType: "余白オチ", text: "{theme}、説明より先に懐かしい。" },
    { hookType: "問いかけ", text: "{theme}で思い出す場所、ある？" },
    { hookType: "記憶の断片", text: "{theme}。忘れてたのに、消えてなかった。" }
  ],
  "深夜テンション": [
    { hookType: "深夜メモ", text: "深夜だから言うけど、{theme}って妙に刺さる。" },
    { hookType: "問いかけ", text: "{theme}のこと、午前2時に考えるの危険。" },
    { hookType: "余白オチ", text: "{theme}。朝見たら消したくなる本音。" },
    { hookType: "深夜メモ", text: "眠れない夜ほど、{theme}が大きく見える。" },
    { hookType: "問いかけ", text: "{theme}って、深夜だけ正体を出さない？" },
    { hookType: "深夜メモ", text: "今だけ言う。{theme}、かなり分かる。" },
    { hookType: "余白オチ", text: "{theme}。冷静じゃないけど、嘘でもない。" },
    { hookType: "問いかけ", text: "{theme}を考えてたら、眠れなくなった。" },
    { hookType: "深夜メモ", text: "午前2時の脳には、{theme}がちょうどいい。" },
    { hookType: "余白オチ", text: "{theme}。深夜の判断なので許してほしい。" },
    { hookType: "問いかけ", text: "{theme}、夜だけ少し意味が変わる。" },
    { hookType: "深夜メモ", text: "静かな時間に見る{theme}、ちょっと危ない。" },
    { hookType: "余白オチ", text: "{theme}。昼なら流せるのに、夜は残る。" },
    { hookType: "問いかけ", text: "{theme}で急に人生を考え始める夜ある。" },
    { hookType: "深夜メモ", text: "眠れないので、{theme}の違和感だけ置いておく。" },
    { hookType: "余白オチ", text: "{theme}。深夜にだけ本音っぽくなる。" },
    { hookType: "問いかけ", text: "{theme}が気になる夜、だいたい疲れてる。" },
    { hookType: "深夜メモ", text: "深夜の{theme}、変に優しくて怖い。" },
    { hookType: "余白オチ", text: "{theme}。寝たら忘れるかもしれないけど。" },
    { hookType: "問いかけ", text: "{theme}、今だけ分かる人いる？" },
    { hookType: "深夜メモ", text: "午前2時、{theme}だけ妙に正しい気がする。" },
    { hookType: "余白オチ", text: "{theme}。明日の自分に説明できない。" }
  ],
  "地方感": [
    { hookType: "地方の空気", text: "{theme}、地方だと妙にリアル。" },
    { hookType: "問いかけ", text: "{theme}って、都会の言葉だと説明しにくい。" },
    { hookType: "余白オチ", text: "{theme}。派手じゃないけど、ちゃんと濃い。" },
    { hookType: "地方の空気", text: "{theme}には、ローカルな生活感がある。" },
    { hookType: "問いかけ", text: "{theme}を見て地元を思い出す人いる？" },
    { hookType: "地方の空気", text: "地方の{theme}、静かな強さがある。" },
    { hookType: "余白オチ", text: "{theme}。説明しない方が伝わる空気。" },
    { hookType: "問いかけ", text: "{theme}、この距離感が地方っぽい。" },
    { hookType: "地方の空気", text: "{theme}には、店の裏口みたいなリアルがある。" },
    { hookType: "余白オチ", text: "{theme}。きれいすぎないから残る。" },
    { hookType: "問いかけ", text: "{theme}を見て、なんか実家感あると思った。" },
    { hookType: "地方の空気", text: "{theme}、地方の夕方みたいな温度。" },
    { hookType: "余白オチ", text: "{theme}。小さい町の大きい感情。" },
    { hookType: "問いかけ", text: "{theme}って、地元の人ほど黙るかも。" },
    { hookType: "地方の空気", text: "{theme}には、地方でしか出ない間がある。" },
    { hookType: "余白オチ", text: "{theme}。不便さごと愛着になる感じ。" },
    { hookType: "問いかけ", text: "{theme}、都会なら見逃されそう。" },
    { hookType: "地方の空気", text: "{theme}の静けさ、地方のリアルに近い。" },
    { hookType: "余白オチ", text: "{theme}。何も起きてないのに見てしまう。" },
    { hookType: "問いかけ", text: "{theme}に安心するの、地方出身だから？" },
    { hookType: "地方の空気", text: "{theme}、地味だけど嘘がない。" },
    { hookType: "余白オチ", text: "{theme}。ここからしか出ない言葉がある。" }
  ],
  "ちょい怖": [
    { hookType: "薄い不穏", text: "{theme}、よく考えると少し怖い。" },
    { hookType: "問いかけ", text: "{theme}を見て、背中が少し静かになった。" },
    { hookType: "違和感メモ", text: "{theme}。怖いほどじゃないのに残る。" },
    { hookType: "薄い不穏", text: "{theme}って、日常の端にある不穏。" },
    { hookType: "問いかけ", text: "{theme}、気づかない方がよかったかも。" },
    { hookType: "余白オチ", text: "{theme}。考えすぎならいいんだけど。" },
    { hookType: "薄い不穏", text: "{theme}の普通さが、逆にちょっと怖い。" },
    { hookType: "問いかけ", text: "{theme}を見て安心できないの、なぜ。" },
    { hookType: "違和感メモ", text: "{theme}。説明できない怖さだけある。" },
    { hookType: "薄い不穏", text: "{theme}、明るい場所で見るほど不穏。" },
    { hookType: "問いかけ", text: "{theme}って、どこかで見た怖さじゃない？" },
    { hookType: "余白オチ", text: "{theme}。怖い話の前半みたい。" },
    { hookType: "薄い不穏", text: "{theme}の違和感、あとから来る。" },
    { hookType: "問いかけ", text: "{theme}、誰も気にしてないのが怖い。" },
    { hookType: "違和感メモ", text: "{theme}。静かすぎるものは少し怖い。" },
    { hookType: "薄い不穏", text: "{theme}、日常に混ざってるから怖い。" },
    { hookType: "問いかけ", text: "{theme}を見たあと、少し黙った。" },
    { hookType: "余白オチ", text: "{theme}。怖くない顔をした怖さ。" },
    { hookType: "薄い不穏", text: "{theme}の余白に、何かある気がする。" },
    { hookType: "問いかけ", text: "{theme}、これ以上考えない方がいい？" },
    { hookType: "違和感メモ", text: "{theme}。何も起きてないのが怖い。" },
    { hookType: "余白オチ", text: "{theme}。気づいた人だけ少し怖い。" }
  ]
};

const tuneMap = {
  "共感": ["共感", "深夜テンション"],
  "違和感": ["違和感", "ちょい怖"],
  "懐かしさ": ["懐かしさ", "地方感"]
};

const state = {
  ideas: normalizeStoredIdeas(loadIdeas()),
  lastInput: loadLastInput(),
  viewMode: loadViewMode(),
  singleIndex: 0
};

const els = {
  theme: document.getElementById("themeInput"),
  category: document.getElementById("categorySelect"),
  generate: document.getElementById("generateBtn"),
  clear: document.getElementById("clearBtn"),
  showAll: document.getElementById("showAllBtn"),
  showOne: document.getElementById("showOneBtn"),
  tuneButtons: document.querySelectorAll("[data-tune]"),
  singleControls: document.getElementById("singleControls"),
  prevIdea: document.getElementById("prevIdeaBtn"),
  nextIdea: document.getElementById("nextIdeaBtn"),
  singleIndex: document.getElementById("singleIndex"),
  list: document.getElementById("ideaList"),
  empty: document.getElementById("emptyState"),
  saveStatus: document.getElementById("saveStatus"),
  total: document.getElementById("totalCount"),
  adopted: document.getElementById("adoptedCount"),
  rejected: document.getElementById("rejectedCount")
};

const IdeaGenerator = {
  generate({ theme, category, count = IDEA_COUNT, tune = null }) {
    const cleanTheme = normalizeTheme(theme);
    const poolCategories = tuneMap[tune] || [category];
    const selected = buildTemplateSequence(poolCategories, count);

    return selected.map(({ category: itemCategory, template }, index) => {
      const text = polishLength(applyTemplate(template.text, cleanTheme), cleanTheme);
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        category: itemCategory,
        score: scoreIdea(text, itemCategory, template.hookType, index),
        hookType: template.hookType,
        status: "new",
        createdAt: new Date().toISOString()
      };
    });
  },

  async generateWithApi(input) {
    return this.generate(input);
  }
};

function buildTemplateSequence(poolCategories, count) {
  const buckets = poolCategories.map((category) => ({
    category,
    templates: shuffle(categoryTemplates[category] || categoryTemplates["違和感"]),
    cursor: 0
  }));
  const result = [];
  let lastHook = "";
  let lastCategory = "";

  for (let i = 0; i < count; i++) {
    const bucket = buckets[i % buckets.length];
    let template = bucket.templates[bucket.cursor % bucket.templates.length];
    bucket.cursor += 1;

    if ((template.hookType === lastHook || bucket.category === lastCategory) && bucket.templates.length > 1) {
      template = bucket.templates[bucket.cursor % bucket.templates.length];
      bucket.cursor += 1;
    }

    result.push({ category: bucket.category, template });
    lastHook = template.hookType;
    lastCategory = bucket.category;
  }

  return result;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function applyTemplate(template, theme) {
  return template.replaceAll("{theme}", theme);
}

function normalizeTheme(theme) {
  return theme.trim().replace(/\s+/g, " ") || "まだ名前のない違和感";
}

function polishLength(text, theme) {
  const clean = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= 90) return clean;

  const compactTheme = theme.length > 22 ? `${theme.slice(0, 22)}…` : theme;
  return clean.replaceAll(theme, compactTheme).slice(0, 88).replace(/[、。,.!?？!]*$/, "") + "。";
}

function scoreIdea(text, category, hookType, index) {
  const lengthScore = text.length >= 20 && text.length <= 90 ? 18 : 5;
  const categoryScore = category === "違和感" || category === "ちょい怖" ? 10 : 7;
  const hookScore = hookType.includes("問い") || hookType.includes("余白") ? 8 : 5;
  const rhythm = index % 9 === 0 ? 5 : Math.floor(Math.random() * 9);
  return Math.max(48, Math.min(98, 54 + lengthScore + categoryScore + hookScore + rhythm));
}

function loadIdeas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function normalizeStoredIdeas(ideas) {
  return ideas.map((idea) => ({
    ...idea,
    hookType: idea.hookType || "未分類",
    status: idea.status || "new"
  }));
}

function loadLastInput() {
  try {
    return JSON.parse(localStorage.getItem(LAST_INPUT_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadViewMode() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) || "{}").mode || "all";
  } catch {
    return "all";
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ideas));
  localStorage.setItem(LAST_INPUT_KEY, JSON.stringify({
    theme: els.theme.value,
    category: els.category.value
  }));
  localStorage.setItem(VIEW_KEY, JSON.stringify({ mode: state.viewMode }));
  els.saveStatus.textContent = `保存済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

function render() {
  els.list.innerHTML = "";
  els.empty.hidden = state.ideas.length > 0;
  state.singleIndex = clamp(state.singleIndex, 0, Math.max(0, state.ideas.length - 1));

  const visibleIdeas = state.viewMode === "one" && state.ideas.length
    ? [state.ideas[state.singleIndex]]
    : state.ideas;

  visibleIdeas.forEach((idea, index) => {
    const globalIndex = state.viewMode === "one" ? state.singleIndex : index;
    els.list.appendChild(createIdeaCard(idea, globalIndex));
  });

  renderMode();
  updateStats();
}

function createIdeaCard(idea, index) {
  const card = document.createElement("article");
  card.className = `idea-card ${idea.status === "adopted" ? "adopted" : ""} ${idea.status === "rejected" ? "rejected" : ""}`;
  card.innerHTML = `
    <div class="card-top">
      <span class="badge">${escapeHtml(idea.category)}</span>
      <span class="hook">${escapeHtml(idea.hookType || "未分類")}</span>
      <span class="score">バズ予測 <span>${idea.score}</span></span>
    </div>
    <p class="idea-text">${escapeHtml(idea.text)}</p>
    <div class="card-actions">
      <button class="mini" data-action="copy" data-id="${idea.id}">コピー</button>
      <button class="mini adopt" data-action="adopt" data-id="${idea.id}">採用</button>
      <button class="mini reject" data-action="reject" data-id="${idea.id}">不採用</button>
    </div>
    <p class="meta">#${index + 1} / ${statusLabel(idea.status)}</p>
  `;
  return card;
}

function renderMode() {
  const isOne = state.viewMode === "one";
  els.showAll.classList.toggle("active", !isOne);
  els.showOne.classList.toggle("active", isOne);
  els.singleControls.hidden = !isOne || state.ideas.length === 0;
  els.singleIndex.textContent = state.ideas.length ? `${state.singleIndex + 1} / ${state.ideas.length}` : "0 / 0";
}

function updateStats() {
  els.total.textContent = state.ideas.length;
  els.adopted.textContent = state.ideas.filter((idea) => idea.status === "adopted").length;
  els.rejected.textContent = state.ideas.filter((idea) => idea.status === "rejected").length;
}

function statusLabel(status) {
  if (status === "adopted") return "採用済み";
  if (status === "rejected") return "不採用";
  return "未判定";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function generateIdeas(tune = null) {
  const theme = els.theme.value.trim();
  if (!theme) {
    els.theme.focus();
    els.saveStatus.textContent = "テーマを入力してください";
    return;
  }

  const category = tune || els.category.value;
  if (tune) els.category.value = category;
  state.ideas = IdeaGenerator.generate({ theme, category, tune });
  state.singleIndex = 0;
  persist();
  render();
  els.list.firstElementChild?.classList.add("toast");
}

async function copyIdea(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) return;
  await navigator.clipboard.writeText(idea.text);
  els.saveStatus.textContent = "コピーしました";
}

function updateStatus(id, status) {
  state.ideas = state.ideas.map((idea) => idea.id === id ? { ...idea, status } : idea);
  persist();
  render();
}

function clearIdeas() {
  if (!state.ideas.length) return;
  if (!confirm("保存済みの投稿案を削除しますか？")) return;
  state.ideas = [];
  state.singleIndex = 0;
  persist();
  render();
}

function setViewMode(mode) {
  state.viewMode = mode;
  persist();
  render();
}

els.generate.addEventListener("click", () => generateIdeas());
els.clear.addEventListener("click", clearIdeas);
els.showAll.addEventListener("click", () => setViewMode("all"));
els.showOne.addEventListener("click", () => setViewMode("one"));
els.prevIdea.addEventListener("click", () => {
  state.singleIndex = clamp(state.singleIndex - 1, 0, Math.max(0, state.ideas.length - 1));
  render();
});
els.nextIdea.addEventListener("click", () => {
  state.singleIndex = clamp(state.singleIndex + 1, 0, Math.max(0, state.ideas.length - 1));
  render();
});
els.tuneButtons.forEach((button) => {
  button.addEventListener("click", () => generateIdeas(button.dataset.tune));
});
els.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "copy") copyIdea(id);
  if (action === "adopt") updateStatus(id, "adopted");
  if (action === "reject") updateStatus(id, "rejected");
});

if (state.lastInput.theme) els.theme.value = state.lastInput.theme;
if (state.lastInput.category) els.category.value = state.lastInput.category;

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      els.saveStatus.textContent = "PWA登録に失敗しました";
    });
  });
}
