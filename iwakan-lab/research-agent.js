(function () {
  const keys = {
    research: "iwakan_lab_research_v1",
    history: "iwakan_lab_research_history_v1",
    settings: "iwakan_lab_research_settings_v1"
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    theme: $("themeInput"),
    research: $("researchInput"),
    sourceType: $("researchSourceType"),
    persona: $("personaSelect"),
    extract: $("extractBuzzBtn"),
    save: $("saveBuzzBtn"),
    split: $("splitResearchBtn"),
    saveResearch: $("saveResearchBtn"),
    reflect: $("researchReflectToggle"),
    results: $("buzzResults"),
    error: $("errorMessage")
  };

  let currentSummary = null;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function unique(values, limit = 10) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
  }

  function splitSources() {
    const text = els.research?.value || els.theme?.value || "";
    return String(text).split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 24);
  }

  function showError(message) {
    if (!els.error) return;
    els.error.hidden = !message;
    els.error.textContent = message || "";
  }

  function detectPlace(text) {
    return ["地方スーパー", "スーパー", "ホームセンター", "コンビニ", "地方駅", "市役所", "商店街", "古い病院", "学校", "パチンコ屋", "ドラッグストア", "駐車場"].find((word) => text.includes(word)) || "身近な場所";
  }

  function detectTime(text) {
    return ["閉店前", "17時過ぎ", "夕方", "深夜", "夜", "雨の日", "平日"].find((word) => text.includes(word)) || "17時過ぎ";
  }

  function detectObject(text) {
    return ["レジ", "棚", "駐車場", "看板", "蛍光灯", "BGM", "惣菜売り場", "入口", "通路", "袋詰め台"].find((word) => text.includes(word)) || "棚";
  }

  function detectPatterns(text) {
    const patterns = [];
    if (/あるある|わかる|普通|人|みんな/.test(text)) patterns.push("共感型", "あるある型");
    if (/違和感|変|妙|ずれ|怖|無音|不穏/.test(text)) patterns.push("違和感型", "不穏型");
    if (/昔|古い|昭和|懐|蛍光灯|看板/.test(text)) patterns.push("懐かしさ型");
    if (/なんで|なぜ|誰|どうして|\?/.test(text)) patterns.push("問いかけ型");
    if (/だけ|急に|残る|止まる|広く見える/.test(text)) patterns.push("余白型", "ツッコミ型");
    return patterns.length ? patterns : ["余白型"];
  }

  function localExtract(sources) {
    const safeSources = sources.length ? sources : ["地方スーパーの閉店前、レジ音だけ残る"];
    const joined = safeSources.join("\n");
    const observations = safeSources.map((source) => ({
      place: detectPlace(source),
      time: detectTime(source),
      object: detectObject(source),
      source
    }));
    const hooks = unique(observations.map((item) => `${item.time}の${item.place}`), 10);
    const phrases = unique(safeSources.map((source) => source.replace(/https?:\/\/\S+/g, "").replace(/[「」『』"']/g, "").trim().slice(0, 34)), 10);
    const buzzElements = unique([
      ...observations.map((item) => `${item.object}だけ目に残る`),
      joined.includes("レジ") ? "レジ音だけ残る" : "音が少なくなる瞬間",
      joined.includes("蛍光灯") ? "古い蛍光灯の白さ" : "棚の色が少し暗く見える",
      joined.includes("駐車場") ? "駐車場が急に広く見える" : "人が少ない場所",
      "普通なのに少しだけずれる"
    ], 14);
    const patterns = unique(safeSources.flatMap(detectPatterns), 8);
    const persona = els.persona?.value || "違和感ノート";
    const recommendedPostAngles = unique(observations.map((item) => {
      if (persona.includes("地方")) return `${item.time}の人の少なさと${item.object}を軸にする`;
      if (persona.includes("懐")) return `${item.place}に残る古い光や棚配置から書く`;
      if (persona.includes("深夜")) return `音が残る瞬間を独り言っぽくする`;
      return `${item.place}で普通に見えるのに少しずれる点を書く`;
    }), 8);
    return {
      source: safeSources.join("\n"),
      sourceType: els.sourceType?.value || "mixed",
      summary: `${hooks[0]}を起点に、${buzzElements[0]}と${buzzElements[1]}を投稿の芯にする。`,
      buzzElements,
      hooks,
      phrases,
      patterns,
      recommendedPostAngles,
      createdAt: new Date().toISOString(),
      sourceMode: "local-extractor"
    };
  }

  function normalizeSummary(data, sources) {
    const local = localExtract(sources);
    return {
      ...local,
      ...data,
      success: true,
      summary: data?.summary || local.summary,
      buzzElements: unique([...(data?.buzzElements || []), ...local.buzzElements], 14),
      hooks: unique([...(data?.hooks || []), ...local.hooks], 10),
      phrases: unique([...(data?.phrases || []), ...local.phrases], 10),
      patterns: unique([...(data?.patterns || []), ...local.patterns], 8),
      recommendedPostAngles: unique([...(data?.recommendedPostAngles || []), ...local.recommendedPostAngles], 8)
    };
  }

  function list(items) {
    return `<ul class="buzz-list">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function render(summary = currentSummary) {
    if (!els.results) return;
    if (!summary) {
      els.results.innerHTML = `<p class="muted">バズ要素はまだ抽出されていません。</p>`;
      return;
    }
    els.results.innerHTML = `
      <div class="buzz-summary">
        <h3>Research Summary</h3>
        <p class="buzz-angle">${escapeHtml(summary.summary)}</p>
        <div class="buzz-section"><b>フック</b>${list(summary.hooks)}</div>
        <div class="buzz-section"><b>使える言い回し</b>${list(summary.phrases)}</div>
        <div class="buzz-section"><b>バズ要素</b>${list(summary.buzzElements)}</div>
        <div class="buzz-section"><b>分類</b>${list(summary.patterns)}</div>
        <div class="buzz-section"><b>投稿角度</b>${list(summary.recommendedPostAngles)}</div>
      </div>`;
  }

  function persist(summary) {
    currentSummary = summary;
    const history = read(keys.history, []);
    write(keys.history, [summary, ...history].slice(0, 30));
    const research = read(keys.research, {});
    write(keys.research, { ...research, text: els.research?.value || research.text || "", summary });
    render(summary);
  }

  async function extract({ preferAI = true } = {}) {
    const sources = splitSources();
    const persona = els.persona?.value || "違和感ノート";
    showError("");
    els.extract && (els.extract.disabled = true);
    try {
      if (preferAI && window.AIClient?.research) {
        const data = await window.AIClient.research({ sources, persona, target: "Threads" });
        persist(normalizeSummary({ ...data, sourceMode: data.source || "cloudflare-worker" }, sources));
      } else {
        persist(localExtract(sources));
      }
    } catch (error) {
      console.error("[Research Agent] AI extraction failed. Local extractor used.", {
        message: error.message,
        endpoint: error.endpoint,
        status: error.status,
        detail: error.detail,
        rawResponse: error.rawResponse,
        response: error.response,
        originalError: error.originalError,
        error
      });
      const summary = localExtract(sources);
      summary.error = error.message || String(error);
      persist(summary);
      showError(`Research AI抽出に失敗しました。ローカル抽出で続行します。${summary.error}`);
    } finally {
      els.extract && (els.extract.disabled = false);
    }
  }

  function applySummaryToTheme() {
    if (els.reflect?.checked === false) return;
    const summary = currentSummary || read(keys.research, {}).summary || null;
    if (!summary || !els.theme) return;
    const original = els.theme.value;
    const addon = [
      `Research Summary:${summary.summary}`,
      `hooks:${(summary.hooks || []).join(" / ")}`,
      `phrases:${(summary.phrases || []).join(" / ")}`,
      `buzzElements:${(summary.buzzElements || []).join(" / ")}`,
      `recommendedPostAngles:${(summary.recommendedPostAngles || []).join(" / ")}`,
      "元投稿は丸写しせず、言い回しを変えてオリジナル投稿にする。"
    ].join(" ");
    els.theme.value = `${original}\n${addon}`.trim();
    setTimeout(() => { els.theme.value = original; }, 0);
  }

  function boot() {
    if (!els.research || !els.results) return;
    const saved = read(keys.research, {});
    const settings = read(keys.settings, { reflect: true });
    currentSummary = saved.summary || read(keys.history, [])[0] || null;
    if (els.reflect) els.reflect.checked = settings.reflect !== false;
    render(currentSummary);
    els.extract?.addEventListener("click", () => extract({ preferAI: true }));
    els.save?.addEventListener("click", () => persist(currentSummary || localExtract(splitSources())));
    els.saveResearch?.addEventListener("click", () => persist(currentSummary || localExtract(splitSources())));
    els.split?.addEventListener("click", () => persist(localExtract(splitSources())));
    els.reflect?.addEventListener("change", () => write(keys.settings, { reflect: els.reflect.checked }));
    document.getElementById("generateBtn")?.addEventListener("click", applySummaryToTheme, true);
  }

  boot();
})();
