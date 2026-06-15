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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
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

function clientDraft(rowOrDraft) {
  if (!rowOrDraft) return null;
  const detail = rowOrDraft.score_detail || rowOrDraft.scoreDetail || {};
  const viralScore = detail.viralScore || detail.viral_score || rowOrDraft.viralScore || { total: rowOrDraft.score_total || rowOrDraft.scoreTotal || 0 };
  return {
    id: rowOrDraft.id,
    title: detail.title || rowOrDraft.title || rowOrDraft.category || "Threads draft",
    hook: detail.hook || rowOrDraft.hook || "",
    body: detail.body || rowOrDraft.body || rowOrDraft.text || "",
    cta: detail.cta || rowOrDraft.cta || "",
    emotionalTrigger: detail.emotionalTrigger || rowOrDraft.hook_type || rowOrDraft.emotionalTrigger || "empathy",
    viralScore,
    text: rowOrDraft.text || [detail.hook, detail.body, detail.cta].filter(Boolean).join("\n"),
    status: rowOrDraft.status,
    category: rowOrDraft.category,
    hookType: rowOrDraft.hook_type,
    score: rowOrDraft.score_total,
    scoreTotal: rowOrDraft.score_total || rowOrDraft.scoreTotal || 0,
    totalScore: Number(detail.totalScore || rowOrDraft.totalScore || rowOrDraft.score_total || rowOrDraft.scoreTotal || 0),
    scoreDetail: detail,
    sourceTrace: rowOrDraft.source_trace || rowOrDraft.sourceTrace || []
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
  const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" });
  return Array.isArray(rows) ? rows[0] : null;
}

async function ensureDraftApproved(env, draftId) {
  const rows = await supabaseRequest(env, `approval_queue?draft_id=eq.${encodeURIComponent(draftId)}&status=eq.approved&select=id`, { method: "GET" });
  return Array.isArray(rows) && rows.length > 0;
}

export async function handleCreateSchedule(request, env) {
  if (!hasSupabase(env)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), env, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  const body = await request.json().catch(() => ({}));
  const draftId = String(body.draftId || "").trim();
  const scheduledAt = String(body.scheduledAt || "").trim();
  if (!draftId) return json(apiError("missing_draft_id", "draftId is required."), env, request, 400);
  if (!scheduledAt) return json(apiError("missing_scheduled_at", "scheduledAt is required."), env, request, 400);
  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return json(apiError("invalid_scheduled_at", "scheduledAt must be a valid datetime."), env, request, 400);

  const draft = await loadDraftForUser(env, draftId, userId);
  if (!draft) return json(apiError("draft_not_found", "Draft was not found for this user."), env, request, 404);
  const approved = await ensureDraftApproved(env, draftId);
  if (!approved) return json(apiError("draft_not_approved", "Only approved drafts can be scheduled."), env, request, 409);

  const rows = await supabaseRequest(env, "scheduled_posts?on_conflict=draft_id,status", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{
      draft_id: draftId,
      scheduled_at: scheduledDate.toISOString(),
      status: "scheduled"
    }])
  });
  await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "scheduled" })
  });
  const scheduled = Array.isArray(rows) ? rows[0] : null;
  return json({ success: true, scheduledPost: clientScheduledPost({ ...scheduled, draft }) }, env, request);
}

export async function handleListSchedule(request, env) {
  if (!hasSupabase(env)) return json({ success: true, scheduledPosts: [] }, env, request);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  try {
    const rows = await supabaseRequest(
      env,
      `scheduled_posts?select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=scheduled_at.asc`,
      { method: "GET" }
    );
    return json({ success: true, scheduledPosts: (rows || []).map(clientScheduledPost) }, env, request);
  } catch (error) {
    console.error("schedule list failed", error);
    return json(apiError("schedule_list_failed", "Schedule could not be loaded.", String(error)), env, request, 500);
  }
}

export async function handleDeleteSchedule(request, env, id) {
  if (!hasSupabase(env)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), env, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  if (!isUuid(id)) return json(apiError("invalid_schedule_id", "A valid schedule id is required."), env, request, 400);
  const rows = await supabaseRequest(env, `scheduled_posts?id=eq.${encodeURIComponent(id)}&select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return json(apiError("schedule_not_found", "Scheduled post was not found for this user."), env, request, 404);
  const updated = await supabaseRequest(env, `scheduled_posts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" })
  });
  if (row.draft_id) {
    await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(row.draft_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" })
    });
  }
  const scheduled = Array.isArray(updated) ? updated[0] : row;
  return json({ success: true, scheduledPost: clientScheduledPost({ ...scheduled, draft: row.draft }) }, env, request);
}
