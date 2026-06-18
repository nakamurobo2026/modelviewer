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

function diagnostic(table, operation, error) {
  return {
    table,
    operation,
    message: String(error?.message || error || "unknown error")
  };
}

function hasSupabase(env) {
  return Boolean((env.SUPABASE_URL || env.SUPABASE_REST_URL || env.SUPABASE_PROJECT_REF || env.SUPABASE_AUTH_ISSUER) && env.SUPABASE_SERVICE_ROLE_KEY);
}

function decodeAuthPayload(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function getAuthUserId(request) {
  return decodeAuthPayload(request)?.sub || null;
}

function getAuthIssuerUrl(request) {
  const issuer = decodeAuthPayload(request)?.iss;
  if (typeof issuer !== "string" || !issuer) return "";
  try {
    const parsed = new URL(issuer);
    if (!parsed.hostname.endsWith(".supabase.co")) return "";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeSupabaseRestBaseUrlValue(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = /^[a-z0-9-]+$/i.test(normalized) ? `https://${normalized}.supabase.co` : `https://${normalized}`;
  }
  const parsed = new URL(normalized);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = (pathname.endsWith("/rest/v1") ? pathname : `${pathname}/rest/v1`).replace(/\/+/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function supabaseRestBaseUrlCandidates(env) {
  const candidates = [
    env.SUPABASE_REST_URL,
    env.SUPABASE_URL,
    env.SUPABASE_AUTH_ISSUER,
    env.SUPABASE_PROJECT_REF ? `https://${String(env.SUPABASE_PROJECT_REF).trim()}.supabase.co` : ""
  ];
  const seen = new Set();
  const normalized = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const baseUrl = normalizeSupabaseRestBaseUrlValue(candidate);
    if (!baseUrl || seen.has(baseUrl)) continue;
    seen.add(baseUrl);
    normalized.push(baseUrl);
  }
  if (!normalized.length) throw new Error("Supabase URL is not configured.");
  return normalized;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function supabaseRequest(env, path, init = {}, operation = path) {
  if (!hasSupabase(env)) throw new Error("Supabase service environment variables are not configured.");
  const baseUrls = supabaseRestBaseUrlCandidates(env);
  const attemptedHosts = [];
  let lastError = null;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;
    const endpoint = new URL(url);
    attemptedHosts.push(endpoint.hostname);
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
      lastError = new Error(`${operation} fetch failed at ${endpoint.hostname}: ${String(error?.message || error)}`);
      continue;
    }

    if (!response.ok) {
      let parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch {}
      const cloudflareCode = raw.match(/error\s+code:\s*(\d+)/i)?.[1] || raw.match(/code\s*[:=]\s*(\d+)/i)?.[1] || parsed?.code;
      const message = parsed?.message || raw.slice(0, 500) || response.statusText;
      lastError = new Error(`${operation} failed: ${cloudflareCode || parsed?.code || response.status} ${message}. attemptedHosts=${attemptedHosts.join(",")}`);
      if (String(cloudflareCode) === "1016" && index < baseUrls.length - 1) continue;
      throw lastError;
    }
    return raw ? JSON.parse(raw) : null;
  }

  throw lastError || new Error(`${operation} failed. attemptedHosts=${attemptedHosts.join(",")}`);
}

function draftText(rowOrDraft) {
  const detail = rowOrDraft?.score_detail || rowOrDraft?.scoreDetail || {};
  return rowOrDraft?.text || detail.post_text || [detail.hook, detail.body, detail.cta || detail.closing_line].filter(Boolean).join("\n");
}

function clientDraft(rowOrDraft) {
  if (!rowOrDraft) return null;
  const detail = rowOrDraft.score_detail || rowOrDraft.scoreDetail || {};
  const viralScore = detail.viralScore || detail.viral_score || rowOrDraft.viralScore || { total: rowOrDraft.score_total || rowOrDraft.scoreTotal || 0 };
  const text = draftText(rowOrDraft);
  return {
    id: rowOrDraft.id,
    title: detail.title || rowOrDraft.title || rowOrDraft.category || "Threads draft",
    hook: detail.hook || rowOrDraft.hook || "",
    body: detail.body || rowOrDraft.body || text || "",
    cta: detail.cta || detail.closing_line || rowOrDraft.cta || "",
    closing_line: detail.closing_line || rowOrDraft.closing_line || "",
    closingLine: detail.closing_line || rowOrDraft.closingLine || "",
    comment_bait: detail.comment_bait || rowOrDraft.comment_bait || detail.commentHook || "",
    commentBait: detail.comment_bait || rowOrDraft.commentBait || detail.commentHook || "",
    post_text: detail.post_text || rowOrDraft.post_text || rowOrDraft.postText || text,
    postText: detail.post_text || rowOrDraft.postText || text,
    emotionalTrigger: detail.emotionalTrigger || detail.emotional_trigger || rowOrDraft.hook_type || rowOrDraft.emotionalTrigger || "empathy",
    viralScore,
    text,
    status: rowOrDraft.status,
    category: rowOrDraft.category,
    hookType: rowOrDraft.hook_type,
    score: rowOrDraft.score_total,
    scoreTotal: rowOrDraft.score_total || rowOrDraft.scoreTotal || 0,
    totalScore: Number(detail.totalScore || rowOrDraft.totalScore || rowOrDraft.score_total || rowOrDraft.scoreTotal || 0),
    scoreDetail: detail,
    sourceTrace: rowOrDraft.source_trace || rowOrDraft.sourceTrace || [],
    createdAt: rowOrDraft.created_at,
    updatedAt: rowOrDraft.updated_at
  };
}

function clientScheduledPost(row) {
  const draft = clientDraft(row?.draft || row?.post_drafts || row?.draft_id);
  return {
    id: row.id,
    draftId: row.draft_id || draft?.id || "",
    scheduledAt: row.scheduled_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    draft
  };
}

async function loadDraftForUser(env, draftId, userId) {
  if (!isUuid(draftId)) return null;
  const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" }, "post_drafts.select_for_schedule");
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadDraftsByIdsForUser(env, draftIds, userId) {
  const ids = [...new Set((draftIds || []).filter(isUuid))];
  if (!ids.length) return new Map();
  const rows = await supabaseRequest(env, `post_drafts?user_id=eq.${encodeURIComponent(userId)}&id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`, { method: "GET" }, "post_drafts.select_schedule_ids");
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]));
}

async function hasApprovalRow(env, draftId) {
  const rows = await supabaseRequest(env, `approval_queue?draft_id=eq.${encodeURIComponent(draftId)}&status=eq.approved&select=id`, { method: "GET" }, "approval_queue.verify_approved");
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureDraftApproved(env, draft) {
  if (draft?.status === "approved" || draft?.status === "scheduled") return true;
  try {
    return await hasApprovalRow(env, draft.id);
  } catch (error) {
    console.error("approval verification failed; falling back to draft status", error);
    return draft?.status === "approved" || draft?.status === "scheduled";
  }
}

async function saveSchedule(env, draftId, scheduledAt) {
  const existingRows = await supabaseRequest(env, `scheduled_posts?draft_id=eq.${encodeURIComponent(draftId)}&status=eq.scheduled&select=*`, { method: "GET" }, "scheduled_posts.select_existing");
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;
  if (existing?.id) {
    const rows = await supabaseRequest(env, `scheduled_posts?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_at: scheduledAt, status: "scheduled" })
    }, "scheduled_posts.patch_existing");
    return Array.isArray(rows) ? rows[0] : null;
  }
  const rows = await supabaseRequest(env, "scheduled_posts", {
    method: "POST",
    body: JSON.stringify([{ draft_id: draftId, scheduled_at: scheduledAt, status: "scheduled" }])
  }, "scheduled_posts.insert");
  return Array.isArray(rows) ? rows[0] : null;
}

export async function handleCreateSchedule(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured.", diagnostic("scheduled_posts", "config", "Missing Supabase env")), persistenceEnv, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = String(body.draftId || "").trim();
    const scheduledAt = String(body.scheduledAt || "").trim();
    if (!draftId) return json(apiError("missing_draft_id", "draftId is required."), persistenceEnv, request, 400);
    if (!scheduledAt) return json(apiError("missing_scheduled_at", "scheduledAt is required."), persistenceEnv, request, 400);
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) return json(apiError("invalid_scheduled_at", "scheduledAt must be a valid datetime."), persistenceEnv, request, 400);

    const draft = await loadDraftForUser(persistenceEnv, draftId, userId);
    if (!draft) return json(apiError("draft_not_found", "Draft was not found for this user.", diagnostic("post_drafts", "post_drafts.select_for_schedule", "No row matched draftId and user")), persistenceEnv, request, 404);
    const approved = await ensureDraftApproved(persistenceEnv, draft);
    if (!approved) return json(apiError("draft_not_approved", "Only approved drafts can be scheduled.", diagnostic("approval_queue", "approval_queue.verify_approved", "Draft is not approved")), persistenceEnv, request, 409);

    const scheduled = await saveSchedule(persistenceEnv, draftId, scheduledDate.toISOString());
    if (!scheduled?.id) return json(apiError("schedule_insert_empty", "Schedule insert returned no row.", diagnostic("scheduled_posts", "scheduled_posts.insert", "No scheduled row returned")), persistenceEnv, request, 500);

    await supabaseRequest(persistenceEnv, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "scheduled" })
    }, "post_drafts.patch_scheduled_status");

    return json({ success: true, scheduledPost: clientScheduledPost({ ...scheduled, draft: { ...draft, status: "scheduled" } }) }, persistenceEnv, request);
  } catch (error) {
    console.error("schedule create failed", error);
    return json(apiError("schedule_create_failed", "Schedule could not be created.", diagnostic("scheduled_posts", "scheduled_posts.insert", error)), persistenceEnv, request, 500);
  }
}

export async function handleListSchedule(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json({ success: true, scheduledPosts: [] }, persistenceEnv, request);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);
  try {
    const rows = await supabaseRequest(persistenceEnv, "scheduled_posts?select=*&order=scheduled_at.asc&limit=100", { method: "GET" }, "scheduled_posts.select_plain");
    const scheduledRows = Array.isArray(rows) ? rows : [];
    const draftsById = await loadDraftsByIdsForUser(persistenceEnv, scheduledRows.map((row) => row.draft_id), userId);
    const scheduledPosts = scheduledRows
      .map((row) => clientScheduledPost({ ...row, draft: draftsById.get(row.draft_id) || null }))
      .filter((post) => post.draft);
    return json({ success: true, scheduledPosts }, persistenceEnv, request);
  } catch (error) {
    console.error("schedule list failed", error);
    return json(apiError("schedule_list_failed", "Schedule could not be loaded.", diagnostic("scheduled_posts", "scheduled_posts.select_plain", error)), persistenceEnv, request, 500);
  }
}

export async function handleDeleteSchedule(request, env, id) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured.", diagnostic("scheduled_posts", "config", "Missing Supabase env")), persistenceEnv, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);
  if (!isUuid(id)) return json(apiError("invalid_schedule_id", "A valid schedule id is required."), persistenceEnv, request, 400);
  try {
    const rows = await supabaseRequest(persistenceEnv, `scheduled_posts?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" }, "scheduled_posts.select_delete_target");
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(apiError("schedule_not_found", "Scheduled post was not found.", diagnostic("scheduled_posts", "scheduled_posts.select_delete_target", "No scheduled row matched id")), persistenceEnv, request, 404);
    const draft = await loadDraftForUser(persistenceEnv, row.draft_id, userId);
    if (!draft) return json(apiError("schedule_not_found", "Scheduled post was not found for this user.", diagnostic("post_drafts", "post_drafts.select_for_schedule", "Scheduled draft does not belong to user")), persistenceEnv, request, 404);
    const updated = await supabaseRequest(persistenceEnv, `scheduled_posts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" })
    }, "scheduled_posts.patch_cancelled");
    await supabaseRequest(persistenceEnv, `post_drafts?id=eq.${encodeURIComponent(row.draft_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" })
    }, "post_drafts.patch_back_to_approved");
    const scheduled = Array.isArray(updated) ? updated[0] : row;
    return json({ success: true, scheduledPost: clientScheduledPost({ ...scheduled, draft: { ...draft, status: "approved" } }) }, persistenceEnv, request);
  } catch (error) {
    console.error("schedule delete failed", error);
    return json(apiError("schedule_delete_failed", "Scheduled post could not be cancelled.", diagnostic("scheduled_posts", "scheduled_posts.patch_cancelled", error)), persistenceEnv, request, 500);
  }
}
