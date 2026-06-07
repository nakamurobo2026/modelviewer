const IDEA_COUNT = window.TemplateGenerator.IDEA_COUNT;

const state = {
  ideas: normalizeStoredIdeas(window.IwakanStorage.getIdeas()),
  lastInput: window.IwakanStorage.getLastInput(),
  viewMode: window.IwakanStorage.getView().mode || "all",
  singleIndex: 0,
  isLoading: false
};

const els = {
  theme: document.getElementById("themeInput"),
  category: document.getElementById("categorySelect"),
  generate: document.getElementById("generateBtn"),
  clear: document.getElementById("clearBtn"),
  settings: document.getElementById("settingsBtn"),
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
  rejected: document.getElementById("rejectedCount"),
  history: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistoryBtn"),
  error: document.getElementById("errorMessage"),
  loading: document.getElementById("loadingOverlay"),
  apiModal: document.getElementById("apiKeyModal"),
  edgeUrl: document.getElementById("apiKeyInput"),
  toggleEdgeUrl: document.getElementById("toggleApiKeyBtn"),
  saveEdgeUrl: document.getElementById("saveApiKeyBtn"),
  skipEdgeUrl: document.getElementById("skipApiKeyBtn"),
  clearEdgeUrl: document.getElementById("clearApiKeyBtn")
};

function normalizeStoredIdeas(ideas) {
  return ideas.map((idea, index) => ({ ...idea, id: idea.id || `stored-${index}`, hookType: idea.hookType || idea.hook || "未分類", status: idea.status || "new" }));
}

function persist() {
  window.IwakanStorage.setIdeas(state.ideas);
  window.IwakanStorage.setLastInput({ theme: els.theme.value, category: els.category.value });
  window.IwakanStorage.setView({ mode: state.viewMode });
  els.saveStatus.textContent = `保存済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

function render() {
  els.list.innerHTML = "";
  els.empty.hidden = state.ideas.length > 0;
  state.singleIndex = clamp(state.singleIndex, 0, Math.max(0, state.ideas.length - 1));
  const visibleIdeas = state.viewMode === "one" && state.ideas.length ? [state.ideas[state.singleIndex]] : state.ideas;
  visibleIdeas.forEach((idea, index) => {
    const globalIndex = state.viewMode === "one" ? state.singleIndex : index;
    els.list.appendChild(createIdeaCard(idea, globalIndex));
  });
  renderMode();
  updateStats();
  renderHistory();
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
    <p class="meta">#${index + 1} / ${statusLabel(idea.status)}</p>`;
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

function renderHistory() {
  const history = window.IwakanStorage.getHistory();
  if (!history.length) {
    els.history.textContent = "履歴はまだありません。";
    return;
  }
  els.history.innerHTML = history.map((item) => `
    <div class="history-item">
      <b>${escapeHtml(item.theme || "無題")}</b>
      <span>${escapeHtml(item.category || "-")} / ${escapeHtml(item.source || "local")} / ${escapeHtml(item.time || "")}</span>
    </div>`).join("");
}

function pushHistory({ theme, category, source }) {
  const history = window.IwakanStorage.getHistory();
  history.unshift({ theme, category, source, time: new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) });
  window.IwakanStorage.setHistory(history);
}

function statusLabel(status) {
  if (status === "adopted") return "採用済み";
  if (status === "rejected") return "不採用";
  return "未判定";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  els.loading.hidden = !isLoading;
  els.generate.disabled = isLoading;
  els.tuneButtons.forEach((button) => { button.disabled = isLoading; });
}

function showError(message) {
  if (!message) {
    els.error.hidden = true;
    els.error.textContent = "";
    return;
  }
  els.error.hidden = false;
  els.error.textContent = message;
}

function openApiModal() {
  window.IwakanStorage.clearLegacyOpenAISecrets?.();
  els.edgeUrl.value = window.IwakanStorage.getEdgeFunctionUrl();
  els.edgeUrl.type = "url";
  els.toggleEdgeUrl.textContent = "隠す";
  if (typeof els.apiModal.showModal === "function") els.apiModal.showModal();
}

function closeApiModal() {
  window.IwakanStorage.markApiModalSeen();
  els.apiModal.close();
}

async function generatePosts(tune = null) {
  const theme = els.theme.value.trim();
  if (!theme) {
    els.theme.focus();
    els.saveStatus.textContent = "テーマを入力してください";
    return;
  }

  const category = tune || els.category.value;
  if (tune) els.category.value = category;
  const workerUrl = window.IwakanStorage.getEdgeFunctionUrl();
  let source = "local";

  setLoading(true);
  showError("");
  try {
    if (workerUrl) {
      const aiResult = await window.AIClient.generate({ endpointUrl: workerUrl, theme, category, tune, count: IDEA_COUNT });
      state.ideas = aiResult.ideas.slice(0, IDEA_COUNT).map((idea, index) => window.TemplateGenerator.normalizeIdea(idea, category, index));
      source = `Cloudflare Worker ${aiResult.model || "gpt-5-mini"}`;
      els.saveStatus.textContent = `AI生成完了: ${aiResult.model || "gpt-5-mini"}`;
    } else {
      state.ideas = window.TemplateGenerator.generate({ theme, category, tune, count: IDEA_COUNT });
      els.saveStatus.textContent = "テンプレート生成で作成しました";
    }
  } catch (error) {
    console.error("Cloudflare Worker generation failed. Falling back to template generation.", {
      message: error.message,
      endpoint: error.endpoint,
      status: error.status,
      detail: error.detail,
      rawResponse: error.rawResponse,
      error
    });
    state.ideas = window.TemplateGenerator.generate({ theme, category, tune, count: IDEA_COUNT });
    source = "local fallback";
    showError(`AI生成に失敗しました。ローカル生成に切り替えました。${error.message || ""}`);
    els.saveStatus.textContent = "Cloudflare Worker失敗。テンプレート生成へ戻しました";
  } finally {
    state.singleIndex = 0;
    pushHistory({ theme, category, source });
    persist();
    render();
    els.list.firstElementChild?.classList.add("toast");
    setLoading(false);
  }
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

els.generate.addEventListener("click", () => generatePosts());
els.clear.addEventListener("click", clearIdeas);
els.clearHistory.addEventListener("click", () => { window.IwakanStorage.clearHistory(); renderHistory(); });
els.settings.addEventListener("click", openApiModal);
els.showAll.addEventListener("click", () => setViewMode("all"));
els.showOne.addEventListener("click", () => setViewMode("one"));
els.prevIdea.addEventListener("click", () => { state.singleIndex = clamp(state.singleIndex - 1, 0, Math.max(0, state.ideas.length - 1)); render(); });
els.nextIdea.addEventListener("click", () => { state.singleIndex = clamp(state.singleIndex + 1, 0, Math.max(0, state.ideas.length - 1)); render(); });
els.tuneButtons.forEach((button) => button.addEventListener("click", () => generatePosts(button.dataset.tune)));
els.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "copy") copyIdea(id);
  if (action === "adopt") updateStatus(id, "adopted");
  if (action === "reject") updateStatus(id, "rejected");
});
els.saveEdgeUrl.addEventListener("click", () => {
  const endpointUrl = els.edgeUrl.value.trim();
  if (endpointUrl) window.IwakanStorage.setEdgeFunctionUrl(endpointUrl);
  else window.IwakanStorage.clearEdgeFunctionUrl();
  window.IwakanStorage.clearLegacyOpenAISecrets?.();
  closeApiModal();
  els.saveStatus.textContent = endpointUrl ? "Cloudflare Worker URLを保存しました" : "AI未設定です。ローカル生成で動きます";
});
els.toggleEdgeUrl.addEventListener("click", () => {
  const visible = els.edgeUrl.type === "url" || els.edgeUrl.type === "text";
  els.edgeUrl.type = visible ? "password" : "url";
  els.toggleEdgeUrl.textContent = visible ? "表示" : "隠す";
});
els.skipEdgeUrl.addEventListener("click", closeApiModal);
els.clearEdgeUrl.addEventListener("click", () => {
  window.IwakanStorage.clearEdgeFunctionUrl();
  window.IwakanStorage.clearLegacyOpenAISecrets?.();
  els.edgeUrl.value = "";
  closeApiModal();
  els.saveStatus.textContent = "Cloudflare Worker URLを削除しました";
});

if (state.lastInput.theme) els.theme.value = state.lastInput.theme;
if (state.lastInput.category) els.category.value = state.lastInput.category;
window.IwakanStorage.clearLegacyOpenAISecrets?.();
if (!window.IwakanStorage.hasSeenApiModal() && !window.IwakanStorage.getEdgeFunctionUrl()) window.addEventListener("load", openApiModal);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => { els.saveStatus.textContent = "PWA登録に失敗しました"; });
  });
}
