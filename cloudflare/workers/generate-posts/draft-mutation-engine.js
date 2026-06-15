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

function clientDraft(row) {
  const detail = row.score_detail || {};
  return {
    id: row.id,
    title: detail.title || row.category || "Threads draft",
    hook: detail.hook || "",
    body: detail.body || row.text,
    cta: detail.cta || "",
    emotionalTrigger: detail.emotionalTrigger || row.hook_type || "empathy",
    viralScore: detail.viralScore || { total: row.score_total || 0 },
    text: row.text,
    status: row.status,
    category: row.category,
    hookType: row.hook_type,
    score: row.score_total,
    scoreTotal: row.score_total || 0,
    totalScore: Number(detail.totalScore || row.score_total || 0),
    scoreDetail: detail,
    sourceTrace: row.source_trace || []
  };
}

export async function handleUpdateDraft(request, env, draftId) {
  if (!hasSupabase(env)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), env, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  if (!isUuid(draftId)) return json(apiError("invalid_draft_id", "A valid draft id is required."), env, request, 400);

  const body = await request.json().catch(() => ({}));
  const update = {};
  if (typeof body.text === "string") update.text = body.text.slice(0, 2000);
  if (typeof body.status === "string") update.status = body.status;
  if (typeof body.scheduledAt === "string") update.scheduled_at = body.scheduledAt;
  if (!Object.keys(update).length) return json(apiError("empty_update", "No supported draft fields were provided."), env, request, 400);

  const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(update)
  });
  const draft = Array.isArray(rows) ? rows[0] : null;
  if (!draft) return json(apiError("draft_not_found", "Draft was not found for this user."), env, request, 404);
  return json({ success: true, draft: clientDraft(draft) }, env, request);
}

export async function handlePublishPlaceholder(request, env) {
  return json(apiError("publishing_disabled", "Threads publishing is intentionally disabled in this milestone."), env, request, 501);
}
