import { corsHeaders } from "./trend-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function hasSupabase(env) {
  return Boolean((env.SUPABASE_URL || env.SUPABASE_REST_URL || env.SUPABASE_PROJECT_REF) && env.SUPABASE_SERVICE_ROLE_KEY);
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

class SupabasePersistenceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SupabasePersistenceError";
    this.details = details;
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSupabaseRestBaseUrl(env) {
  const configured = String(env.SUPABASE_REST_URL || env.SUPABASE_URL || "").trim();
  const projectRef = String(env.SUPABASE_PROJECT_REF || "").trim();
  let value = configured || (projectRef ? `https://${projectRef}.supabase.co` : "");
  if (!value) {
    throw new SupabasePersistenceError("Supabase URL is not configured.", {
      operation: "config",
      missing: ["SUPABASE_URL or SUPABASE_REST_URL or SUPABASE_PROJECT_REF"]
    });
  }
  if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z0-9-]+$/i.test(value)) value = `https://${value}.supabase.co`;
    else value = `https://${value}`;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new SupabasePersistenceError("Supabase URL is invalid.", {
      operation: "config",
      value: value.replace(/\/rest\/v1.*$/i, ""),
      cause: String(error?.message || error)
    });
  }
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const basePath = pathname.endsWith("/rest/v1") ? pathname : `${pathname}/rest/v1`;
  parsed.pathname = basePath.replace(/\/+/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function errorDetails(error) {
  if (error instanceof SupabasePersistenceError) return error.details;
  return { cause: String(error?.message || error) };
}

async function supabaseRequest(env, path, init = {}, operation = path) {
  if (!hasSupabase(env)) {
    throw new SupabasePersistenceError("Supabase service environment variables are not configured.", {
      operation,
      missing: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    });
  }

  const baseUrl = normalizeSupabaseRestBaseUrl(env);
  const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;
  const endpoint = new URL(url);
  let response;
  let raw = "";
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(init.headers || {})
      }
    });
    raw = await response.text();
  } catch (error) {
    throw new SupabasePersistenceError("Supabase fetch failed before an HTTP response was returned.", {
      operation,
      method: init.method || "GET",
      host: endpoint.hostname,
      path: endpoint.pathname,
      cause: String(error?.message || error)
    });
  }

  if (!response.ok) {
    const parsed = safeJsonParse(raw);
    const cloudflareCode = raw.match(/error\s+code:\s*(\d+)/i)?.[1] || raw.match(/code\s*[:=]\s*(\d+)/i)?.[1] || parsed?.code;
    throw new SupabasePersistenceError(`Supabase ${response.status} during ${operation}.`, {
      operation,
      method: init.method || "GET",
      host: endpoint.hostname,
      path: endpoint.pathname,
      status: response.status,
      statusText: response.statusText,
      cloudflareCode,
      response: parsed || raw.slice(0, 1000)
    });
  }
  return raw ? JSON.parse(raw) : null;
}

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  }, "profiles.upsert");
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
  }, "research_briefs.insert");
  const brief = Array.isArray(briefRows) ? briefRows[0] : null;
  if (!brief?.id) {
    throw new SupabasePersistenceError("Supabase research_briefs insert returned no id.", {
      operation: "research_briefs.insert",
      rowCount: Array.isArray(briefRows) ? briefRows.length : 0
    });
  }

  if (sources.length) {
    await supabaseRequest(env, "research_sources", {
      method: "POST",
      body: JSON.stringify(sources.slice(0, 20).map((source) => sourceRow(source, brief.id)))
    }, "research_sources.insert");
  }

  if (elements.length) {
    await supabaseRequest(env, "viral_elements", {
      method: "POST",
      body: JSON.stringify(elements.slice(0, 24).map((element) => elementRow(element, brief.id)))
    }, "viral_elements.insert");
  }

  return { ...research, briefId: brief.id };
}

function persistenceErrorPayload(data, error) {
  const details = errorDetails(error);
  return {
    ...data,
    success: false,
    persistence: {
      ok: false,
      failedOperation: details.operation || "unknown",
      host: details.host,
      path: details.path,
      status: details.status,
      cloudflareCode: details.cloudflareCode
    },
    error: {
      code: "research_persistence_failed",
      message: "Research completed, but Supabase persistence failed.",
      details
    }
  };
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
    const payload = persistenceErrorPayload(data, error);
    console.error("compatible research persistence failed", JSON.stringify(payload.error));
    return json(payload, env, request, 500);
  }
}
