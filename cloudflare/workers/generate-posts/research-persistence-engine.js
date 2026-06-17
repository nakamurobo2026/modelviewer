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

function isSchemaMismatch(error) {
  const details = errorDetails(error);
  const body = typeof details.response === "string" ? details.response : JSON.stringify(details.response || {});
  return /PGRST204|column|schema cache|Could not find|does not exist/i.test(body);
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

async function ensureProfile(env, userId, report) {
  if (!userId || !hasSupabase(env)) return;
  try {
    await supabaseRequest(env, "profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
    }, "profiles.upsert");
    report.tables.profiles = { ok: true, operation: "profiles.upsert" };
  } catch (error) {
    report.tables.profiles = { ok: false, operation: "profiles.upsert", error: errorDetails(error) };
    throw error;
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safePriority(value) {
  return ["S", "A", "B", "C"].includes(String(value || "").toUpperCase()) ? String(value).toUpperCase() : "C";
}

function safeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null).map((item) => String(item).slice(0, 240));
  if (value === undefined || value === null || value === "") return [];
  return [String(value).slice(0, 240)];
}

function safeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function sourceRow(source, briefId, linkColumn = "research_brief_id") {
  const row = {
    [linkColumn]: briefId,
    source_type: String(source?.sourceType || source?.source_type || "web").slice(0, 80),
    priority: safePriority(source?.priority),
    weight: safeNumber(source?.weight, 0.3),
    url: source?.url ? String(source.url).slice(0, 1000) : null,
    title: source?.title ? String(source.title).slice(0, 500) : null,
    summary: source?.summary || source?.content ? String(source.summary || source.content).slice(0, 2000) : null,
    content: source?.content || source?.summary ? String(source.content || source.summary).slice(0, 5000) : null,
    reliability: safeNumber(source?.reliability, 0),
    impact: safeNumber(source?.impact ?? source?.relevance, 0),
    relevance: safeNumber(source?.relevance ?? source?.impact, 0),
    extracted_elements: safeArray(source?.extractedElements || source?.buzzElements),
    metadata: {
      ...safeObject(source?.metadata),
      reason: source?.reason || null,
      index: source?.index ?? null
    }
  };
  return row;
}

function elementRow(element, briefId, linkColumn = "research_brief_id") {
  return {
    [linkColumn]: briefId,
    element_type: String(element?.elementType || element?.element_type || "angle").slice(0, 80),
    value: String(element?.value || "").slice(0, 240) || "observation angle",
    score: safeNumber(element?.score, 0),
    metadata: safeObject(element?.metadata)
  };
}

async function insertRowsWithFallback(env, table, rows, report, options = {}) {
  const { operation = `${table}.insert`, fallbackRows } = options;
  if (!rows.length) {
    report.tables[table] = { ok: true, operation, inserted: 0, skipped: 0 };
    return [];
  }

  try {
    const inserted = await supabaseRequest(env, table, {
      method: "POST",
      body: JSON.stringify(rows)
    }, operation);
    report.tables[table] = { ok: true, operation, inserted: Array.isArray(inserted) ? inserted.length : rows.length, skipped: 0 };
    return Array.isArray(inserted) ? inserted : [];
  } catch (bulkError) {
    if (fallbackRows && isSchemaMismatch(bulkError)) {
      try {
        const inserted = await supabaseRequest(env, table, {
          method: "POST",
          body: JSON.stringify(fallbackRows)
        }, `${operation}.fallback`);
        report.tables[table] = { ok: true, operation: `${operation}.fallback`, inserted: Array.isArray(inserted) ? inserted.length : fallbackRows.length, skipped: 0 };
        return Array.isArray(inserted) ? inserted : [];
      } catch (fallbackError) {
        report.tableErrors.push({ table, operation: `${operation}.fallback`, error: errorDetails(fallbackError) });
      }
    }

    const inserted = [];
    const errors = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const fallbackRow = fallbackRows?.[index];
      try {
        const single = await supabaseRequest(env, table, {
          method: "POST",
          body: JSON.stringify([row])
        }, `${operation}.row.${index}`);
        if (Array.isArray(single)) inserted.push(...single);
      } catch (rowError) {
        if (fallbackRow && isSchemaMismatch(rowError)) {
          try {
            const single = await supabaseRequest(env, table, {
              method: "POST",
              body: JSON.stringify([fallbackRow])
            }, `${operation}.row.${index}.fallback`);
            if (Array.isArray(single)) inserted.push(...single);
            continue;
          } catch (fallbackRowError) {
            errors.push({ index, error: errorDetails(fallbackRowError) });
            continue;
          }
        }
        errors.push({ index, error: errorDetails(rowError) });
      }
    }
    report.tables[table] = { ok: errors.length === 0, operation, inserted: inserted.length, skipped: errors.length, errors };
    if (errors.length) report.tableErrors.push({ table, operation, errors });
    return inserted;
  }
}

async function persistResearchResponse(env, request, research) {
  const userId = getAuthUserId(request);
  if (!hasSupabase(env) || !userId || !research?.success) return research;

  const report = { ok: true, partial_success: false, tables: {}, tableErrors: [] };
  await ensureProfile(env, userId, report);
  const topic = String(research.topic || research.selectedTrend?.keyword || "auto-discovered trend").slice(0, 500);
  const sources = Array.isArray(research.sources) ? research.sources : [];
  const elements = Array.isArray(research.viralElements) ? research.viralElements : [];
  const briefRows = await supabaseRequest(env, "research_briefs", {
    method: "POST",
    body: JSON.stringify([{
      user_id: userId,
      topic,
      persona: String(research.persona || "Viral OS").slice(0, 120),
      summary: String(research.summary || "").slice(0, 5000),
      source_count: sources.length,
      trend_category: research.trendCategory || research.selectedTrend?.category || null,
      selected_trend: safeObject(research.selectedTrend),
      viral_elements: elements.map((element) => safeObject(element).value ? element : safeObject(element)),
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
  report.tables.research_briefs = { ok: true, operation: "research_briefs.insert", inserted: 1, id: brief.id };

  const sourceRows = sources.slice(0, 20).map((source) => sourceRow(source, brief.id, "research_brief_id"));
  const sourceFallbackRows = sources.slice(0, 20).map((source) => sourceRow(source, brief.id, "brief_id"));
  await insertRowsWithFallback(env, "research_sources", sourceRows, report, {
    operation: "research_sources.insert",
    fallbackRows: sourceFallbackRows
  });

  const elementRows = elements.slice(0, 24).map((element) => elementRow(element, brief.id, "research_brief_id"));
  const elementFallbackRows = elements.slice(0, 24).map((element) => elementRow(element, brief.id, "brief_id"));
  await insertRowsWithFallback(env, "viral_elements", elementRows, report, {
    operation: "viral_elements.insert",
    fallbackRows: elementFallbackRows
  });

  report.partial_success = report.tableErrors.length > 0;
  report.ok = !report.partial_success;
  return { ...research, briefId: brief.id, persistence: report, partial_success: report.partial_success };
}

function persistenceErrorPayload(data, error) {
  const details = errorDetails(error);
  return {
    ...data,
    success: false,
    persistence: {
      ok: false,
      partial_success: false,
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
    const persisted = await persistResearchResponse(env, request, data);
    const status = persisted.partial_success ? 207 : upstream.status;
    return json(persisted, env, request, status);
  } catch (error) {
    const payload = persistenceErrorPayload(data, error);
    console.error("compatible research persistence failed", JSON.stringify(payload.error));
    return json(payload, env, request, 500);
  }
}
