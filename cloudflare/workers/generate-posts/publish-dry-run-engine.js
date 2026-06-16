import { corsHeaders } from "./trend-engine.js";

const THREADS_FRIENDLY_LIMIT = 500;

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

function cleanLine(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[{}[\]"]+/g, "")
    .replace(/\b(score|scoreDetail|viralScore|totalScore|hookScore|commentScore|saveScore|shareScore)\b\s*:?\s*\d*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHashtagsUnlessExplicit(text, draft) {
  const explicit = draft?.score_detail?.allowHashtags === true || draft?.allowHashtags === true;
  if (explicit) return text;
  return text.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]+\n/g, "\n").trim();
}

function dedupeLines(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (!line || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildThreadsPost(draft) {
  const detail = draft?.score_detail || draft?.scoreDetail || {};
  const hook = cleanLine(detail.hook || draft?.hook || "");
  const body = cleanLine(detail.body || draft?.body || draft?.text || "");
  const cta = cleanLine(detail.cta || draft?.cta || "");
  const lines = dedupeLines([hook, body, cta]).filter((line) => !/^\s*(title|category|status|score)\s*:/i.test(line));
  let text = lines.join("\n\n").trim();
  text = stripHashtagsUnlessExplicit(text, draft);
  return text;
}

function validatePreview(text, scheduledPost, draft) {
  const warnings = [];
  if (!scheduledPost?.id) warnings.push("scheduledPostId is missing.");
  if (!draft?.id) warnings.push("draftId is missing.");
  if (!text) warnings.push("Final Threads text is empty.");
  if (text.length > THREADS_FRIENDLY_LIMIT) warnings.push(`Text is ${text.length} chars. Keep it under ${THREADS_FRIENDLY_LIMIT} for Threads-friendly posting.`);
  if (/\{\s*"|"\s*:|scoreDetail|viralScore|totalScore/.test(text)) warnings.push("Text may contain JSON or internal scoring artifacts.");
  if (/(^|\s)#[\p{L}\p{N}_]+/u.test(text)) warnings.push("Hashtags were detected. Viral OS avoids hashtags unless explicitly requested.");
  if (scheduledPost?.status !== "scheduled") warnings.push(`Scheduled post status is ${scheduledPost?.status || "unknown"}, not scheduled.`);
  return warnings;
}

export async function handlePublishDryRun(request, env) {
  if (!hasSupabase(env)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), env, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);

  const body = await request.json().catch(() => ({}));
  const scheduledPostId = String(body.scheduledPostId || body.scheduled_post_id || "").trim();
  if (!isUuid(scheduledPostId)) return json(apiError("invalid_scheduled_post_id", "scheduledPostId must be a valid scheduled post id."), env, request, 400);

  try {
    const rows = await supabaseRequest(
      env,
      `scheduled_posts?id=eq.${encodeURIComponent(scheduledPostId)}&select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}`,
      { method: "GET" }
    );
    const scheduledPost = Array.isArray(rows) ? rows[0] : null;
    if (!scheduledPost) return json(apiError("schedule_not_found", "Scheduled post was not found for this user."), env, request, 404);
    const draft = scheduledPost.draft || scheduledPost.post_drafts;
    if (!draft) return json(apiError("draft_not_found", "Scheduled post has no related draft."), env, request, 404);

    const text = buildThreadsPost(draft);
    const warnings = validatePreview(text, scheduledPost, draft);
    return json({
      ok: true,
      success: true,
      platform: "threads",
      dryRun: true,
      text,
      length: text.length,
      scheduledPostId: scheduledPost.id,
      draftId: draft.id,
      warnings
    }, env, request);
  } catch (error) {
    console.error("publish dry run failed", error);
    return json(apiError("publish_dry_run_failed", "Could not build publish dry-run preview.", String(error?.message || error)), env, request, 500);
  }
}
