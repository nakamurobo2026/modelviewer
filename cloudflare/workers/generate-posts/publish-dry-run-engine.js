import { corsHeaders } from "./trend-engine.js";

const THREADS_MAX_LENGTH = 500;
const PREFERRED_MIN_LENGTH = 80;
const PREFERRED_MAX_LENGTH = 220;

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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
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

function cleanLine(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[{}\[\]"]+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO/gi, "")
    .replace(/\b(score|scoreDetail|viralScore|totalScore|hookScore|commentScore|saveScore|shareScore|research_summary|sources|source_ids|reasoning|reliability)\b\s*:?\s*\d*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHashtagsUnlessExplicit(text, draft) {
  const explicit = draft?.score_detail?.allowHashtags === true || draft?.scoreDetail?.allowHashtags === true || draft?.allowHashtags === true;
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

function publicPostText(draft, detail) {
  return cleanLine(
    detail.post_text ||
    detail.postText ||
    draft?.post_text ||
    draft?.postText ||
    draft?.text ||
    ""
  );
}

function draftGenre(draft) {
  const detail = draft?.score_detail || draft?.scoreDetail || {};
  return detail.genre || draft?.genre || draft?.hook_type || draft?.hookType || detail.emotional_trigger || detail.emotionalTrigger || "unknown";
}

export function buildThreadsPost(draft) {
  const detail = draft?.score_detail || draft?.scoreDetail || {};
  const directPostText = publicPostText(draft, detail);
  if (directPostText) return stripHashtagsUnlessExplicit(directPostText, draft);

  const hook = cleanLine(detail.hook || draft?.hook || "");
  const body = cleanLine(detail.body || draft?.body || "");
  const closing = cleanLine(detail.closing_line || detail.cta || draft?.closing_line || draft?.closingLine || draft?.cta || "");
  const lines = dedupeLines([hook, body, closing]).filter((line) => !/^\s*(title|category|status|score|source|research|reliability)\s*:/i.test(line));
  return stripHashtagsUnlessExplicit(lines.join("\n\n").trim(), draft);
}

function validatePreview(text, scheduledPost, draft) {
  const warnings = [];
  if (!scheduledPost?.id) warnings.push("scheduledPostId is missing.");
  if (!draft?.id) warnings.push("draftId is missing.");
  if (!text) warnings.push("Final Threads text is empty.");
  if (text && text.length < PREFERRED_MIN_LENGTH) warnings.push(`Text is ${text.length} chars. 80-220 Japanese characters is preferred.`);
  if (text.length > PREFERRED_MAX_LENGTH) warnings.push(`Text is ${text.length} chars. 80-220 Japanese characters is preferred.`);
  if (text.length > THREADS_MAX_LENGTH) warnings.push(`Text is ${text.length} chars. Keep it under ${THREADS_MAX_LENGTH} for Threads posting.`);
  if (/https?:\/\/\S+|www\./i.test(text)) warnings.push("Text contains a URL.");
  if (/\{\s*"|"\s*:|scoreDetail|viralScore|totalScore|hookScore|commentScore|saveScore|shareScore|research_summary|sources|source_ids|reasoning|reliability/i.test(text)) warnings.push("Text may contain JSON, source IDs, research notes, or internal scoring artifacts.");
  if (/調査によると|この記事では|について解説します|出典|引用|ソース|研究|分析結果|レポート|SEO|信頼度|取得元|source|research|reliability/i.test(text)) warnings.push("Text may still read like a research report instead of a Threads post.");
  if (/^\s*(?:[-*・]|\d+[.)、])\s+/m.test(text)) warnings.push("Text contains bullet/list formatting.");
  if (/(^|\s)#[\p{L}\p{N}_]+/u.test(text)) warnings.push("Hashtags were detected. Viral OS avoids hashtags unless explicitly requested.");
  if (scheduledPost?.status !== "scheduled") warnings.push(`Scheduled post status is ${scheduledPost?.status || "unknown"}, not scheduled.`);
  return warnings;
}

function readinessFromWarnings(warnings) {
  return warnings.length === 0 ? "ready" : "needs_edit";
}

async function loadScheduledPost(env, scheduledPostId) {
  const rows = await supabaseRequest(
    env,
    `scheduled_posts?id=eq.${encodeURIComponent(scheduledPostId)}&select=*`,
    { method: "GET" },
    "scheduled_posts.publish_dry_run_select"
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadDraftForUser(env, draftId, userId) {
  if (!isUuid(draftId)) return null;
  const rows = await supabaseRequest(
    env,
    `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    { method: "GET" },
    "post_drafts.publish_dry_run_select"
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function handlePublishDryRun(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured.", diagnostic("scheduled_posts", "config", "Missing Supabase env")), persistenceEnv, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);

  const body = await request.json().catch(() => ({}));
  const scheduledPostId = String(body.scheduledPostId || body.scheduled_post_id || "").trim();
  if (!isUuid(scheduledPostId)) return json(apiError("invalid_scheduled_post_id", "scheduledPostId must be a valid scheduled post id."), persistenceEnv, request, 400);

  try {
    const scheduledPost = await loadScheduledPost(persistenceEnv, scheduledPostId);
    if (!scheduledPost) return json(apiError("schedule_not_found", "Scheduled post was not found for this user.", diagnostic("scheduled_posts", "scheduled_posts.publish_dry_run_select", "No scheduled row matched scheduledPostId")), persistenceEnv, request, 404);

    const draft = await loadDraftForUser(persistenceEnv, scheduledPost.draft_id, userId);
    if (!draft) return json(apiError("draft_not_found", "Scheduled post has no related draft for this user.", diagnostic("post_drafts", "post_drafts.publish_dry_run_select", "No draft row matched scheduled post draft_id and user")), persistenceEnv, request, 404);

    const text = buildThreadsPost(draft);
    const warnings = validatePreview(text, scheduledPost, draft);
    return json({
      ok: true,
      success: true,
      platform: "threads",
      dryRun: true,
      publishReadiness: readinessFromWarnings(warnings),
      genre: draftGenre(draft),
      scheduledPostId: scheduledPost.id,
      draftId: draft.id,
      text,
      length: text.length,
      warnings
    }, persistenceEnv, request);
  } catch (error) {
    console.error("publish dry run failed", error);
    return json(apiError("publish_dry_run_failed", "Could not build publish dry-run preview.", diagnostic("scheduled_posts", "publish_dry_run", error)), persistenceEnv, request, 500);
  }
}
