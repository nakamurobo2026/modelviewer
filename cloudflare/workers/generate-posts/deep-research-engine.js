import { corsHeaders } from "./trend-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function apiError(code, message, details) {
  return { success: false, error: { code, message, details } };
}

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
}

function getAuthUserId(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(normalized)).sub || null;
  } catch {
    return null;
  }
}

async function supabaseRequest(env, path, init = {}, operation = path) {
  if (!hasSupabase(env)) throw Object.assign(new Error("Supabase service environment variables are not configured."), { diagnostic: { table: "config", operation } });
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, "")}/rest/v1/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    }
  });
  const raw = await response.text();
  if (!response.ok) {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {}
    throw Object.assign(new Error(parsed?.message || `Supabase ${response.status}`), {
      diagnostic: {
        table: operation.split(".")[0],
        operation,
        code: parsed?.code || response.status,
        message: parsed?.message || response.statusText,
        details: parsed?.details || raw.slice(0, 500),
        hint: parsed?.hint || null
      }
    });
  }
  return raw ? JSON.parse(raw) : null;
}

function draftFromRow(row) {
  const detail = row.score_detail || {};
  const postText = detail.post_text || detail.postText || row.text || "";
  return {
    id: row.id,
    userId: row.user_id,
    briefId: row.research_brief_id || row.brief_id || null,
    text: postText,
    post_text: postText,
    category: row.category,
    genre: detail.genre || row.hook_type || "micro_observation",
    persona: detail.persona || row.persona || "町の観察者",
    scoreDetail: detail,
    sourceTrace: row.source_trace || []
  };
}

async function loadDraft(env, request, draftId) {
  const userId = getAuthUserId(request);
  if (!userId) return { error: json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401) };
  if (!isUuid(draftId)) return { error: json(apiError("invalid_draft_id", "A valid draft id is required."), env, request, 400) };
  const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" }, "post_drafts.select");
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { error: json(apiError("draft_not_found", "Draft was not found for this user."), env, request, 404) };
  return { draft: draftFromRow(row), row, userId };
}

function sentenceParts(text) {
  return String(text || "").replace(/\n+/g, "。").split(/[。！？]/).map((item) => item.trim()).filter(Boolean);
}

function extractResearchGaps(draft) {
  const text = draft.post_text || draft.text || "";
  const scene = draft.scoreDetail?.scene || {};
  const domain = draft.scoreDetail?.domain || draft.category || "Threads";
  const object = scene.object || sentenceParts(text).find((part) => /(通知|コーヒー|用紙|レシート|文章|プロフィール|カーテン|ランドセル|アプリ|掲示物|ボタン|収納|定期|コメント|パネル|惣菜)/.test(part)) || domain;
  const action = scene.human_action || scene.human_behavior || sentenceParts(text).find((part) => /(いる|している|見ている|止まっている|読み返している|補充している|開いている|伏せている)/.test(part)) || "人の行動がまだ薄い";
  const meaning = scene.meaning || draft.scoreDetail?.why_it_may_spread || draft.scoreDetail?.whyItMaySpread || "なぜ反応されるのかの背景が薄い";
  return {
    draftId: draft.id,
    researchQuestions: [
      `${domain} ${object} ${action} あるある SNS 反応`,
      `${domain} ${meaning} 共感 コメント 体験談`,
      `${domain} ${object} 具体例 日常 観察`,
      `${domain} 反対意見 賛否 なぜ`,
      `${domain} ${object} 場面 描写 音 光 人の動き`
    ].slice(0, 5),
    missingExamples: [`${object}が出てくる具体例`, `${action}が自然に起きる場所や時間`],
    missingContext: [`${domain}でこの感覚が広がる社会背景`, "読者が自分の経験を重ねられる文脈"],
    opposingAngles: ["気にしすぎという見方", "別に普通の行動だという見方"],
    betterSceneHints: [`${object}の状態をもう一段具体化する`, "人の手元、視線、止まる瞬間を足す"]
  };
}

async function tavilySearch(env, query) {
  if (!env.TAVILY_API_KEY) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: "basic", max_results: 4, include_answer: true })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Tavily ${response.status}: ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw);
  return Array.isArray(data.results) ? data.results : [];
}

function cleanResult(item, query) {
  const title = String(item.title || "").slice(0, 120);
  const content = String(item.content || item.raw_content || "").replace(/\s+/g, " ").slice(0, 260);
  return {
    query,
    url: item.url || "",
    title,
    summary: content || title,
    source_type: /x\.com|twitter/i.test(item.url || "") ? "x" : /note\.com/i.test(item.url || "") ? "note" : /yahoo/i.test(item.url || "") ? "news" : "web"
  };
}

async function runDeeperResearch(env, questions) {
  const collected = [];
  const errors = [];
  for (const query of questions.slice(0, 5)) {
    try {
      const results = await tavilySearch(env, query);
      collected.push(...results.map((item) => cleanResult(item, query)));
    } catch (error) {
      errors.push({ query, message: String(error?.message || error) });
    }
  }
  return { results: collected.slice(0, 12), errors };
}

function buildEnrichedContext(draft, gaps, research) {
  const facts = research.results.map((item) => item.summary).filter(Boolean).slice(0, 6);
  const examples = [
    ...gaps.missingExamples,
    ...research.results.map((item) => item.title).filter(Boolean).slice(0, 4)
  ].slice(0, 6);
  const opposing = gaps.opposingAngles;
  const hints = [
    ...gaps.betterSceneHints,
    ...facts.map((fact) => fact.split("。|.")[0]).filter(Boolean).slice(0, 3)
  ].slice(0, 6);
  return {
    draftId: draft.id,
    researchQuestions: gaps.researchQuestions,
    enrichedFacts: facts.length ? facts : ["読者が自分の生活に置き換えられる具体場面が必要"],
    concreteExamples: examples,
    opposingViews: opposing,
    sceneHints: hints,
    tavilyErrors: research.errors
  };
}

async function saveResearchSources(env, draft, research) {
  if (!draft.briefId || !isUuid(draft.briefId) || !research.results.length) return { skipped: true, reason: "missing_brief_id_or_results" };
  const rows = research.results.slice(0, 8).map((item) => ({
    brief_id: draft.briefId,
    source_type: item.source_type || "web",
    priority: item.source_type === "x" ? "S" : "B",
    weight: item.source_type === "x" ? 1 : 0.5,
    reliability: 55,
    impact: 45,
    url: item.url || null,
    title: item.title || "Deep research source",
    summary: item.summary || "",
    extracted_elements: [item.query].filter(Boolean)
  }));
  try {
    const inserted = await supabaseRequest(env, "research_sources", { method: "POST", body: JSON.stringify(rows) }, "research_sources.insert.deep_research");
    return { ok: true, inserted: Array.isArray(inserted) ? inserted.length : rows.length };
  } catch (error) {
    console.error("deep research source persistence failed", error);
    return { ok: false, error: error.diagnostic || String(error?.message || error) };
  }
}

async function saveDraftResearchContext(env, context) {
  const row = {
    draft_id: context.draftId,
    research_questions: context.researchQuestions,
    enriched_facts: context.enrichedFacts,
    concrete_examples: context.concreteExamples,
    opposing_views: context.opposingViews,
    scene_hints: context.sceneHints
  };
  const inserted = await supabaseRequest(env, "draft_research_context", { method: "POST", body: JSON.stringify([row]) }, "draft_research_context.insert");
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function loadLatestContext(env, draftId) {
  const rows = await supabaseRequest(env, `draft_research_context?draft_id=eq.${encodeURIComponent(draftId)}&order=created_at.desc&limit=1&select=*`, { method: "GET" }, "draft_research_context.select");
  return Array.isArray(rows) ? rows[0] : null;
}

function stripInternal(text) {
  return String(text || "").replace(/https?:\/\/\S+/g, "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(/調査によると|この記事では|出典|引用|ソース|研究|分析結果|レポート|score|source/gi, "").trim();
}

function rewriteWithContext(draft, context) {
  const scene = draft.scoreDetail?.scene || {};
  const firstHint = context.scene_hints?.[0] || context.sceneHints?.[0] || context.concrete_examples?.[0] || context.concreteExamples?.[0] || "手元の細かい動き";
  const fact = context.enriched_facts?.[0] || context.enrichedFacts?.[0] || "生活の中で似た経験を持つ人が多い";
  const object = scene.object || "その場に残った物";
  const action = scene.human_action || scene.human_behavior || "人が一度だけ立ち止まっている";
  const emotion = scene.emotion || "少しだけ引っかかる";
  const meaning = scene.meaning || "小さい場面ほど本音が出る";
  const question = scene.comment_question || scene.comment_invitation || "こういう場面、見たことある？";
  const base = [
    scene.place ? `${scene.place}。` : "日常の途中。",
    `${object}が目に入る。`,
    `${action}。`,
    `${firstHint}まで見えると、${emotion}。`,
    `${meaning}。${question}`
  ].join("\n");
  const text = stripInternal(base).slice(0, 220);
  const depthScore = scoreDepth(text, context, fact);
  return { text, depthScore };
}

function scoreDepth(text, context, fact) {
  let score = 0;
  if (context.concrete_examples?.length || context.concreteExamples?.length) score += 22;
  if (context.enriched_facts?.length || context.enrichedFacts?.length) score += 20;
  if (context.opposing_views?.length || context.opposingViews?.length) score += 16;
  if (context.scene_hints?.length || context.sceneHints?.length) score += 22;
  if (/(でも|一方で|気にしすぎ|普通|分かれ)/.test(text + fact)) score += 10;
  if (/(ある？|よね|だろう|ない？|迷う)/.test(text)) score += 10;
  return Math.max(0, Math.min(100, score));
}

function clientContext(row, fallback) {
  if (!row) return fallback;
  return {
    id: row.id,
    draftId: row.draft_id,
    researchQuestions: row.research_questions || fallback.researchQuestions || [],
    enrichedFacts: row.enriched_facts || fallback.enrichedFacts || [],
    concreteExamples: row.concrete_examples || fallback.concreteExamples || [],
    opposingViews: row.opposing_views || fallback.opposingViews || [],
    sceneHints: row.scene_hints || fallback.sceneHints || [],
    createdAt: row.created_at
  };
}

export async function handleDeepenDraftResearch(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const draftId = String(body.draftId || "").trim();
    const loaded = await loadDraft(env, request, draftId);
    if (loaded.error) return loaded.error;
    const { draft } = loaded;
    const gaps = extractResearchGaps(draft);
    const research = await runDeeperResearch(env, gaps.researchQuestions);
    const context = buildEnrichedContext(draft, gaps, research);
    const sourcePersistence = await saveResearchSources(env, draft, research);
    let saved = null;
    let contextPersistence = { ok: true };
    try {
      saved = await saveDraftResearchContext(env, context);
    } catch (error) {
      console.error("draft research context persistence failed", error);
      contextPersistence = { ok: false, error: error.diagnostic || String(error?.message || error) };
    }
    return json({
      success: true,
      context: clientContext(saved, context),
      gaps,
      researchResults: research.results,
      persistence: { draft_research_context: contextPersistence, research_sources: sourcePersistence }
    }, env, request);
  } catch (error) {
    console.error("deep research failed", error);
    return json(apiError("deep_research_failed", "Deep research failed.", error.diagnostic || String(error?.message || error)), env, request, 500);
  }
}

export async function handleRewriteWithResearch(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const draftId = String(body.draftId || "").trim();
    const loaded = await loadDraft(env, request, draftId);
    if (loaded.error) return loaded.error;
    const { draft } = loaded;
    const contextRow = await loadLatestContext(env, draftId);
    if (!contextRow) return json(apiError("missing_deep_research", "Deep research context was not found for this draft."), env, request, 404);
    const context = clientContext(contextRow, { draftId });
    const rewritten = rewriteWithContext(draft, context);
    const currentDetail = loaded.row.score_detail || {};
    const totalScore = Math.max(Number(loaded.row.score_total || currentDetail.totalScore || 0), Math.round(rewritten.depthScore * 0.9));
    const scoreDetail = {
      ...currentDetail,
      post_text: rewritten.text,
      postText: rewritten.text,
      body: rewritten.text,
      depth_score: rewritten.depthScore,
      depthScore: rewritten.depthScore,
      deepResearchContext: context,
      totalScore,
      internal: { ...(currentDetail.internal || {}), deep_research_loop: true }
    };
    const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(loaded.userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ text: rewritten.text, score_total: totalScore, score_detail: scoreDetail })
    }, "post_drafts.patch.rewrite_with_research");
    const updated = Array.isArray(rows) ? rows[0] : null;
    return json({
      success: true,
      draft: updated ? {
        id: updated.id,
        post_text: rewritten.text,
        postText: rewritten.text,
        text: rewritten.text,
        status: updated.status,
        category: updated.category,
        hookType: updated.hook_type,
        score: updated.score_total,
        scoreTotal: updated.score_total,
        totalScore,
        scoreDetail,
        sourceTrace: updated.source_trace || []
      } : { id: draftId, post_text: rewritten.text, postText: rewritten.text, text: rewritten.text, scoreDetail },
      context,
      depth_score: rewritten.depthScore,
      depthScore: rewritten.depthScore
    }, env, request);
  } catch (error) {
    console.error("rewrite with deep research failed", error);
    return json(apiError("rewrite_with_research_failed", "Rewrite with deep research failed.", error.diagnostic || String(error?.message || error)), env, request, 500);
  }
}
