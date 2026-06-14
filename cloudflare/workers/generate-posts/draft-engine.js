const DEFAULT_ORIGINS = ["https://nakamurobo2026.github.io", "https://viral-os-phi.vercel.app"];
const TRIGGERS = ["curiosity", "nostalgia", "surprise", "controversy", "empathy"];

export function corsHeaders(env, origin) {
  const configured = [env.ALLOWED_ORIGIN, env.ALLOWED_ORIGINS]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...DEFAULT_ORIGINS, ...configured]);
  const requestOrigin = origin && allowedOrigins.has(origin) ? origin : (env.ALLOWED_ORIGIN || DEFAULT_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(env, request.headers.get("Origin")) });
}

function apiError(code, message, details) {
  return { success: false, error: { code, message, details } };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function supabaseRequest(env, path, init = {}) {
  if (!hasSupabase(env)) throw new Error("Supabase service environment variables are not configured.");
  const url = `${String(env.SUPABASE_URL).replace(/\/$/, "")}/rest/v1/${path}`;
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
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  });
}

function normalizeSource(source, index) {
  return {
    source_type: source.sourceType || source.source_type || "web",
    priority: source.priority || "C",
    weight: Number(source.weight || 0.3),
    reliability: Number(source.reliability || 0),
    impact: Number(source.impact || source.relevance || 0),
    url: source.url || null,
    title: source.title || null,
    summary: source.summary || source.content || null,
    extracted_elements: source.extractedElements || source.buzzElements || [],
    index
  };
}

async function persistResearchResponse(env, request, research) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId || !research?.success) return research;

  await ensureProfile(env, userId);
  const topic = research.topic || "auto-discovered trend";
  const briefRows = await supabaseRequest(env, "research_briefs", {
    method: "POST",
    body: JSON.stringify([{
      user_id: userId,
      topic,
      query: research.tavilySource || topic,
      summary: research.summary || "",
      source_count: Array.isArray(research.sources) ? research.sources.length : 0
    }])
  });
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief?.id) return research;

  const sources = Array.isArray(research.sources) ? research.sources.map(normalizeSource) : [];
  if (sources.length) {
    await supabaseRequest(env, "research_sources", {
      method: "POST",
      body: JSON.stringify(sources.slice(0, 20).map((source) => ({ ...source, brief_id: brief.id })))
    });
  }

  const elements = Array.isArray(research.viralElements) ? research.viralElements : [];
  if (elements.length) {
    await supabaseRequest(env, "viral_elements", {
      method: "POST",
      body: JSON.stringify(elements.slice(0, 24).map((element) => ({
        brief_id: brief.id,
        element_type: element.elementType || "angle",
        value: String(element.value || "").slice(0, 240),
        score: Number(element.score || 0)
      })))
    });
  }

  return { ...research, briefId: brief.id };
}

export async function handleResearchWithPersistence(request, env, ctx, worker, upstreamEnv = env) {
  const upstream = await worker.fetch(request.clone(), upstreamEnv, ctx);
  const raw = await upstream.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response(raw, { status: upstream.status, headers: corsHeaders(env, request.headers.get("Origin")) });
  }
  if (!upstream.ok || !data?.success) return json(data, env, request, upstream.status);
  try {
    return json(await persistResearchResponse(env, request, data), env, request, upstream.status);
  } catch (error) {
    console.error("research persistence fallback", error);
    return json(data, env, request, upstream.status);
  }
}

async function loadResearchContext(env, researchId) {
  if (!hasSupabase(env) || !isUuid(researchId)) return null;
  const briefRows = await supabaseRequest(env, `research_briefs?id=eq.${encodeURIComponent(researchId)}&select=*`, { method: "GET" });
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief) return null;
  const sourceRows = await supabaseRequest(env, `research_sources?brief_id=eq.${encodeURIComponent(researchId)}&select=*&order=impact.desc`, { method: "GET" });
  const elementRows = await supabaseRequest(env, `viral_elements?brief_id=eq.${encodeURIComponent(researchId)}&select=*&order=score.desc`, { method: "GET" });
  return { brief, sources: sourceRows || [], elements: elementRows || [] };
}

function scoreDraft(body, trigger, sourceCount, index) {
  const specific = ["時", "レジ", "棚", "駐車場", "音", "光", "人", "閉店", "地元", "商店街"].filter((word) => body.includes(word)).length;
  const triggerBoost = { curiosity: 9, nostalgia: 8, surprise: 7, controversy: 6, empathy: 8 }[trigger] || 6;
  return clamp(58 + specific * 4 + triggerBoost + Math.min(sourceCount, 6) * 2 - index, 0, 100);
}

function buildDraftCandidates(context, researchId) {
  const topic = context?.brief?.topic || "地方スーパーの閉店前";
  const summary = context?.brief?.summary || "";
  const sources = context?.sources || [];
  const elements = context?.elements || [];
  const sourceText = sources.map((source) => `${source.title || ""} ${source.summary || ""}`).join(" ");
  const elementText = elements.map((element) => element.value).join(" ");
  const material = `${topic} ${summary} ${sourceText} ${elementText}`;
  const place = material.match(/(地方スーパー|スーパー|商店街|駅前|道の駅|個人店|喫茶店|ドラッグストア|ホームセンター|市役所|地方駅)/)?.[0] || topic;
  const time = material.match(/(閉店前|17時過ぎ|夕方|夜|深夜|雨の日|最後の日|平日の昼過ぎ)/)?.[0] || "17時過ぎ";
  const sound = material.match(/(レジ音|BGM|店内放送|蛍光灯|台車の音|自動ドア|雨の音)/)?.[0] || "レジ音";
  const object = material.match(/(棚|駐車場|看板|惣菜売り場|入口|袋詰め台|通路|空き店舗)/)?.[0] || "棚";
  const bodies = [
    `${time}の${place}、${sound}だけ残って${object}の色が少し暗く見える`,
    `${place}って、${time}になると急に生活の音だけになる`,
    `${time}の${place}、人が減ったあとに${object}だけ妙に広く見える`,
    `${place}の${object}、普通なのに${time}だけ少し知らない場所になる`,
    `${sound}が残る${place}、なぜか昔の店みたいに見える`,
    `${time}の${place}で、片付けの気配だけ先に始まってる感じがする`,
    `${place}の${object}、明るいのに閉店前っぽい空気になる瞬間がある`,
    `${time}の${place}、誰も急いでないのに店だけ終わりに向かってる`,
    `${place}で${sound}が小さくなると、急に地元の店って感じが出る`,
    `${time}の${place}、${object}の前だけ時間が少し遅い`
  ];

  return bodies.map((body, index) => {
    const emotionalTrigger = TRIGGERS[index % TRIGGERS.length];
    return {
      title: `${place} / ${time}`,
      hook: {
        curiosity: "なんであの時間だけ違って見えるんだろう",
        nostalgia: "昔から知ってる場所ほど、変化が先に見える",
        surprise: "普通の店なのに、急に知らない場所になる瞬間",
        controversy: "便利になったのに、少し寂しくなる場所がある",
        empathy: "これ、たぶん見たことある人多いと思う"
      }[emotionalTrigger],
      body: body.slice(0, 120),
      cta: ["この感じだけ残しておきたい", "あの時間の空気、説明しにくい", "普通の場所ほど覚えてる", "なくなる前に気づくこと多い", "あれ何なんだろう"][index % 5],
      score: scoreDraft(body, emotionalTrigger, sources.length, index),
      emotionalTrigger,
      researchId
    };
  });
}

function clientDraft(rowOrDraft) {
  if (rowOrDraft.text && rowOrDraft.score_total !== undefined) {
    const detail = rowOrDraft.score_detail || {};
    return {
      id: rowOrDraft.id,
      title: detail.title || rowOrDraft.category || "Threads draft",
      hook: detail.hook || "",
      body: rowOrDraft.text,
      cta: detail.cta || "",
      score: rowOrDraft.score_total,
      emotionalTrigger: detail.emotionalTrigger || rowOrDraft.hook_type || "empathy",
      text: rowOrDraft.text,
      status: rowOrDraft.status,
      category: rowOrDraft.category,
      hookType: rowOrDraft.hook_type,
      scoreTotal: rowOrDraft.score_total,
      scoreDetail: rowOrDraft.score_detail || {},
      sourceTrace: rowOrDraft.source_trace || []
    };
  }
  return {
    ...rowOrDraft,
    id: crypto.randomUUID(),
    text: [rowOrDraft.hook, rowOrDraft.body, rowOrDraft.cta].filter(Boolean).join("\n"),
    status: "scored",
    category: "threads",
    hookType: rowOrDraft.emotionalTrigger,
    scoreTotal: rowOrDraft.score,
    scoreDetail: {
      title: rowOrDraft.title,
      hook: rowOrDraft.hook,
      cta: rowOrDraft.cta,
      emotionalTrigger: rowOrDraft.emotionalTrigger
    },
    sourceTrace: [rowOrDraft.researchId].filter(Boolean)
  };
}

async function persistDrafts(env, request, researchId, drafts) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId) return drafts.map(clientDraft);
  await ensureProfile(env, userId);
  const rows = drafts.map((draft) => ({
    user_id: userId,
    brief_id: isUuid(researchId) ? researchId : null,
    text: [draft.hook, draft.body, draft.cta].filter(Boolean).join("\n"),
    status: "scored",
    category: "threads",
    hook_type: draft.emotionalTrigger,
    persona: "Viral OS",
    score_total: draft.score,
    score_detail: {
      title: draft.title,
      hook: draft.hook,
      cta: draft.cta,
      emotionalTrigger: draft.emotionalTrigger
    },
    source_trace: [researchId]
  }));
  const inserted = await supabaseRequest(env, "post_drafts", {
    method: "POST",
    body: JSON.stringify(rows)
  });
  return (Array.isArray(inserted) ? inserted : []).map(clientDraft);
}

export async function handleDraftGenerate(request, env) {
  const body = await request.json().catch(() => ({}));
  const researchId = String(body.researchId || body.briefId || "").trim();
  if (!researchId) return json(apiError("missing_research_id", "researchId is required."), env, request, 400);
  let context = null;
  try {
    context = await loadResearchContext(env, researchId);
  } catch (error) {
    console.error("draft research load fallback", error);
  }
  const candidates = buildDraftCandidates(context, researchId).slice(0, 10);
  const drafts = await persistDrafts(env, request, researchId, candidates).catch((error) => {
    console.error("draft persistence fallback", error);
    return candidates.map(clientDraft);
  });
  return json({ success: true, drafts: drafts.slice(0, 10) }, env, request);
}

export async function handleDashboard(request, env) {
  const userId = getAuthUserId(request);
  if (hasSupabase(env) && userId) {
    try {
      await ensureProfile(env, userId);
      const [draftRows, briefRows, jobRows, auditRows] = await Promise.all([
        supabaseRequest(env, `post_drafts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`, { method: "GET" }),
        supabaseRequest(env, `research_briefs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }),
        supabaseRequest(env, `publish_jobs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=scheduled_at.asc&limit=20`, { method: "GET" }),
        supabaseRequest(env, `audit_events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" })
      ]);
      const drafts = (draftRows || []).map(clientDraft);
      const published = drafts.filter((draft) => draft.status === "published").length;
      const failed = drafts.filter((draft) => draft.status === "failed").length;
      const scheduled = drafts.filter((draft) => draft.status === "scheduled").length;
      const awaitingApproval = drafts.filter((draft) => draft.status === "scored" || draft.status === "draft").length;
      const averageScore = drafts.length ? Math.round(drafts.reduce((sum, draft) => sum + (draft.scoreTotal || draft.score || 0), 0) / drafts.length) : 0;
      return json({
        ok: true,
        researchCount: briefRows?.length || 0,
        draftCount: drafts.length,
        queueCount: jobRows?.length || 0,
        success: true,
        profile: {
          id: userId,
          displayName: "Viral OS Operator",
          threadsConnected: Boolean(env.THREADS_ACCESS_TOKEN)
        },
        drafts,
        researchBriefs: (briefRows || []).map((brief) => ({
          id: brief.id,
          topic: brief.topic,
          summary: brief.summary,
          sourceCount: brief.source_count || 0,
          createdAt: brief.created_at
        })),
        publishJobs: (jobRows || []).map((job) => ({
          id: job.id,
          draftId: job.draft_id,
          status: job.status,
          scheduledAt: job.scheduled_at,
          attemptCount: job.attempt_count,
          lastError: job.last_error
        })),
        auditEvents: (auditRows || []).map((event) => ({
          id: event.id,
          entityType: event.entity_type,
          entityId: event.entity_id,
          action: event.action,
          metadata: event.metadata || {},
          createdAt: event.created_at
        })),
        metrics: {
          awaitingApproval,
          scheduled,
          failed,
          published,
          averageScore,
          sourceBackedDrafts: drafts.filter((draft) => draft.sourceTrace?.length).length
        }
      }, env, request);
    } catch (error) {
      console.error("dashboard supabase fallback", error);
    }
  }
  return json({
    ok: true,
    researchCount: 0,
    draftCount: 0,
    queueCount: 0,
    success: true,
    profile: {
      id: "iwakan-lab",
      displayName: "Iwakan Lab",
      threadsConnected: Boolean(env.THREADS_ACCESS_TOKEN)
    },
    drafts: [],
    researchBriefs: [],
    publishJobs: [],
    auditEvents: [],
    metrics: {
      awaitingApproval: 0,
      scheduled: 0,
      failed: 0,
      published: 0,
      averageScore: 0,
      sourceBackedDrafts: 0
    }
  }, env, request);
}
