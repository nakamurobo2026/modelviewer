const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const TIMEOUT_MS = 15000;
const MAX_COUNT = 50;
const AI_SEED_COUNT = 12;
const abstractWords = ["静か", "違和感", "深い", "エモい", "孤独", "ノスタルジー", "余白", "世界観", "尊い", "沁みる"];
const bannedPhrases = ["心が静か", "時間が止まる", "孤独が優しい", "空気が沁みる", "分かる人いる", "刺さる人には刺さる", "深夜の空気"];

const observationDb = {
  "スーパー": ["17時過ぎの惣菜売り場でレジの音だけ響く", "閉店前に棚の色が急に暗く見える", "広い駐車場に車がまばらで入口だけ明るい", "袋詰め台で全員少し無言になる"],
  "ホームセンター": ["閉店前の木材売り場だけ時間が遅い", "園芸コーナーだけ外の夕方が残る", "ネジ売り場でひとりだけ長く止まってる", "台車の音が通路の奥まで響く"],
  "コンビニ": ["深夜1時に冷蔵ケースの音だけ続く", "雨の夜にガラスへ店内が二重に映る", "朝5時の揚げ物ケースだけ先に起きてる", "駐車場が広い店ほど店内が浮いて見える"],
  "地方駅": ["18時前のホーム端だけ夕日が残る", "改札の音が数分に一回だけ鳴る", "待合室の古い椅子に誰かの荷物だけある", "次の電車までの時間が長く見える"],
  "市役所": ["15時半の番号表示だけ明るい", "閉庁前に廊下の奥だけ暗くなる", "プリンターの音がずっと続く", "番号を呼ばれても一拍遅れる"],
  "商店街": ["夕方にシャッターの音が一つだけ響く", "開いてる店と閉まってる店の差が大きい", "色あせた旗だけ風で動いてる", "店の奥からラジオが漏れてる"],
  "古い病院": ["待合室でスリッパの音だけ廊下に残る", "呼ばれる直前に全員少し顔を上げる", "テレビを誰も見てない", "消毒液と古い椅子の匂いが混ざる"],
  "学校": ["放課後の廊下に部活の声だけ残る", "黒板の日付だけそのまま", "休日の体育館でボールの音が一回だけ響く", "誰もいない教室ほど音が大きい"],
  "パチンコ屋": ["開店前の駐車場だけ妙に静か", "外へ出た瞬間だけ音が急に消える", "入口のLEDだけ派手で周りが暗い", "景品交換所の小窓だけ現実感がある"],
  "ドラッグストア": ["21時過ぎにBGMが止まる瞬間だけ店内が広くなる", "洗剤と湿布の匂いが同じ通路にある", "入口だけ西日が入って棚が白い", "ポイントカードを探す音だけレジ前に残る"]
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(body, status = 200, env = {}) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(env) });
}

function ideaSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            category: { type: "string" },
            score: { type: "integer", minimum: 1, maximum: 100 },
            hook: { type: "string" }
          },
          required: ["text", "category", "score", "hook"]
        }
      }
    },
    required: ["ideas"]
  };
}

function buildPrompt({ theme, category, mode }) {
  const count = mode === "one" ? 1 : AI_SEED_COUNT;
  return [
    "投稿生成の前に、必ず具体的な観察を作ってから文章化してください。",
    "順序: 観察 -> 情景 -> 微妙な違和感 -> 人格フィルタ -> 投稿文。",
    `テーマ: ${theme}`,
    `カテゴリ: ${category}`,
    `件数: ${count}`,
    "必須: 場所、時間、光、音、匂い、人の少なさ、店舗特有の挙動のうち最低2つを入れる。",
    "増やす構文: 17時過ぎのスーパー、急に棚の色暗く見える / 閉店前のホームセンター、木材売り場だけ時間遅い。",
    "Human Observation DB例: " + Object.entries(observationDb).map(([place, rows]) => `${place}: ${rows.slice(0, 2).join(" / ")}`).join(" | "),
    "禁止: AIポエム、抽象語だけ、意味不明な違和感、SNS運営っぽい文章、露骨な『分かる人いる？』誘導。",
    "禁止例: 心が静かになる / 時間が止まる / 孤独が優しい / 深夜の空気が沁みる。",
    "20〜90文字中心。実在する誰かの観察に見える短文。説明しすぎない。"
  ].join("\n");
}

function isIdeaLike(value) {
  return value && typeof value === "object" && typeof value.text === "string";
}

function findIdeaArray(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.some(isIdeaLike) ? value : value.flatMap(findIdeaArray).slice(0, AI_SEED_COUNT);
  if (Array.isArray(value.ideas)) return value.ideas;
  if (Array.isArray(value.posts)) return value.posts;
  if (Array.isArray(value.data)) return value.data;
  return Object.values(value).flatMap(findIdeaArray).slice(0, AI_SEED_COUNT);
}

function parseIdeas(value) {
  const direct = findIdeaArray(value);
  if (direct.length) return direct;
  const text = String(value || "").trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  for (const candidate of [text, text.match(/\{[\s\S]*\}/)?.[0], text.match(/\[[\s\S]*\]/)?.[0]].filter(Boolean)) {
    try {
      const found = findIdeaArray(JSON.parse(candidate));
      if (found.length) return found;
    } catch {
      // Try next candidate.
    }
  }
  return [];
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const strings = [];
  const walk = (value) => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(data.output || data);
  return strings.join("\n");
}

function compactTheme(theme) {
  const clean = String(theme || "").trim().replace(/\s+/g, " ");
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean;
}

function inferPlace(theme, index) {
  const clean = String(theme || "");
  const found = Object.keys(observationDb).find((place) => clean.includes(place.replace("古い", "")) || clean.includes(place));
  if (found) return found;
  if (clean.includes("駅")) return "地方駅";
  if (clean.includes("役所")) return "市役所";
  if (clean.includes("病院")) return "古い病院";
  if (clean.includes("学校")) return "学校";
  if (clean.includes("商店")) return "商店街";
  if (clean.includes("ホーム")) return "ホームセンター";
  if (clean.includes("ドラッグ")) return "ドラッグストア";
  if (clean.includes("コンビニ")) return "コンビニ";
  const places = Object.keys(observationDb);
  return places[index % places.length];
}

function concreteScore(text) {
  const concreteTokens = ["時", "売り場", "駐車場", "レジ", "棚", "蛍光灯", "BGM", "看板", "台車", "匂い", "音", "入口", "通路", "待合室", "改札", "床", "窓", "夕方", "閉店", "雨", "カート", "シャッター", "ホーム", "廊下"];
  const concrete = concreteTokens.filter((word) => text.includes(word)).length * 7;
  const abstractPenalty = abstractWords.filter((word) => text.includes(word)).length * 6;
  const bannedPenalty = bannedPhrases.some((phrase) => text.includes(phrase)) ? 40 : 0;
  const lengthScore = text.length >= 20 && text.length <= 90 ? 18 : 4;
  const humanScore = /だけ|急に|一瞬|なぜか|妙に|まだ|先に|残る|見える/.test(text) ? 10 : 4;
  return Math.max(35, Math.min(98, 54 + concrete + lengthScore + humanScore - abstractPenalty - bannedPenalty));
}

function passesQuality(text) {
  if (!text || text.length < 18 || text.length > 100) return false;
  if (bannedPhrases.some((phrase) => text.includes(phrase))) return false;
  const hasConcrete = /[0-9]時|売り場|駐車場|レジ|棚|蛍光灯|BGM|看板|音|匂い|入口|通路|待合室|改札|廊下|シャッター/.test(text);
  const abstractCount = abstractWords.filter((word) => text.includes(word)).length;
  return hasConcrete || abstractCount <= 1;
}

function normalizeIdea(idea, fallbackCategory, index) {
  const text = String(idea?.text || "").trim().slice(0, 120);
  const category = String(idea?.category || fallbackCategory || "違和感");
  const hook = String(idea?.hook || idea?.hookType || "観察");
  const rawScore = Number(idea?.score);
  const score = Number.isFinite(rawScore) ? Math.max(1, Math.min(100, Math.round(rawScore))) : concreteScore(text);
  return { text, category, score, hook };
}

function fallbackSeeds(theme, category) {
  const place = inferPlace(theme, 0);
  const shortTheme = compactTheme(theme);
  return observationDb[place].map((observation, index) => ({
    text: index % 2 === 0 ? `${place}、${observation}` : `${shortTheme}、${observation}`,
    category,
    score: 82 + (index % 9),
    hook: index % 3 === 0 ? "観察" : category
  }));
}

function makeLocalVariant(seed, theme, category, index) {
  const place = inferPlace(theme, index);
  const base = String(seed?.text || "").replace(/[。\s]+$/, "");
  const observation = observationDb[place][index % observationDb[place].length];
  const forms = [`${place}、${observation}`, `${compactTheme(theme)}、${observation}`, `${base}。${observation}`, `${place}の${observation}`];
  const text = forms[index % forms.length].slice(0, 95);
  return normalizeIdea({ text, category: seed?.category || category, score: concreteScore(text), hook: seed?.hook || seed?.hookType || "観察" }, category, index);
}

function expandIdeas(seeds, theme, category, mode) {
  const sourceSeeds = seeds.length ? seeds : fallbackSeeds(theme, category);
  const normalized = sourceSeeds.map((idea, index) => normalizeIdea(idea, category, index)).filter((idea) => passesQuality(idea.text));
  const base = normalized.length ? normalized : fallbackSeeds(theme, category).map((idea, index) => normalizeIdea(idea, category, index));
  if (mode === "one") return base.slice(0, 1);
  const ideas = [...base];
  let index = 0;
  while (ideas.length < MAX_COUNT && base.length) {
    ideas.push(makeLocalVariant(base[index % base.length], theme, category, ideas.length + index));
    index += 1;
  }
  return ideas.slice(0, MAX_COUNT);
}

async function callChatCompletions({ env, theme, category, mode, signal }) {
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "あなたは実在しそうな観察からThreads向け短文投稿案をJSONで返す編集者です。AIポエムは禁止です。" },
        { role: "user", content: buildPrompt({ theme, category, mode }) }
      ],
      response_format: { type: "json_schema", json_schema: { name: "threads_post_ideas", strict: true, schema: ideaSchema() } },
      max_completion_tokens: mode === "one" ? 350 : 900
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Chat Completions failed: ${response.status} ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  return parseIdeas(data?.choices?.[0]?.message?.content || data);
}

async function callResponsesApi({ env, theme, category, mode, signal }) {
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: buildPrompt({ theme, category, mode }),
      max_output_tokens: mode === "one" ? 350 : 900,
      text: { format: { type: "json_schema", name: "threads_post_ideas", strict: true, schema: ideaSchema() } }
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Responses API failed: ${response.status} ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const parsed = parseIdeas(data);
  return parsed.length ? parsed : parseIdeas(extractResponseText(data));
}

async function callOpenAI(args) {
  const errors = [];
  for (const call of [callChatCompletions, callResponsesApi]) {
    try {
      const ideas = await call(args);
      if (ideas.length) return ideas;
      errors.push("No usable ideas returned.");
    } catch (error) {
      errors.push(error && error.message ? error.message : String(error));
    }
  }
  throw new Error(errors.join(" | "));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(env) });
    if (url.pathname !== "/generate") return json({ success: false, error: "Not found. Use POST /generate." }, 404, env);
    if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405, env);

    let payload;
    try { payload = await request.json(); }
    catch { return json({ success: false, error: "Request body must be JSON." }, 400, env); }

    const theme = String(payload.theme || "").trim();
    const category = String(payload.category || "違和感").trim();
    const mode = payload.mode === "one" ? "one" : "list";
    if (!theme) return json({ success: false, error: "theme is required." }, 400, env);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    let seedIdeas = [];
    let source = "openai";
    let errorDetail = "";

    try {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
      seedIdeas = await callOpenAI({ env, theme, category, mode, signal: controller.signal });
      if (!seedIdeas.length) throw new Error("OpenAI response did not include usable post ideas.");
    } catch (error) {
      source = "worker-fallback";
      errorDetail = error && error.message ? error.message : String(error);
      console.error("OpenAI generation failed. Returning Worker fallback ideas.", error);
    } finally {
      clearTimeout(timeout);
    }

    const ideas = expandIdeas(seedIdeas, theme, category, mode);
    return json({ success: true, model: env.OPENAI_MODEL || DEFAULT_MODEL, source, count: ideas.length, elapsedMs: Date.now() - startedAt, error: errorDetail || undefined, ideas }, 200, env);
  }
};
