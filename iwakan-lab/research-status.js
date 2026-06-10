(function () {
  const labels = {
    tavily: "Tavily検索",
    "tavily-cache": "Tavilyキャッシュ",
    "tavily-key-missing": "Tavilyキー未認識",
    "tavily-empty-query": "検索語なし",
    "tavily-error": "Tavily失敗",
    "not-run": "未検索"
  };

  function readSummary() {
    try {
      return JSON.parse(localStorage.getItem("iwakan_lab_research_v1") || "{}").summary || null;
    } catch {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function renderStatus() {
    const host = document.getElementById("buzzResults");
    if (!host || host.querySelector("[data-tavily-status]")) return;
    const summary = readSummary();
    if (!summary) return;
    const source = summary.tavilySource || "not-run";
    const count = Number(summary.tavilyCount || 0);
    const html = `<div class="source-impact" data-tavily-status><span>${escapeHtml(labels[source] || source)}</span><span>取得 ${count}件</span></div>`;
    const title = host.querySelector(".buzz-summary h3");
    if (title) title.insertAdjacentHTML("afterend", html);
  }

  function boot() {
    const host = document.getElementById("buzzResults");
    if (!host) return;
    new MutationObserver(renderStatus).observe(host, { childList: true, subtree: true });
    renderStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
