const STORAGE_KEY = "iwakan_lab_ideas_v1";
const LAST_INPUT_KEY = "iwakan_lab_last_input_v1";
const IDEA_COUNT = 50;

const categories = {
  "共感": {
    tones: ["わかる人だけに刺さる", "言語化されて少し楽になる", "生活の小さな本音"],
    hooks: ["これ、地味にしんどい。", "たぶん私だけじゃない。", "誰にも言ってないけど、"],
    endings: ["同じ感覚の人、たぶんいる。", "こういう小さい本音を残しておきたい。", "わかる人だけ、そっと反応して。"]
  },
  "違和感": {
    tones: ["正しさの横にあるズレ", "みんなが流している変な空気", "言葉にすると少し不穏"],
    hooks: ["なんか変だと思った。", "これ、普通に見えて普通じゃない。", "ずっと小さな違和感がある。"],
    endings: ["この違和感、メモしておく。", "まだうまく言えないけど、たぶん大事。", "みんなはどう見えてるんだろう。"]
  },
  "懐かしさ": {
    tones: ["古い記憶のざらつき", "戻れないけど覚えている感じ", "地方の夕方みたいな温度"],
    hooks: ["これ、昔どこかで見た気がする。", "懐かしいのに、少し寂しい。", "記憶の端っこにある感じ。"],
    endings: ["あの頃の空気だけ残ってる。", "懐かしさって、たまに痛い。", "忘れてた感覚が戻ってきた。"]
  },
  "深夜テンション": {
    tones: ["眠れない時の思考", "午前2時の妙な確信", "冷静じゃないけど本音"],
    hooks: ["深夜だから言うけど、", "眠れないので変なことを書く。", "午前2時の脳内では、"],
    endings: ["朝見たら消したくなるかも。", "でも今はこれが本音。", "深夜の判断なので許してほしい。"]
  },
  "地方感": {
    tones: ["地方のリアル", "都会に説明しにくい空気", "ローカルな生活感"],
    hooks: ["地方って、こういうところがある。", "都会の言葉だと説明しにくい。", "この空気、地方の人ならわかるかも。"],
    endings: ["こういう場所からしか出ない言葉がある。", "地方のリアル、もう少し残したい。", "派手じゃないけど、ちゃんと濃い。"]
  },
  "ちょい怖": {
    tones: ["日常の薄い不穏", "説明できない怖さ", "気づいたら戻れない感じ"],
    hooks: ["ちょっと怖い話をしていい？", "よく考えると、これ怖い。", "気づかない方がよかったかも。"],
    endings: ["考えすぎならいいんだけど。", "こういう怖さが一番残る。", "日常って、たまに薄く怖い。"]
  }
};

const fragments = {
  first: ["でも", "たぶん", "実は", "なぜか", "静かに", "気づいたら", "言葉にすると"],
  middle: ["見過ごしていた", "誰も言わない", "少しだけズレている", "妙にリアルな", "説明しにくい", "忘れられない"],
  question: ["これって普通？", "自分だけ？", "どう見えてる？", "どこから変だった？", "なぜ残るんだろう？"],
  cta: ["保存してあとで考える。", "コメントで聞きたい。", "この感覚に名前をつけたい。", "続きを少しずつ書く。"]
};

const state = {
  ideas: loadIdeas(),
  lastInput: loadLastInput()
};

const els = {
  theme: document.getElementById("themeInput"),
  category: document.getElementById("categorySelect"),
  generate: document.getElementById("generateBtn"),
  clear: document.getElementById("clearBtn"),
  list: document.getElementById("ideaList"),
  empty: document.getElementById("emptyState"),
  saveStatus: document.getElementById("saveStatus"),
  total: document.getElementById("totalCount"),
  adopted: document.getElementById("adoptedCount"),
  rejected: document.getElementById("rejectedCount")
};

const IdeaGenerator = {
  generate({ theme, category, count = IDEA_COUNT }) {
    const source = categories[category] || categories["違和感"];
    return Array.from({ length: count }, (_, index) => {
      const score = scoreIdea(theme, category, index);
      const text = buildPostText(theme, category, source, index);
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        category,
        score,
        status: "new",
        createdAt: new Date().toISOString()
      };
    });
  },

  async generateWithApi(input) {
    return this.generate(input);
  }
};

function pick(list, index = 0) {
  return list[(Math.floor(Math.random() * list.length) + index) % list.length];
}

function normalizeTheme(theme) {
  return theme.trim().replace(/\s+/g, " ") || "まだ名前のない違和感";
}

function buildPostText(theme, category, source, index) {
  const cleanTheme = normalizeTheme(theme);
  const variants = [
    `${pick(source.hooks, index)}\n\n${cleanTheme}って、${pick(fragments.middle)}ものに見える。\n\n${pick(source.endings, index)}`,
    `${cleanTheme}。\n\n${pick(fragments.first)}、ここに${pick(source.tones)}がある気がする。\n\n${pick(fragments.question)}`,
    `${pick(source.hooks, index)}\n${cleanTheme}の話、ちゃんと言うと長い。\n\nでも一言でいうと「${pick(fragments.middle)}感覚」。\n\n${pick(fragments.cta)}`,
    `${cleanTheme}を見てると、${pick(source.tones)}だけが残る。\n\n派手じゃない。\nでも、なぜかスクロール後も残る。\n\n${pick(source.endings, index)}`,
    `${category}メモ。\n\n${cleanTheme}には、${pick(fragments.first)}${pick(fragments.middle)}空気がある。\n\nこういう投稿ほど、あとから伸びることがある。`
  ];

  return variants[index % variants.length];
}

function scoreIdea(theme, category, index) {
  const base = 58 + Math.floor(Math.random() * 27);
  const themeBonus = Math.min(normalizeTheme(theme).length, 42) / 3;
  const categoryBonus = category === "違和感" || category === "ちょい怖" ? 6 : 3;
  const rhythm = index % 7 === 0 ? 5 : 0;
  return Math.max(45, Math.min(99, Math.round(base + themeBonus + categoryBonus + rhythm)));
}

function loadIdeas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadLastInput() {
  try {
    return JSON.parse(localStorage.getItem(LAST_INPUT_KEY) || "{}");
  } catch {
    return {};
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ideas));
  localStorage.setItem(LAST_INPUT_KEY, JSON.stringify({
    theme: els.theme.value,
    category: els.category.value
  }));
  els.saveStatus.textContent = `保存済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

function render() {
  els.list.innerHTML = "";
  els.empty.hidden = state.ideas.length > 0;

  state.ideas.forEach((idea, index) => {
    const card = document.createElement("article");
    card.className = `idea-card ${idea.status === "adopted" ? "adopted" : ""} ${idea.status === "rejected" ? "rejected" : ""}`;

    card.innerHTML = `
      <div class="card-top">
        <span class="badge">${escapeHtml(idea.category)}</span>
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
    els.list.appendChild(card);
  });

  updateStats();
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

function generateIdeas() {
  const theme = els.theme.value.trim();
  if (!theme) {
    els.theme.focus();
    els.saveStatus.textContent = "テーマを入力してください";
    return;
  }

  const category = els.category.value;
  state.ideas = IdeaGenerator.generate({ theme, category });
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
  persist();
  render();
}

els.generate.addEventListener("click", generateIdeas);
els.clear.addEventListener("click", clearIdeas);
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
