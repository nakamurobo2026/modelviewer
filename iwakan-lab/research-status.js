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
    patchResearchUi();
    patchGenerationInput();
    if (host) {
      new MutationObserver(renderStatus).observe(host, { childList: true, subtree: true });
      renderStatus();
    }
  }

  function cleanTheme(value) {
    return String(value || "")
      .replace(/Observation Structから投稿化する。?/g, "")
      .replace(/Research Summary:[\s\S]*$/g, "")
      .replace(/Priority [SABC][\s\S]*$/g, "")
      .replace(/hooks:[\s\S]*$/g, "")
      .replace(/phrases:[\s\S]*$/g, "")
      .replace(/buzzElements:[\s\S]*$/g, "")
      .replace(/recommendedPostAngles:[\s\S]*$/g, "")
      .replace(/元投稿は丸写しせず[\s\S]*$/g, "")
      .replace(/リサーチ:[\s\S]*$/g, "")
      .replace(/人格:[\s\S]*$/g, "")
      .trim()
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
  }

  function autoSources() {
    const theme = cleanTheme(document.getElementById("themeInput")?.value) || "地方の古いスーパー";
    const category = document.getElementById("categorySelect")?.value || "違和感";
    const persona = document.getElementById("personaSelect")?.value || "違和感ノート";
    return [
      `${theme} Threads 伸びている投稿 コメント`,
      `${theme} X 話題 あるある 共感`,
      `${theme} TikTok Reels 流行 構文`,
      `${theme} Instagram Reels 伸びた投稿`,
      `${theme} ${category} バズる 観察`,
      `${theme} ${persona} 具体描写`
    ];
  }

  function patchResearchUi() {
    if (document.getElementById("autoResearchCard")) return;
    const input = document.getElementById("researchInput");
    const split = document.getElementById("splitResearchBtn");
    const extract = document.getElementById("extractBuzzBtn");
    const saveBuzz = document.getElementById("saveBuzzBtn");
    const title = document.getElementById("research-title");
    const filter = document.getElementById("sourcePriorityFilter");
    const reflect = document.getElementById("researchReflectToggle");
    const anchor = input || reflect || filter;
    const style = document.createElement("style");
    style.textContent = `
      label[for="researchInput"], label[for="researchSourceType"], #researchInput, #researchSourceType, #saveResearchBtn { display: none !important; }
      .auto-research-card{border:1px solid var(--line);border-radius:8px;background:#0a0c10;padding:14px;margin:10px 0 14px}
      .auto-research-card b{display:block;color:var(--ink);font-size:15px;margin-bottom:4px}
      .auto-research-card p{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
      .auto-research-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .auto-research-tags span{border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--accent);font-size:11px;font-weight:800;padding:5px 7px}
    `;
    document.head.appendChild(style);
    if (title) title.textContent = "市場リサーチ";
    if (filter) {
      const manual = [...filter.options].find((option) => option.value === "manual");
      if (manual) manual.textContent = "保存DBのみ";
    }
    if (split) split.textContent = "自動リサーチ";
    if (extract) extract.textContent = "バズ要素取得";
    if (saveBuzz) saveBuzz.textContent = "抽出結果を保存";
    const card = document.createElement("div");
    card.id = "autoResearchCard";
    card.className = "auto-research-card";
    card.innerHTML = `<b>投稿テーマから自動取得</b><p>投稿テーマ、カテゴリ、人格をもとにTavilyで関連情報を取得し、バズ要素へ分解します。</p><div class="auto-research-tags"><span>Threads傾向</span><span>X / Reels構文</span><span>ニュース・ブログ</span><span>手動入力なし</span></div>`;
    anchor?.insertAdjacentElement("beforebegin", card);
    if (input) input.value = autoSources().join("\n");
    [split, extract, document.getElementById("refreshResearchBtn")].forEach((button) => {
      button?.addEventListener("click", () => {
        if (input) input.value = autoSources().join("\n");
      }, true);
    });
  }

  function patchGenerationInput() {
    const theme = document.getElementById("themeInput");
    if (theme) {
      const clean = cleanTheme(theme.value);
      if (clean && clean !== theme.value) {
        theme.value = clean;
        try {
          const last = JSON.parse(localStorage.getItem("iwakan_lab_last_input_v1") || "{}");
          localStorage.setItem("iwakan_lab_last_input_v1", JSON.stringify({ ...last, theme: clean }));
        } catch {}
      }
    }
    document.getElementById("generateBtn")?.addEventListener("click", () => {
      const input = document.getElementById("researchInput");
      if (input) input.value = autoSources().join("\n");
      if (theme) theme.value = cleanTheme(theme.value) || theme.value;
    }, true);
    if (window.AIClient?.generate && !window.AIClient.__iwakanPatched) {
      const originalGenerate = window.AIClient.generate;
      window.AIClient.generate = (payload = {}) => originalGenerate({ ...payload, theme: cleanTheme(payload.theme) || cleanTheme(theme?.value) || payload.theme });
      window.AIClient.__iwakanPatched = true;
    }
    if (window.TemplateGenerator && !window.TemplateGenerator.__iwakanPatched) {
      const originalNormalize = window.TemplateGenerator.normalizeTheme;
      window.TemplateGenerator.normalizeTheme = (value) => originalNormalize(cleanTheme(value) || value);
      window.TemplateGenerator.__iwakanPatched = true;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
