(function () {
  const keys = {
    research: "iwakan_lab_research_v1",
    agent: "iwakan_lab_agent_v1",
    queue: "iwakan_lab_queue_v1",
    debug: "iwakan_lab_observation_debug_v1"
  };

  const personas = {
    "違和感ノート": { focus: "普通なのに少し変なところ", prefer: ["discomfort", "object", "motion"] },
    "深夜ラジオ": { focus: "会話感、独り言、音感", prefer: ["sound", "time", "motion"] },
    "地方観測者": { focus: "観察重視、人少なさ、静かな違和感", prefer: ["crowd", "place", "light"] },
    "懐かしさ収集家": { focus: "昭和感、古い光、色温度", prefer: ["nostalgia", "light", "object"] },
    "静かな考察者": { focus: "断定しない観察", prefer: ["place", "time", "discomfort"] }
  };

  const dict = {
    place: ["地方スーパー", "スーパー", "ホームセンター", "コンビニ", "地方駅", "市役所", "商店街", "古い病院", "学校", "パチンコ屋", "ドラッグストア", "駐車場", "売り場", "駅", "店"],
    time: ["閉店前", "17時過ぎ", "18時前", "夕方", "深夜", "夜", "朝5時", "昼過ぎ", "雨の日", "平日", "休日"],
    light: ["蛍光灯", "夕日", "西日", "白い照明", "暗い棚", "入口だけ明るい", "古い光", "LED", "看板の光"],
    sound: ["レジ音", "BGM", "台車の音", "自動ドア", "冷蔵ケース", "足音", "シャッター", "店内放送", "車輪", "無音"],
    smell: ["惣菜の匂い", "揚げ物の匂い", "洗剤の匂い", "湿布の匂い", "雨の匂い", "木材の匂い", "古い紙の匂い", "消毒液"],
    object: ["棚", "レジ", "惣菜売り場", "駐車場", "看板", "蛍光灯", "カート", "袋詰め台", "入口", "通路", "待合室", "自販機", "ポスター"],
    motion: ["残る", "止まる", "響く", "広く見える", "暗く見える", "人が減る", "誰も見ない", "一瞬止まる", "探す", "並ぶ"]
  };

  const abstractBans = ["エモい", "深い", "孤独", "ノスタルジー", "世界観", "心が静か", "時間が止まる", "違和感ある", "地方感ある"];
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
    error: $("errorMessage"),
    flowSteps: document.querySelectorAll("[data-flow]")
  };

  let lastPipeline = { researchItems: [], observations: [], personaPosts: [], finalPosts: [], error: "" };

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

  function showError(message) {
    if (!els.error) return;
    els.error.hidden = !message;
    els.error.textContent = message || "";
  }

  function setFlow(name, status, detail = "") {
    const labels = { idle: "待機中", active: "処理中", done: "完了", error: "失敗" };
    els.flowSteps.forEach((step) => {
      if (step.dataset.flow !== name) return;
      step.className = `flow-step ${status}`;
      const label = step.querySelector("span");
      if (label) label.textContent = detail || labels[status] || status;
    });
  }

  function resetFlow() {
    ["research", "observe", "persona", "generate", "judge"].forEach((name) => setFlow(name, "idle"));
  }

  function pick(text, list, fallback = "") {
    return list.find((word) => text.includes(word)) || fallback;
  }

  function splitResearchItems(text) {
    const lines = String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const fallback = els.theme?.value.trim() ? [els.theme.value.trim()] : [];
    return (lines.length ? lines : fallback).map((line, index) => {
      const url = line.match(/https?:\/\/\S+/)?.[0] || "";
      const clean = line.replace(/https?:\/\/\S+/g, "").trim();
      return { id: `research-${Date.now()}-${index}`, raw: line, text: clean || url, url };
    }).filter((item) => item.text || item.url).slice(0, 16);
  }

  function fallbackResearchItems(count = 5) {
    return [
      "地方スーパーの閉店前、レジ音だけ残る",
      "17時過ぎると駐車場だけ急に広く見える",
      "古いドラッグストア、蛍光灯だけ白く残る",
      "ホームセンターの木材売り場、台車の音だけ響く",
      "地方駅の夕方、改札の音が数分に一回だけ鳴る"
    ].slice(0, count).map((text, index) => ({ id: `fallback-${index}`, raw: text, text, url: "" }));
  }

  function inferPlace(text) {
    const found = pick(text, dict.place);
    if (found) return found === "店" ? "店内" : found;
    if (/地方|田舎/.test(text)) return "地方の店";
    return "古いスーパー";
  }

  function inferTime(text) {
    return pick(text, dict.time) || (text.includes("閉店") ? "閉店前" : text.includes("夜") ? "夜" : "17時過ぎ");
  }

  function inferLight(text, time) {
    return pick(text, dict.light) || (/夕方|17時|18時|閉店/.test(time) ? "棚の色が少し暗い" : /深夜|夜/.test(time) ? "白い照明だけ強い" : "古い蛍光灯");
  }

  function inferSound(text) {
    return pick(text, dict.sound) || (text.includes("静か") ? "音が少ない" : "レジ音だけ残る");
  }

  function inferSmell(text, place) {
    return pick(text, dict.smell) || (place.includes("ホームセンター") ? "木材と肥料の匂い" : place.includes("ドラッグ") ? "洗剤の匂い" : place.includes("病院") ? "消毒液の匂い" : place.includes("スーパー") ? "惣菜の匂い" : "古い床の匂い");
  }

  function inferCrowd(text, time) {
    if (/人多|混む|行列/.test(text)) return "人は多い";
    if (/人少|まばら|誰も|少ない|閉店|深夜/.test(text + time)) return "人少ない";
    return "人がまばら";
  }

  function inferObject(text, place) {
    return pick(text, dict.object) || (place.includes("駅") ? "改札" : place.includes("ホームセンター") ? "木材売り場" : place.includes("スーパー") ? "惣菜売り場" : "棚");
  }

  function inferMotion(text, sound) {
    return pick(text, dict.motion) || (sound.includes("音") ? "響く" : "一瞬止まる");
  }

  function consistencyPenalty(obs) {
    let penalty = 0;
    if (/深夜|夜/.test(obs.time) && /夕日|西日/.test(obs.light)) penalty += 22;
    if (obs.crowd === "人は多い" && /無音|静かすぎる|音が少ない/.test(`${obs.sound}${obs.discomfort}`)) penalty += 18;
    if (/閉店前/.test(obs.time) && /朝5時|夕日/.test(obs.light)) penalty += 10;
    return penalty;
  }

  function parseObservation(item, index = 0) {
    const text = String(item?.text || item || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    const place = inferPlace(text);
    const time = inferTime(text);
    const light = inferLight(text, time);
    const sound = inferSound(text);
    const smell = inferSmell(text, place);
    const crowd = inferCrowd(text, time);
    const object = inferObject(text, place);
    const motion = inferMotion(text, sound);
    const obs = {
      place,
      time,
      light,
      sound,
      smell,
      temperature: /寒|冷/.test(text) ? "少し冷たい" : /暑|蒸/.test(text) ? "少し蒸す" : /夜|閉店|雨/.test(text + time) ? "空気が冷える" : "ぬるい店内",
      crowd,
      object,
      motion,
      discomfort: "",
      nostalgia: "",
      realism: 0,
      source: text || `${place}の${time}`,
      index
    };
    obs.discomfort = inferDiscomfort(obs);
    obs.nostalgia = /古い|昭和|蛍光灯|看板|ポスター|棚/.test(`${obs.place}${obs.light}${obs.object}`) ? "昔のまま残っている" : "少し古く見える";
    obs.realism = clamp(42 + ["place", "time", "light", "sound", "smell", "crowd", "object", "motion"].filter((key) => obs[key]).length * 7 - consistencyPenalty(obs), 35, 98);
    return obs;
  }

  function inferDiscomfort(obs) {
    if (obs.crowd === "人は多い" && /無音|静か/.test(obs.sound)) return "音だけ浮く";
    if (/深夜|夜/.test(obs.time) && obs.light.includes("白い")) return "明るすぎる";
    if (/閉店|17時|夕方/.test(obs.time) && /レジ|BGM|台車/.test(obs.sound)) return "店内だけ片付いていく";
    return "普通なのに少しだけずれる";
  }

  function personaTransform(obs, persona) {
    const t = { ...obs, persona, focus: personas[persona]?.focus || "観察" };
    if (persona === "地方観測者") return { ...t, primary: `${obs.time}の${obs.place}`, detail: `${obs.crowd}、${obs.object}だけ${obs.motion}`, after: obs.light };
    if (persona === "深夜ラジオ") return { ...t, primary: `${obs.time}、${obs.sound}`, detail: `${obs.place}の${obs.object}だけ${obs.motion}`, after: "誰にも言うほどじゃない" };
    if (persona === "懐かしさ収集家") return { ...t, primary: `${obs.place}の${obs.object}`, detail: `${obs.light}と${obs.smell}`, after: obs.nostalgia };
    if (persona === "静かな考察者") return { ...t, primary: `${obs.time}の${obs.place}`, detail: `${obs.sound}、${obs.light}`, after: obs.discomfort };
    return { ...t, primary: `${obs.time}の${obs.place}`, detail: `${obs.sound}だけ${obs.motion}`, after: obs.discomfort };
  }

  function cleanPost(text) {
    let post = String(text || "").replace(/\s+/g, " ").replace(/。。+/g, "。").trim();
    abstractBans.forEach((word) => { post = post.replaceAll(word, ""); });
    return post.replace(/、+/g, "、").replace(/^、|、$/g, "").replace(/[。]+$/g, "").slice(0, 90);
  }

  function makePostFromObservation(t) {
    const forms = [
      `${t.primary}、${t.detail}`,
      `${t.primary}、${t.after}せいで${t.detail}`,
      `${t.place}、${t.time}になると${t.object}だけ${t.motion}`,
      `${t.light}の${t.place}、${t.sound}だけ残る`
    ];
    const post = cleanPost(forms[t.index % forms.length]);
    return post.length >= 18 ? post : `${t.time}の${t.place}、${t.sound}だけ残る`;
  }

  function buildPipeline(text) {
    const persona = els.persona?.value || "違和感ノート";
    const researchItems = splitResearchItems(text);
    const safeResearch = researchItems.length ? researchItems : fallbackResearchItems(5);
    const observations = safeResearch.map(parseObservation);
    const personaPosts = observations.map((obs) => personaTransform(obs, persona));
    const finalPosts = personaPosts.map(makePostFromObservation).filter(Boolean);
    return { researchItems: safeResearch, observations, personaPosts, finalPosts: finalPosts.length ? finalPosts : fallbackResearchItems(5).map((item, index) => makePostFromObservation(personaTransform(parseObservation(item, index), persona))), error: "" };
  }

  function getResearch() {
    return window.IwakanStorage?.getResearch?.() || read(keys.research, { text: "", notes: [], observations: [] });
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

  function noteType(text, index) {
    if (/店|売り場|棚|スーパー|コンビニ|ドラッグ|ホーム/.test(text)) return "店舗観察";
    if (/駅|市役所|病院|学校|商店街/.test(text)) return "場所メモ";
    if (/音|BGM|匂い|光|蛍光灯|看板|駐車場/.test(text)) return "観察素材";
    if (/流行|ニュース|話題|トレンド/.test(text)) return "トレンド";
    return index % 2 ? "違和感素材" : "ネタ元";
  }

  function runResearchPipeline({ updateGenerate = false } = {}) {
    resetFlow();
    showError("");
    let pipeline = null;
    try {
      setFlow("research", "active");
      const text = els.research?.value.trim() || "";
      pipeline = buildPipeline(text);
      if (!pipeline.researchItems.length) throw new Error("researchItems is empty");
      setFlow("research", "done");

      setFlow("observe", "active");
      if (!pipeline.observations.length) throw new Error("observations is empty");
      setFlow("observe", "done");

      setFlow("persona", "active");
      if (!pipeline.personaPosts.length) throw new Error("personaPosts is empty");
      setFlow("persona", "done");
      if (!pipeline.finalPosts.length) throw new Error("finalPosts is empty");

      if (updateGenerate) setFlow("generate", "active");
      else {
        setFlow("generate", "idle");
        setFlow("judge", "idle");
      }
    } catch (error) {
      console.error("[Iwakan Agent] pipeline failed. Falling back to local observations.", { error, pipeline });
      showError(`Agent処理に失敗しました。ローカルfallbackで続行します。${error.message ? ` ${error.message}` : ""}`);
      pipeline = buildPipeline(fallbackResearchItems(5).map((item) => item.text).join("\n"));
      pipeline.error = error.message || String(error);
      setFlow("research", pipeline.researchItems.length ? "done" : "error");
      setFlow("observe", pipeline.observations.length ? "done" : "error");
      setFlow("persona", pipeline.personaPosts.length ? "done" : "error");
      if (updateGenerate) setFlow("generate", "active");
    } finally {
      lastPipeline = pipeline || buildPipeline("");
      const notes = lastPipeline.researchItems.map((item, index) => ({
        id: item.id,
        text: item.text,
        url: item.url,
        type: noteType(item.text, index),
        observation: lastPipeline.observations[index]
      }));
      setResearch({ text: els.research?.value.trim() || "", notes, observations: lastPipeline.observations });
      renderNotes();
      renderPosts({ markFlow: updateGenerate });
      if (!updateGenerate) {
        setFlow("generate", "idle");
        setFlow("judge", "idle");
      }
      renderDebug();
    }
    return lastPipeline;
  }

  function renderNotes() {
    if (!els.notes) return;
    const research = getResearch();
    if (!research.notes?.length) {
      els.notes.textContent = "リサーチメモはまだありません。";
      return;
    }
    els.notes.innerHTML = research.notes.map((note, index) => {
      const obs = note.observation || parseObservation(note, index);
      return `<button class="note-chip" type="button" data-note-index="${index}"><b>${escapeHtml(note.type)}</b><span>${escapeHtml(`${obs.place} / ${obs.time} / ${obs.sound} / ${obs.object}`)}</span></button>`;
    }).join("");
  }

  function judgeIdea(text, obs = null) {
    const concreteWords = ["時", "売り場", "駐車場", "レジ", "棚", "蛍光灯", "BGM", "看板", "音", "匂い", "入口", "通路", "待合室", "夕方", "閉店", "雨", "人", "店"];
    const humanWords = ["だけ", "急に", "一瞬", "なぜか", "妙に", "まだ", "残る", "見える", "止まる", "聞こえる", "響く"];
    const abstract = abstractBans.filter((word) => text.includes(word)).length;
    const concrete = concreteWords.filter((word) => text.includes(word)).length;
    const human = humanWords.filter((word) => text.includes(word)).length;
    const consistency = obs ? consistencyPenalty(obs) : 0;
    const lengthFit = text.length >= 20 && text.length <= 90 ? 12 : -8;
    const specificity = clamp(48 + concrete * 9 + lengthFit - abstract * 8, 35, 98);
    const humanity = clamp(52 + human * 8 - abstract * 5, 35, 98);
    const iwakan = clamp(50 + (/普通|急に|妙に|だけ|少し|なぜか|残る/.test(text) ? 20 : 4) + concrete * 3 - consistency, 35, 98);
    const empathy = clamp(50 + (/ある|見る|聞こえる|残る|人/.test(text) ? 12 : 2) + human * 4, 35, 96);
    const comment = clamp(48 + (/だけ|なぜか|急に|妙に|止まる|見える|響く/.test(text) ? 16 : 3) + concrete * 3, 35, 96);
    const buzz = clamp(Math.round((specificity + humanity + iwakan + empathy + comment) / 5), 35, 98);
    return { empathy, comment, specificity, humanity, iwakan, buzz, reason: consistency ? "意味整合性を減点" : concrete >= 2 ? "具体描写あり" : "具体描写をもう少し足したい" };
  }

  function scoreMeter(label, value) {
    return `<div class="judge-item"><span>${label}</span><b>${value}</b><i style="--score:${value}%"></i></div>`;
  }

  function shouldReplaceText(text) {
    if (!text || text.length < 18) return true;
    if (abstractBans.some((word) => text.includes(word))) return true;
    return ["時", "レジ", "棚", "音", "光", "匂い", "駐車場", "売り場", "入口", "BGM"].filter((word) => text.includes(word)).length < 2;
  }

  function observationForIndex(index) {
    const saved = getResearch().observations || [];
    const observations = lastPipeline.observations.length ? lastPipeline.observations : saved;
    return observations[index % Math.max(1, observations.length)] || parseObservation(fallbackResearchItems(1)[0], index);
  }

  function renderPosts(options = {}) {
    enhanceCards(options);
  }

  function enhanceCards({ markFlow = true } = {}) {
    const cards = [...document.querySelectorAll(".idea-card")];
    const persona = els.persona?.value || "違和感ノート";
    cards.forEach((card, index) => {
      if (card.dataset.agentEnhanced === "1") return;
      const body = card.querySelector(".idea-text");
      const obs = observationForIndex(index);
      const transformed = personaTransform(obs, persona);
      const finalPost = makePostFromObservation(transformed);
      const original = body?.textContent.trim() || "";
      const display = shouldReplaceText(original) ? finalPost : cleanPost(original);
      if (body && display !== original) body.textContent = display;
      const judge = judgeIdea(display, obs);
      const top = card.querySelector(".card-top");
      if (top && !top.querySelector(".persona-pill")) top.insertAdjacentHTML("beforeend", `<span class="persona-pill">${escapeHtml(persona)}</span>`);
      body?.insertAdjacentHTML("afterend", `<div class="judge-grid" aria-label="Buzz Judge Agent">${scoreMeter("共感性", judge.empathy)}${scoreMeter("コメント", judge.comment)}${scoreMeter("具体性", judge.specificity)}${scoreMeter("人間味", judge.humanity)}${scoreMeter("違和感", judge.iwakan)}</div>`);
      card.querySelector(".card-actions")?.insertAdjacentHTML("beforeend", `<button class="mini queue" data-agent-queue="1" type="button">予約</button>`);
      const score = card.querySelector(".score span");
      if (score) score.textContent = String(judge.buzz);
      card.dataset.agentEnhanced = "1";
      lastPipeline.finalPosts[index] = display;
      lastPipeline.personaPosts[index] = transformed;
    });
    if (cards.length) {
      syncStoredIdeasFromCards(cards);
      if (markFlow) {
        setFlow("generate", "done");
        setFlow("judge", "done");
      }
      renderDebug();
    }
  }

  function syncStoredIdeasFromCards(cards) {
    const ideas = window.IwakanStorage?.getIdeas?.();
    if (!Array.isArray(ideas) || !ideas.length) return;
    const next = ideas.map((idea, index) => {
      const text = cards[index]?.querySelector(".idea-text")?.textContent.trim();
      const obs = observationForIndex(index);
      const judge = text ? judgeIdea(text, obs) : null;
      return text ? { ...idea, text, score: judge.buzz, judge, observation: obs } : idea;
    });
    window.IwakanStorage?.setIdeas?.(next);
  }

  function buildAgentTheme(originalTheme, pipeline) {
    const persona = els.persona?.value || "違和感ノート";
    const compact = pipeline.observations.slice(0, 6).map(({ place, time, light, sound, smell, temperature, crowd, object, motion, discomfort, nostalgia, realism }) => ({ place, time, light, sound, smell, temperature, crowd, object, motion, discomfort, nostalgia, realism }));
    return [
      `Observation Structから投稿化する。抽象語は禁止。人格:${persona}。`,
      `観察データ:${JSON.stringify(compact)}`,
      `候補文:${pipeline.finalPosts.slice(0, 6).join(" / ")}`
    ].join(" ");
  }

  function beforeGenerate() {
    let pipeline;
    try {
      pipeline = runResearchPipeline({ updateGenerate: true });
      const original = els.theme.value;
      els.theme.dataset.agentOriginalTheme = original;
      els.theme.value = buildAgentTheme(original, pipeline);
    } catch (error) {
      console.error("[Iwakan Agent] beforeGenerate failed", error);
      showError(`生成前処理に失敗しました。fallbackで続行します。${error.message || ""}`);
      pipeline = buildPipeline("");
      lastPipeline = pipeline;
      els.theme.value = buildAgentTheme(els.theme.value, pipeline);
      setFlow("generate", "active");
    } finally {
      setTimeout(() => {
        if (els.theme.dataset.agentOriginalTheme !== undefined) {
          els.theme.value = els.theme.dataset.agentOriginalTheme;
          delete els.theme.dataset.agentOriginalTheme;
        }
      }, 0);
      renderPosts();
      renderDebug();
    }
  }

  function addQueueFromCard(card) {
    const text = card.querySelector(".idea-text")?.textContent.trim();
    if (!text) return;
    const next = new Date(Date.now() + Math.max(1, getQueue().length + 1) * 60 * 60 * 1000);
    const item = { id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, category: card.querySelector(".badge")?.textContent.trim() || "違和感", persona: els.persona?.value || "違和感ノート", date: next.toISOString().slice(0, 10), time: next.toTimeString().slice(0, 5), createdAt: new Date().toISOString() };
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
    els.queue.innerHTML = queue.map((item) => `<article class="queue-item"><div><b>${escapeHtml(item.date)} ${escapeHtml(item.time)}</b><span>${escapeHtml(item.category)} / ${escapeHtml(item.persona)}</span></div><p>${escapeHtml(item.text)}</p><button class="text-btn danger-text" type="button" data-remove-queue="${item.id}">削除</button></article>`).join("");
  }

  function ensureDebugViewer() {
    const enabled = new URLSearchParams(location.search).has("debug") || read(keys.debug, false);
    if (!enabled || document.getElementById("observationDebug")) return;
    document.querySelector(".agent-panel")?.insertAdjacentHTML("beforeend", `<details id="observationDebug" class="debug-viewer" open><summary>Observation Debug Viewer</summary><pre id="observationDebugBody"></pre></details>`);
  }

  function renderDebug() {
    ensureDebugViewer();
    const body = document.getElementById("observationDebugBody");
    if (!body) return;
    body.textContent = JSON.stringify(lastPipeline, null, 2);
  }

  function boot() {
    if (!els.generate || !els.research || !els.persona) return;
    const research = getResearch();
    els.research.value = research.text || "";
    els.persona.value = read(keys.agent, { persona: "違和感ノート" }).persona || "違和感ノート";
    if (research.observations?.length) {
      const persona = els.persona.value;
      lastPipeline = {
        researchItems: research.notes || [],
        observations: research.observations,
        personaPosts: research.observations.map((obs) => personaTransform(obs, persona)),
        finalPosts: research.observations.map((obs) => makePostFromObservation(personaTransform(obs, persona))),
        error: ""
      };
    }
    renderNotes();
    renderQueue();
    resetFlow();
    renderDebug();
    els.saveResearch?.addEventListener("click", () => runResearchPipeline({ updateGenerate: false }));
    els.splitResearch?.addEventListener("click", () => runResearchPipeline({ updateGenerate: false }));
    els.generate.addEventListener("click", beforeGenerate, true);
    els.persona.addEventListener("change", () => {
      write(keys.agent, { persona: els.persona.value });
      runResearchPipeline({ updateGenerate: false });
    });
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
    new MutationObserver(() => renderPosts({ markFlow: true })).observe(els.list, { childList: true, subtree: true });
    renderPosts({ markFlow: false });
  }

  boot();
})();
