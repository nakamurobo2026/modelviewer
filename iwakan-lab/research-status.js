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
    applySummaryTheme(summary);
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
      .auto-research-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .auto-research-actions button{min-height:42px;border-radius:8px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font-weight:800;cursor:pointer}
      .auto-research-actions button:first-child{background:var(--accent);color:#151700;border-color:var(--accent)}
      @media(max-width:620px){.auto-research-actions{grid-template-columns:1fr}}
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
    card.innerHTML = `<b>投稿テーマから自動取得</b><p>Research Summaryからバズ要素を解析し、投稿テーマとThreads投稿案まで自動生成します。</p><div class="auto-research-tags"><span>Threads傾向</span><span>X / Reels構文</span><span>ニュース・ブログ</span><span>手動入力なし</span></div><div class="auto-research-actions"><button id="autoResearchAndGenerateBtn" type="button">リサーチから投稿生成</button><button id="autoThemeFromResearchBtn" type="button">テーマだけ生成</button></div>`;
    anchor?.insertAdjacentElement("beforebegin", card);
    if (input) input.value = autoSources().join("\n");
    [split, extract, document.getElementById("refreshResearchBtn")].forEach((button) => {
      button?.addEventListener("click", () => {
        if (input) input.value = autoSources().join("\n");
      }, true);
    });
    document.getElementById("autoThemeFromResearchBtn")?.addEventListener("click", () => {
      const summary = readSummary();
      if (summary) applySummaryTheme(summary, { force: true });
      else extract?.click();
    });
    document.getElementById("autoResearchAndGenerateBtn")?.addEventListener("click", () => {
      window.__iwakanAutoGenerateAfterResearch = true;
      if (input) input.value = autoSources().join("\n");
      extract?.click();
      setTimeout(() => {
        const summary = readSummary();
        if (summary && applySummaryTheme(summary, { force: true })) document.getElementById("generateBtn")?.click();
      }, 1200);
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

  function wordsFromSummary(summary) {
    const records = [...(summary?.sourceRecords || [])].sort((a, b) => (Number(b.impact || 0) - Number(a.impact || 0)));
    const text = [
      summary?.summary,
      ...(summary?.hooks || []),
      ...(summary?.buzzElements || []),
      ...(summary?.phrases || []),
      ...(summary?.recommendedPostAngles || []),
      ...records.slice(0, 5).flatMap((item) => [item.title, item.content, ...(item.buzzElements || [])])
    ].filter(Boolean).join(" ");
    const pick = (list, fallback) => list.find((word) => text.includes(word)) || fallback;
    return {
      place: pick(["古いスーパー", "地方スーパー", "スーパー", "ホームセンター", "コンビニ", "ドラッグストア", "地方駅", "商店街", "市役所", "病院", "駐車場"], "身近な場所"),
      time: pick(["17時過ぎ", "閉店前", "夕方", "夜", "深夜", "雨の日", "平日の昼過ぎ"], "17時過ぎ"),
      object: pick(["レジ音", "BGM", "棚", "駐車場", "惣菜売り場", "看板", "蛍光灯", "入口", "通路", "木材売り場"], "レジ音"),
      discomfort: pick(["人が少ない", "静かすぎる", "普通なのに少し変", "音だけ残る", "棚の色が暗い", "急に広く見える"], "音だけ残る")
    };
  }

  function buildThemeFromSummary(summary) {
    const words = wordsFromSummary(summary);
    const elements = [
      words.place,
      words.time,
      words.object.includes("音") ? `${words.object}だけ残る` : `${words.object}だけ目に残る`,
      words.discomfort
    ];
    return [...new Set(elements.map((item) => item.replace(/\s+/g, "").trim()).filter(Boolean))].slice(0, 4).join(" / ");
  }

  function applySummaryTheme(summary, { force = false } = {}) {
    const theme = document.getElementById("themeInput");
    if (!theme || !summary) return false;
    const nextTheme = buildThemeFromSummary(summary);
    const current = cleanTheme(theme.value);
    const looksManual = current && !/^(身近な場所|地方の古いスーパー|古いスーパー|スーパー|ホームセンター|コンビニ|ドラッグストア|地方駅|商店街|市役所|病院|駐車場)\s*\//.test(current);
    if (!force && looksManual) return false;
    if (nextTheme && theme.value !== nextTheme) {
      theme.value = nextTheme;
      try {
        const last = JSON.parse(localStorage.getItem("iwakan_lab_last_input_v1") || "{}");
        localStorage.setItem("iwakan_lab_last_input_v1", JSON.stringify({ ...last, theme: nextTheme }));
      } catch {}
      return true;
    }
    return false;
  }

  let lastSummaryKey = "";
  function watchSummaryForAutoGenerate() {
    const summary = readSummary();
    if (!summary) return;
    const key = JSON.stringify([summary.summary, summary.tavilyCount, summary.createdAt, summary.buzzElements?.slice?.(0, 3)]);
    if (key === lastSummaryKey) return;
    lastSummaryKey = key;
    const changed = applySummaryTheme(summary, { force: Boolean(window.__iwakanAutoGenerateAfterResearch) });
    if (window.__iwakanAutoGenerateAfterResearch && changed) {
      window.__iwakanAutoGenerateAfterResearch = false;
      setTimeout(() => document.getElementById("generateBtn")?.click(), 250);
    }
  }

  window.addEventListener("storage", watchSummaryForAutoGenerate);
  setInterval(watchSummaryForAutoGenerate, 900);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
