(function () {
  const keys = {
    research: "iwakan_lab_research_v1",
    agent: "iwakan_lab_agent_v1",
    queue: "iwakan_lab_queue_v1"
  };

  const personaProfiles = {
    "違和感ノート": "普通なのに少し変なところを残す",
    "深夜ラジオ": "夜中の独り言くらいの距離で書く",
    "地方観測者": "駐車場、看板、蛍光灯、無音時間を重視する",
    "懐かしさ収集家": "古い棚、手書き、昭和感を拾う",
    "静かな考察者": "断定せず、観察だけを置く"
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    theme: $("themeInput"),
    generate: $("generateBtn"),
    research: $("researchInput"),
    saveResearch: $("saveResearchBtn"),
    splitResearch: $("splitResearchBtn"),
    notes: $("researchNotes"),
    persona: $("personaSelect"),
    list: $("ideaList"),
    queue: $("queueList"),
    clearQueue: $("clearQueueBtn"),
    flowSteps: document.querySelectorAll("[data-flow]")
  };

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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function splitResearchText(text) {
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const fallback = els.theme?.value.trim() ? [els.theme.value.trim()] : [];
    return (lines.length ? lines : fallback).map((line, index) => {
      const url = line.match(/https?:\/\/\S+/)?.[0] || "";
      const clean = line.replace(/https?:\/\/\S+/g, "").trim();
      const body = clean || url;
      return { id: `note-${Date.now()}-${index}`, text: body.slice(0, 90), url, type: url ? "URLメモ" : inferType(body, index) };
    }).filter((note) => note.text || note.url).slice(0, 16);
  }

  function inferType(text, index) {
    if (/店|売り場|棚|スーパー|コンビニ|ドラッグ|ホーム/.test(text)) return "店舗観察";
    if (/駅|市役所|病院|学校|商店街/.test(text)) return "場所メモ";
    if (/音|BGM|匂い|光|蛍光灯|看板|駐車場/.test(text)) return "観察素材";
    if (/流行|ニュース|話題|トレンド/.test(text)) return "トレンド";
    return index % 2 ? "違和感素材" : "ネタ元";
  }

  function getResearch() {
    return window.IwakanStorage?.getResearch?.() || read(keys.research, { text: "", notes: [] });
  }

  function setResearch(research) {
    if (window.IwakanStorage?.setResearch) window.IwakanStorage.setResearch(research);
    else write(keys.research, research);
  }

  function getQueue() {
    return window.IwakanStorage?.getQueue?.() || read(keys.queue, []);
  }

  function setQueue(queue) {
    if (window.IwakanStorage?.setQueue) window.IwakanStorage.setQueue(queue);
    else write(keys.queue, queue.slice(0, 80));
  }

  function saveResearch(split) {
    const text = els.research?.value.trim() || "";
    const current = getResearch();
    const research = { text, notes: split ? splitResearchText(text) : current.notes || [] };
    if (!research.notes.length && text) research.notes = splitResearchText(text);
    setResearch(research);
    renderNotes();
    setFlow("research", research.notes.length ? "done" : "idle");
    return research;
  }

  function renderNotes() {
    if (!els.notes) return;
    const research = getResearch();
    if (!research.notes?.length) {
      els.notes.textContent = "リサーチメモはまだありません。";
      return;
    }
    els.notes.innerHTML = research.notes.map((note, index) => `
      <button class="note-chip" type="button" data-note-index="${index}">
        <b>${escapeHtml(note.type)}</b>
        <span>${escapeHtml(note.text)}</span>
      </button>`).join("");
  }

  function judgeIdea(text) {
    const concreteWords = ["時", "売り場", "駐車場", "レジ", "棚", "蛍光灯", "BGM", "看板", "音", "匂い", "入口", "通路", "待合室", "夕方", "閉店", "雨", "人", "店"];
    const humanWords = ["だけ", "急に", "一瞬", "なぜか", "妙に", "まだ", "残る", "見える", "止まる", "聞こえる"];
    const abstractWords = ["静か", "違和感", "深い", "エモい", "孤独", "ノスタルジー", "余白"];
    const concrete = concreteWords.filter((word) => text.includes(word)).length;
    const human = humanWords.filter((word) => text.includes(word)).length;
    const abstract = abstractWords.filter((word) => text.includes(word)).length;
    const lengthFit = text.length >= 20 && text.length <= 90 ? 12 : -8;
    const specificity = clamp(48 + concrete * 9 + lengthFit - abstract * 4, 35, 98);
    const humanity = clamp(52 + human * 8 - abstract * 3, 35, 98);
    const iwakan = clamp(50 + (/普通|急に|妙に|だけ|少し|なぜか|残る/.test(text) ? 20 : 4) + concrete * 3, 35, 98);
    const empathy = clamp(50 + (/ある|見る|聞こえる|残る|人/.test(text) ? 12 : 2) + human * 4, 35, 96);
    const comment = clamp(48 + (/だけ|なぜか|急に|妙に|止まる|見える/.test(text) ? 16 : 3) + concrete * 3, 35, 96);
    const buzz = clamp(Math.round((specificity + humanity + iwakan + empathy + comment) / 5), 35, 98);
    return { empathy, comment, specificity, humanity, iwakan, buzz, reason: concrete >= 2 ? "具体描写あり" : "具体描写をもう少し足したい" };
  }

  function scoreMeter(label, value) {
    return `<div class="judge-item"><span>${label}</span><b>${value}</b><i style="--score:${value}%"></i></div>`;
  }

  function enhanceCards() {
    document.querySelectorAll(".idea-card").forEach((card) => {
      if (card.dataset.agentEnhanced === "1") return;
      const text = card.querySelector(".idea-text")?.textContent.trim() || "";
      if (!text) return;
      const judge = judgeIdea(text);
      const top = card.querySelector(".card-top");
      if (top && !top.querySelector(".persona-pill")) {
        top.insertAdjacentHTML("beforeend", `<span class="persona-pill">${escapeHtml(els.persona?.value || "違和感ノート")}</span>`);
      }
      const body = card.querySelector(".idea-text");
      body?.insertAdjacentHTML("afterend", `
        <div class="judge-grid" aria-label="Buzz Judge Agent">
          ${scoreMeter("共感性", judge.empathy)}
          ${scoreMeter("コメント", judge.comment)}
          ${scoreMeter("具体性", judge.specificity)}
          ${scoreMeter("人間味", judge.humanity)}
          ${scoreMeter("違和感", judge.iwakan)}
        </div>`);
      const actions = card.querySelector(".card-actions");
      actions?.insertAdjacentHTML("beforeend", `<button class="mini queue" data-agent-queue="1" type="button">予約</button>`);
      const score = card.querySelector(".score span");
      if (score) score.textContent = String(judge.buzz);
      card.dataset.agentEnhanced = "1";
    });
    if (document.querySelector(".idea-card")) {
      setFlow("generate", "done");
      setFlow("judge", "done");
    }
  }

  function setFlow(name, status) {
    const labels = { idle: "待機中", active: "処理中", done: "完了", error: "退避" };
    els.flowSteps.forEach((step) => {
      if (step.dataset.flow !== name) return;
      step.className = `flow-step ${status}`;
      step.querySelector("span").textContent = labels[status] || status;
    });
  }

  function resetFlow() {
    ["research", "observe", "persona", "generate", "judge"].forEach((name) => setFlow(name, "idle"));
  }

  function buildAgentTheme(originalTheme, research) {
    const persona = els.persona?.value || "違和感ノート";
    const notes = research.notes || [];
    const line = notes.map((note) => note.text).filter(Boolean).slice(0, 8).join(" / ");
    const base = originalTheme.trim() || notes[0]?.text || "地方の古いスーパー";
    return line ? `${base}。リサーチ: ${line}。人格: ${personaProfiles[persona] || persona}` : `${base}。人格: ${personaProfiles[persona] || persona}`;
  }

  function beforeGenerate() {
    const research = saveResearch(true);
    const original = els.theme.value;
    els.theme.dataset.agentOriginalTheme = original;
    els.theme.value = buildAgentTheme(original, research);
    resetFlow();
    setFlow("research", "done");
    setFlow("observe", "done");
    setFlow("persona", "done");
    setFlow("generate", "active");
    setTimeout(() => {
      if (els.theme.dataset.agentOriginalTheme !== undefined) {
        els.theme.value = els.theme.dataset.agentOriginalTheme;
        delete els.theme.dataset.agentOriginalTheme;
      }
    }, 0);
  }

  function addQueueFromCard(card) {
    const text = card.querySelector(".idea-text")?.textContent.trim();
    if (!text) return;
    const next = new Date(Date.now() + Math.max(1, getQueue().length + 1) * 60 * 60 * 1000);
    const item = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      category: card.querySelector(".badge")?.textContent.trim() || "違和感",
      persona: els.persona?.value || "違和感ノート",
      date: next.toISOString().slice(0, 10),
      time: next.toTimeString().slice(0, 5),
      createdAt: new Date().toISOString()
    };
    setQueue([item, ...getQueue()]);
    renderQueue();
    card.querySelector('[data-action="adopt"]')?.click();
  }

  function renderQueue() {
    if (!els.queue) return;
    const queue = getQueue();
    if (!queue.length) {
      els.queue.textContent = "予約キューはまだありません。";
      return;
    }
    els.queue.innerHTML = queue.map((item) => `
      <article class="queue-item">
        <div><b>${escapeHtml(item.date)} ${escapeHtml(item.time)}</b><span>${escapeHtml(item.category)} / ${escapeHtml(item.persona)}</span></div>
        <p>${escapeHtml(item.text)}</p>
        <button class="text-btn danger-text" type="button" data-remove-queue="${item.id}">削除</button>
      </article>`).join("");
  }

  function boot() {
    if (!els.generate || !els.research || !els.persona) return;
    const research = getResearch();
    els.research.value = research.text || "";
    els.persona.value = read(keys.agent, { persona: "違和感ノート" }).persona || "違和感ノート";
    renderNotes();
    renderQueue();
    resetFlow();

    els.saveResearch?.addEventListener("click", () => saveResearch(false));
    els.splitResearch?.addEventListener("click", () => saveResearch(true));
    els.generate.addEventListener("click", beforeGenerate, true);
    els.persona.addEventListener("change", () => write(keys.agent, { persona: els.persona.value }));
    els.notes?.addEventListener("click", (event) => {
      const note = event.target.closest("[data-note-index]");
      if (!note) return;
      const selected = getResearch().notes[Number(note.dataset.noteIndex)];
      if (selected?.text) els.theme.value = selected.text;
    });
    els.list?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-agent-queue]");
      if (button) addQueueFromCard(button.closest(".idea-card"));
    });
    els.queue?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-queue]");
      if (!remove) return;
      setQueue(getQueue().filter((item) => item.id !== remove.dataset.removeQueue));
      renderQueue();
    });
    els.clearQueue?.addEventListener("click", () => { setQueue([]); renderQueue(); });
    new MutationObserver(enhanceCards).observe(els.list, { childList: true, subtree: true });
    enhanceCards();
  }

  boot();
})();
