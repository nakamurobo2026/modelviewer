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

function errorDetails(error) {
  return String(error?.message || error || "unknown error");
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
      lastError = new Error(`${operation} fetch failed at ${endpoint.hostname}: ${errorDetails(error)}`);
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

async function safeSupabaseRequest(env, path, init, operation, fallback = []) {
  try {
    const result = await supabaseRequest(env, path, init, operation);
    return { ok: true, data: Array.isArray(result) ? result : fallback, error: null };
  } catch (error) {
    console.error(`${operation} failed but dashboard will continue`, error);
    return { ok: false, data: fallback, error: errorDetails(error) };
  }
}

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  try {
    await supabaseRequest(env, "profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
    }, "profiles.upsert");
  } catch (error) {
    console.error("profiles.upsert failed but dashboard will continue", error);
  }
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
    commentHook: detail.commentHook || rowOrDraft.commentHook || "",
    saveReason: detail.saveReason || rowOrDraft.saveReason || "",
    shareReason: detail.shareReason || rowOrDraft.shareReason || "",
    targetAudience: detail.targetAudience || rowOrDraft.targetAudience || "",
    expectedComments: Number(detail.expectedComments || rowOrDraft.expectedComments || 0),
    expectedSaveRate: Number(detail.expectedSaveRate || rowOrDraft.expectedSaveRate || 0),
    expectedEngagement: Number(detail.expectedEngagement || rowOrDraft.expectedEngagement || 0),
    hookScore: Number(detail.hookScore || rowOrDraft.hookScore || 0),
    commentScore: Number(detail.commentScore || rowOrDraft.commentScore || 0),
    saveScore: Number(detail.saveScore || rowOrDraft.saveScore || 0),
    shareScore: Number(detail.shareScore || rowOrDraft.shareScore || 0),
    noveltyScore: Number(detail.noveltyScore || rowOrDraft.noveltyScore || 0),
    clarityScore: Number(detail.clarityScore || rowOrDraft.clarityScore || 0),
    emotionScore: Number(detail.emotionScore || rowOrDraft.emotionScore || 0),
    totalScore: Number(detail.totalScore || rowOrDraft.totalScore || rowOrDraft.score_total || rowOrDraft.scoreTotal || 0),
    isWinner: Boolean(detail.isWinner || rowOrDraft.isWinner),
    winnerReason: detail.winnerReason || rowOrDraft.winnerReason || "",
    weakness: detail.weakness || rowOrDraft.weakness || "",
    improvementSuggestion: detail.improvementSuggestion || rowOrDraft.improvementSuggestion || "",
    bestCommentBait: detail.bestCommentBait || detail.commentHook || rowOrDraft.bestCommentBait || "",
    riskNote: detail.riskNote || rowOrDraft.riskNote || "",
    text,
    status: rowOrDraft.status,
    category: rowOrDraft.category,
    hookType: rowOrDraft.hook_type,
    score: rowOrDraft.score_total,
    scoreTotal: rowOrDraft.score_total || rowOrDraft.scoreTotal || 0,
    scoreDetail: detail,
    sourceTrace: rowOrDraft.source_trace || rowOrDraft.sourceTrace || [],
    scheduledAt: rowOrDraft.scheduled_at,
    publishedAt: rowOrDraft.published_at,
    failureReason: rowOrDraft.failure_reason,
    createdAt: rowOrDraft.created_at,
    updatedAt: rowOrDraft.updated_at
  };
}

function clientApproval(row) {
  const draft = clientDraft(row?.draft || row?.post_drafts || row?.draft_id);
  return {
    id: row.id,
    draftId: row.draft_id || draft?.id || "",
    status: row.status,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    draft
  };
}

function fallbackApprovalFromDraft(draft) {
  return {
    id: `approved-draft-${draft.id}`,
    draftId: draft.id,
    status: "approved",
    approvedAt: draft.updatedAt || draft.publishedAt || new Date().toISOString(),
    rejectedAt: null,
    notes: "",
    createdAt: draft.createdAt || draft.updatedAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || new Date().toISOString(),
    draft
  };
}

function mergeApprovalFallbacks(approvals, drafts) {
  const existingDraftIds = new Set(approvals.map((approval) => approval.draftId).filter(Boolean));
  const fallbackApprovals = drafts
    .filter((draft) => draft.status === "approved" && !existingDraftIds.has(draft.id))
    .map(fallbackApprovalFromDraft);
  return [...approvals, ...fallbackApprovals];
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

async function loadDraftsByIdsForUser(env, draftIds, userId) {
  const ids = [...new Set((draftIds || []).filter(isUuid))];
  if (!ids.length) return new Map();
  const result = await safeSupabaseRequest(
    env,
    `post_drafts?user_id=eq.${encodeURIComponent(userId)}&id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`,
    { method: "GET" },
    "post_drafts.select_by_ids",
    []
  );
  return new Map(result.data.map((row) => [row.id, row]));
}

async function loadApprovalsForUser(env, userId) {
  const rows = await safeSupabaseRequest(
    env,
    "approval_queue?select=*&order=approved_at.desc.nullslast,created_at.desc&limit=100",
    { method: "GET" },
    "approval_queue.dashboard_plain",
    []
  );
  const draftsById = await loadDraftsByIdsForUser(env, rows.data.map((row) => row.draft_id), userId);
  return rows.data
    .map((row) => clientApproval({ ...row, draft: draftsById.get(row.draft_id) || null }))
    .filter((approval) => approval.draft);
}

async function loadScheduledPostsForUser(env, userId) {
  const rows = await safeSupabaseRequest(
    env,
    "scheduled_posts?select=*&order=scheduled_at.asc&limit=100",
    { method: "GET" },
    "scheduled_posts.dashboard_plain",
    []
  );
  const draftsById = await loadDraftsByIdsForUser(env, rows.data.map((row) => row.draft_id), userId);
  return rows.data
    .map((row) => clientScheduledPost({ ...row, draft: draftsById.get(row.draft_id) || null }))
    .filter((post) => post.draft);
}

export async function handleDashboardWithSchedule(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  const userId = getAuthUserId(request);

  if (!hasSupabase(persistenceEnv)) {
    return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), persistenceEnv, request, 500);
  }
  if (!userId) {
    return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);
  }

  await ensureProfile(persistenceEnv, userId);

  const draftRowsResult = await safeSupabaseRequest(
    persistenceEnv,
    `post_drafts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`,
    { method: "GET" },
    "post_drafts.dashboard",
    []
  );
  const draftRows = draftRowsResult.data;
  const drafts = draftRows.map(clientDraft).filter(Boolean);

  const [persistedApprovals, scheduledPosts, briefRowsResult, auditRowsResult] = await Promise.all([
    loadApprovalsForUser(persistenceEnv, userId).catch((error) => {
      console.error("approval queue dashboard load failed; falling back to approved drafts", error);
      return [];
    }),
    loadScheduledPostsForUser(persistenceEnv, userId).catch((error) => {
      console.error("scheduled posts dashboard load failed", error);
      return [];
    }),
    safeSupabaseRequest(
      persistenceEnv,
      `research_briefs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`,
      { method: "GET" },
      "research_briefs.dashboard",
      []
    ),
    safeSupabaseRequest(
      persistenceEnv,
      `audit_events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`,
      { method: "GET" },
      "audit_events.dashboard_optional",
      []
    )
  ]);

  const approvals = mergeApprovalFallbacks(persistedApprovals, drafts);
  const approvedDraftIds = new Set(approvals.filter((approval) => approval.status === "approved").map((approval) => approval.draftId));
  const rejectedDraftIds = new Set(approvals.filter((approval) => approval.status === "rejected").map((approval) => approval.draftId));
  const totalDrafts = drafts.length;
  const approvedDrafts = approvals.filter((approval) => approval.status === "approved").length;
  const rejectedDrafts = approvals.filter((approval) => approval.status === "rejected").length;
  const scheduledPostCount = scheduledPosts.filter((post) => post.status === "scheduled").length;
  const publishedPostCount = scheduledPosts.filter((post) => post.status === "published").length + drafts.filter((draft) => draft.status === "published").length;
  const awaitingApproval = drafts.filter((draft) => !approvedDraftIds.has(draft.id) && !rejectedDraftIds.has(draft.id) && (draft.status === "scored" || draft.status === "draft")).length;
  const failed = scheduledPosts.filter((post) => post.status === "failed").length + drafts.filter((draft) => draft.status === "failed").length;
  const averageScore = drafts.length ? Math.round(drafts.reduce((sum, draft) => sum + (draft.totalScore || draft.scoreTotal || draft.score || 0), 0) / drafts.length) : 0;
  const dashboardWarnings = [
    !draftRowsResult.ok ? { operation: "post_drafts.dashboard", message: draftRowsResult.error } : null,
    !briefRowsResult.ok ? { operation: "research_briefs.dashboard", message: briefRowsResult.error } : null,
    !auditRowsResult.ok ? { operation: "audit_events.dashboard_optional", message: auditRowsResult.error } : null
  ].filter(Boolean);

  return json({
    ok: true,
    researchCount: briefRowsResult.data.length,
    draftCount: totalDrafts,
    queueCount: approvedDrafts,
    success: true,
    warnings: dashboardWarnings,
    profile: {
      id: userId,
      displayName: "Viral OS Operator",
      threadsConnected: Boolean(persistenceEnv.THREADS_ACCESS_TOKEN)
    },
    drafts,
    approvalQueue: approvals.filter((approval) => approval.status === "approved"),
    scheduledPosts,
    researchBriefs: briefRowsResult.data.map((brief) => ({
      id: brief.id,
      topic: brief.topic,
      summary: brief.summary,
      sourceCount: brief.source_count || 0,
      createdAt: brief.created_at
    })),
    publishJobs: scheduledPosts.map((post) => ({
      id: post.id,
      draftId: post.draftId,
      status: post.status,
      scheduledAt: post.scheduledAt,
      attemptCount: 0
    })),
    auditEvents: auditRowsResult.data.map((event) => ({
      id: event.id,
      entityType: event.entity_type,
      entityId: event.entity_id,
      action: event.action,
      metadata: event.metadata || {},
      createdAt: event.created_at
    })),
    metrics: {
      totalDrafts,
      approvedDrafts,
      rejectedDrafts,
      scheduledPosts: scheduledPostCount,
      publishedPosts: publishedPostCount,
      awaitingApproval,
      scheduled: scheduledPostCount,
      failed,
      published: publishedPostCount,
      averageScore,
      sourceBackedDrafts: drafts.filter((draft) => draft.sourceTrace?.length).length
    }
  }, persistenceEnv, request);
}
