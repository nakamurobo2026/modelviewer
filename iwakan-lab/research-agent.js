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
    filter: $("sourcePriorityFilter"),
    results: $("buzzResults"),
    list: $("ideaList"),
    error: $("errorMessage")
  };

  let currentSummary = null;
  let currentFilter = "all";

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

  function sourceLabel(type) {
    const labels = {
      threads: "Threads実投稿",
      threads_comment: "Threadsコメント",
      x: "X投稿傾向",
      tiktok: "TikTok構文",
      instagram: "Instagram Reels",
      google_trends: "Google Trends",
      yahoo_realtime: "Yahoo!リアルタイム",
      reddit: "Reddit",
      hatebu: "はてなブックマーク",
      note: "note",
      togetter: "Togetter",
      news: "ニュース",
      blog: "ブログ",
      local_media: "地域メディア",
      official: "公式サイト",
      wikipedia: "Wikipedia",
      manual: "手動メモ",
      local: "保存DB/ローカル"
    };
    return labels[type] || "Web";
  }

  function inferSourceType(source) {
    const text = String(source || "").toLowerCase();
    let host = "";
    try {
      host = new URL(text.match(/https?:\/\/\S+/)?.[0] || text).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    if (host.includes("threads.net")) return "threads";
    if (host.includes("x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("trends.google.")) return "google_trends";
    if (host.includes("search.yahoo.co.jp") || text.includes("リアルタイム")) return "yahoo_realtime";
    if (host.includes("yahoo.co.jp")) return "news";
    if (host.includes("reddit.com")) return "reddit";
    if (host.includes("b.hatena.ne.jp")) return "hatebu";
    if (host.includes("note.com")) return "note";
    if (host.includes("togetter.com")) return "togetter";
    if (host.includes("wikipedia.org")) return "wikipedia";
    if (/公式|official/.test(text)) return "official";
    if (/ニュース|新聞|press|media/.test(text)) return "news";
    if (host) return "blog";
    if (els.sourceType?.value === "url") return "blog";
    return els.sourceType?.value === "mixed" ? "manual" : els.sourceType?.value || "manual";
  }

  function priorityFor(type) {
    if (["threads", "threads_comment", "x", "tiktok", "instagram"].includes(type)) return { priority: "S", weight: 1, reason: "実投稿や短尺SNS構文に近く、バズへの距離が最短" };
    if (["google_trends", "yahoo_realtime", "reddit", "hatebu", "note", "togetter"].includes(type)) return { priority: "A", weight: 0.8, reason: "話題化の兆候や集合知が見える" };
    if (["news", "blog", "local_media", "official", "wikipedia"].includes(type)) return { priority: "B", weight: 0.5, reason: "背景情報として有効だが投稿反応からは少し遠い" };
    return { priority: "C", weight: 0.3, reason: "手動メモや保存DB由来で補助素材として扱う" };
  }

  function reliabilityFor(source, type, priority) {
    const text = String(source || "");
    const hasUrl = /https?:\/\//.test(text);
    const specificity = ["時", "レジ", "棚", "駐車場", "音", "光", "匂い", "人", "店"].filter((word) => text.includes(word)).length;
    const freshness = /今日|昨日|最新|2026|now|trend|トレンド/.test(text.toLowerCase()) ? 18 : 8;
    const closeness = { S: 35, A: 27, B: 17, C: 10 }[priority] || 10;
    const postable = /だけ|急に|なぜ|違和感|あるある|残る|止まる/.test(text) ? 18 : 9;
    const duplicatePenalty = hasUrl ? 0 : 4;
    return Math.min(100, closeness + freshness + specificity * 5 + postable - duplicatePenalty);
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

  function makeSourceRecord(source, index) {
    const url = source.match(/https?:\/\/\S+/)?.[0] || "";
    const content = source.replace(/https?:\/\/\S+/g, "").trim() || url || source;
    const sourceType = inferSourceType(source);
    const priority = priorityFor(sourceType);
    const reliability = reliabilityFor(source, sourceType, priority.priority);
    return {
      id: `source-${Date.now()}-${index}`,
      sourceType,
      priority: priority.priority,
      weight: priority.weight,
      url,
      title: content.slice(0, 42) || sourceLabel(sourceType),
      content,
      reason: priority.reason,
      reliability,
      impact: Math.round(reliability * priority.weight),
      buzzElements: [
        `${detectObject(content)}だけ目に残る`,
        /レジ|BGM|音/.test(content) ? "音の違和感" : "具体描写",
        /古い|昭和|懐|蛍光灯/.test(content) ? "懐かしさ" : "共感の余白"
      ]
    };
  }

  function sortSources(records) {
    const rank = { S: 4, A: 3, B: 2, C: 1 };
    return [...records].sort((a, b) => (rank[b.priority] - rank[a.priority]) || (b.impact - a.impact));
  }

  function filterSources(records) {
    if (currentFilter === "s") return records.filter((item) => item.priority === "S");
    if (currentFilter === "sa") return records.filter((item) => ["S", "A"].includes(item.priority));
    if (currentFilter === "manual") return records.filter((item) => ["manual", "local"].includes(item.sourceType));
    return records;
  }

  function showError(message) {
    if (!els.error) return;
    els.error.hidden = !message;
    els.error.textContent = message || "";
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
    const sourceRecords = sortSources(safeSources.map(makeSourceRecord));
    const prioritized = sourceRecords.map((item) => item.content || item.url || item.title);
    const joined = prioritized.join("\n");
    const observations = prioritized.map((source) => ({
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
      sourceRecords,
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
      recommendedPostAngles: unique([...(data?.recommendedPostAngles || []), ...local.recommendedPostAngles], 8),
      sourceRecords: sortSources([...(data?.sourceRecords || []), ...local.sourceRecords].map((item, index) => ({
        ...makeSourceRecord(item.content || item.url || item.title || sources[index] || "", index),
        ...item
      })))
    };
  }

  function list(items) {
    return `<ul class="buzz-list">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function priorityClass(priority) {
    return String(priority || "C").toLowerCase();
  }

  function sourceCard(item) {
    const elements = (item.buzzElements || []).length ? list(item.buzzElements.slice(0, 4)) : "";
    return `<article class="source-card">
      <div class="source-top">
        <span class="priority-badge ${priorityClass(item.priority)}">${escapeHtml(item.priority || "C")}</span>
        <span class="source-type">${escapeHtml(sourceLabel(item.sourceType))}</span>
        <span class="source-impact"><span>weight ${Number(item.weight || 0).toFixed(1)}</span><span>信頼度 ${item.reliability || 0}</span><span>影響度 ${item.impact || 0}</span></span>
      </div>
      ${item.url ? `<a class="source-url" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>` : ""}
      <p class="source-reason">${escapeHtml(item.title || item.content || "")}</p>
      <p class="source-reason">${escapeHtml(item.reason || "")}</p>
      ${elements}
    </article>`;
  }

  function render(summary = currentSummary) {
    if (!els.results) return;
    if (!summary) {
      els.results.innerHTML = `<p class="muted">バズ要素はまだ抽出されていません。</p>`;
      return;
    }
    const visibleSources = filterSources(summary.sourceRecords || []);
    els.results.innerHTML = `
      <div class="buzz-summary">
        <h3>Research Summary</h3>
        <p class="buzz-angle">${escapeHtml(summary.summary)}</p>
        <div class="buzz-section"><b>情報取得元</b><div class="source-list">${visibleSources.length ? visibleSources.map(sourceCard).join("") : `<p class="muted">条件に合う取得元はありません。</p>`}</div></div>
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
    renderCardSources();
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
    const prioritized = sortSources(summary.sourceRecords || []);
    const sBuzz = prioritized.filter((item) => item.priority === "S").flatMap((item) => item.buzzElements || []);
    const aHooks = prioritized.filter((item) => item.priority === "A").map((item) => item.title);
    const bBackground = prioritized.filter((item) => item.priority === "B").map((item) => item.title);
    const cManual = prioritized.filter((item) => item.priority === "C").map((item) => item.title);
    const addon = [
      `Research Summary:${summary.summary}`,
      `Priority S buzzElements:${sBuzz.join(" / ")}`,
      `Priority A hooks/phrases:${aHooks.join(" / ")}`,
      `Priority B background:${bBackground.join(" / ")}`,
      `Priority C manual/local:${cManual.join(" / ")}`,
      `hooks:${(summary.hooks || []).join(" / ")}`,
      `phrases:${(summary.phrases || []).join(" / ")}`,
      `buzzElements:${(summary.buzzElements || []).join(" / ")}`,
      `recommendedPostAngles:${(summary.recommendedPostAngles || []).join(" / ")}`,
      "元投稿は丸写しせず、言い回しを変えてオリジナル投稿にする。"
    ].join(" ");
    els.theme.value = `${original}\n${addon}`.trim();
    setTimeout(() => { els.theme.value = original; }, 0);
  }

  function renderCardSources() {
    const summary = currentSummary || read(keys.research, {}).summary || null;
    const sources = sortSources(summary?.sourceRecords || []);
    if (!sources.length || !els.list) return;
    [...els.list.querySelectorAll(".idea-card")].forEach((card, index) => {
      if (card.querySelector(".source-chip")) return;
      const source = sources[index % sources.length];
      const meta = card.querySelector(".meta");
      meta?.insertAdjacentHTML("beforebegin", `<span class="source-chip"><strong>${escapeHtml(source.priority)}</strong>${escapeHtml(sourceLabel(source.sourceType))}</span>`);
    });
  }

  function boot() {
    if (!els.research || !els.results) return;
    const saved = read(keys.research, {});
    const settings = read(keys.settings, { reflect: true });
    currentSummary = saved.summary || read(keys.history, [])[0] || null;
    if (els.reflect) els.reflect.checked = settings.reflect !== false;
    currentFilter = settings.filter || "all";
    if (els.filter) els.filter.value = currentFilter;
    render(currentSummary);
    els.extract?.addEventListener("click", () => extract({ preferAI: true }));
    els.save?.addEventListener("click", () => persist(currentSummary || localExtract(splitSources())));
    els.saveResearch?.addEventListener("click", () => persist(currentSummary || localExtract(splitSources())));
    els.split?.addEventListener("click", () => persist(localExtract(splitSources())));
    els.reflect?.addEventListener("change", () => write(keys.settings, { reflect: els.reflect.checked, filter: currentFilter }));
    els.filter?.addEventListener("change", () => {
      currentFilter = els.filter.value;
      write(keys.settings, { reflect: els.reflect?.checked !== false, filter: currentFilter });
      render(currentSummary);
    });
    document.getElementById("generateBtn")?.addEventListener("click", applySummaryToTheme, true);
    if (els.list) new MutationObserver(renderCardSources).observe(els.list, { childList: true, subtree: true });
    renderCardSources();
  }

  boot();
})();
