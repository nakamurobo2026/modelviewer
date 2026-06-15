import { corsHeaders } from "./trend-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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

function sourceRow(source, briefId) {
  return {
    research_brief_id: briefId,
    source_type: source.sourceType || source.source_type || "web",
    priority: source.priority || "C",
    weight: Number(source.weight || 0.3),
    url: source.url || null,
    title: source.title || null,
    summary: source.summary || source.content || null,
    content: source.content || source.summary || null,
    reliability: Number(source.reliability || 0),
    impact: Number(source.impact || source.relevance || 0),
    relevance: Number(source.relevance || source.impact || 0),
    extracted_elements: source.extractedElements || source.buzzElements || [],
    metadata: {
      reason: source.reason || null,
      index: source.index ?? null
    }
  };
}

function elementRow(element, briefId) {
  return {
    research_brief_id: briefId,
    element_type: element.elementType || element.element_type || "angle",
    value: String(element.value || "").slice(0, 240),
    score: Number(element.score || 0),
    metadata: element.metadata || {}
  };
}

async function persistResearchResponse(env, request, research) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId || !research?.success) return research;

  await ensureProfile(env, userId);
  const topic = research.topic || research.selectedTrend?.keyword || "auto-discovered trend";
  const sources = Array.isArray(research.sources) ? research.sources : [];
  const elements = Array.isArray(research.viralElements) ? research.viralElements : [];
  const briefRows = await supabaseRequest(env, "research_briefs", {
    method: "POST",
    body: JSON.stringify([{
      user_id: userId,
      topic,
      persona: research.persona || "Viral OS",
      summary: research.summary || "",
      source_count: sources.length,
      trend_category: research.trendCategory || research.selectedTrend?.category || null,
      selected_trend: research.selectedTrend || {},
      viral_elements: elements,
      metadata: {
        tavilySource: research.tavilySource || null,
        autoDiscovered: Boolean(research.autoDiscovered)
      }
    }])
  });
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief?.id) return research;

  if (sources.length) {
    await supabaseRequest(env, "research_sources", {
      method: "POST",
      body: JSON.stringify(sources.slice(0, 20).map((source) => sourceRow(source, brief.id)))
    });
  }

  if (elements.length) {
    await supabaseRequest(env, "viral_elements", {
      method: "POST",
      body: JSON.stringify(elements.slice(0, 24).map((element) => elementRow(element, brief.id)))
    });
  }

  return { ...research, briefId: brief.id };
}

export async function handleResearchWithCompatiblePersistence(request, env, ctx, worker, upstreamEnv = env) {
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
    console.error("compatible research persistence failed", error);
    return json({
      ...data,
      success: false,
      error: {
        code: "research_persistence_failed",
        message: "Research completed, but Supabase persistence failed.",
        details: String(error?.message || error)
      }
    }, env, request, 500);
  }
}
