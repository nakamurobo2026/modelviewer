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

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function safeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).slice(0, 240));
  if (!value) return [];
  return [String(value).slice(0, 240)];
}

function draftText(draft) {
  if (!draft || typeof draft !== "object") return "";
  const detail = draft.score_detail || draft.scoreDetail || {};
  return String(
    draft.post_text ||
    draft.postText ||
    detail.post_text ||
    detail.postText ||
    draft.text ||
    [draft.hook || detail.hook, draft.body || detail.body, draft.closing_line || draft.closingLine || detail.closing_line || draft.cta || detail.cta]
      .filter(Boolean)
      .join("\n")
  ).trim();
}

function detailFromSnapshot(draft) {
  const existing = draft?.score_detail || draft?.scoreDetail || {};
  const text = draftText(draft);
  const trigger = draft?.emotional_trigger || draft?.emotionalTrigger || existing.emotional_trigger || existing.emotionalTrigger || draft?.hookType || "empathy";
  const total = clampScore(draft?.totalScore || existing.totalScore || draft?.scoreTotal || draft?.score || draft?.viral_score || draft?.viralScore?.total || existing.viral_score || existing.viralScore?.total || 0);
  return {
    ...existing,
    post_text: text,
    hook: draft?.hook || existing.hook || "",
    body: draft?.body || existing.body || text,
    closing_line: draft?.closing_line || draft?.closingLine || existing.closing_line || draft?.cta || existing.cta || "",
    comment_bait: draft?.comment_bait || draft?.commentBait || existing.comment_bait || existing.commentHook || draft?.commentHook || "",
    emotional_trigger: trigger,
    emotionalTrigger: trigger,
    viral_score: draft?.viral_score || draft?.viralScore?.total || existing.viral_score || existing.viralScore?.total || total,
    viralScore: draft?.viralScore || existing.viralScore || { total },
    source_ids: safeArray(draft?.source_ids || draft?.sourceIds || existing.source_ids || draft?.sourceTrace),
    totalScore: total,
    hookScore: clampScore(draft?.hookScore || existing.hookScore || total),
    commentScore: clampScore(draft?.commentScore || existing.commentScore || draft?.commentability || total),
    saveScore: clampScore(draft?.saveScore || existing.saveScore || total),
    shareScore: clampScore(draft?.shareScore || existing.shareScore || total),
    noveltyScore: clampScore(draft?.noveltyScore || existing.noveltyScore || total),
    clarityScore: clampScore(draft?.clarityScore || existing.clarityScore || total),
    emotionScore: clampScore(draft?.emotionScore || existing.emotionScore || total),
    isWinner: Boolean(draft?.isWinner || existing.isWinner),
    winnerReason: draft?.winnerReason || existing.winnerReason || "",
    weakness: draft?.weakness || existing.weakness || "",
    improvementSuggestion: draft?.improvementSuggestion || existing.improvementSuggestion || "",
    bestCommentBait: draft?.bestCommentBait || existing.bestCommentBait || draft?.commentHook || existing.commentHook || "",
    riskNote: draft?.riskNote || existing.riskNote || ""
  };
}

function draftRowFromSnapshot(snapshot, userId, draftId) {
  const detail = detailFromSnapshot(snapshot);
  const text = detail.post_text || draftText(snapshot);
  if (!text) return null;
  const row = {
    user_id: userId,
    text,
    status: "scored",
    category: snapshot?.category || "threads",
    hook_type: snapshot?.hook_type || snapshot?.hookType || detail.emotional_trigger || "empathy",
    score_total: clampScore(snapshot?.totalScore || snapshot?.scoreTotal || snapshot?.score || detail.totalScore || detail.viralScore?.total || 0),
    score_detail: detail,
    source_trace: safeArray(snapshot?.sourceTrace || snapshot?.source_trace || detail.source_ids || snapshot?.source_ids || snapshot?.sourceIds)
  };
  if (isUuid(draftId)) row.id = draftId;
  return row;
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

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  }, "profiles.upsert");
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
    body: detail.body || rowOrDraft.body || text,
    cta: detail.closing_line || detail.cta || rowOrDraft.cta || "",
    closing_line: detail.closing_line || rowOrDraft.closing_line || rowOrDraft.cta || "",
    closingLine: detail.closing_line || rowOrDraft.closingLine || rowOrDraft.cta || "",
    comment_bait: detail.comment_bait || rowOrDraft.comment_bait || rowOrDraft.commentBait || detail.commentHook || "",
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
    failureReason: rowOrDraft.failure_reason
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

async function loadDraftForUser(env, draftId, userId) {
  if (!isUuid(draftId)) return null;
  const rows = await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" }, "post_drafts.select");
  return Array.isArray(rows) ? rows[0] : null;
}

async function createDraftFromSnapshot(env, snapshot, userId, draftId) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const row = draftRowFromSnapshot(snapshot, userId, draftId);
  if (!row) return null;
  const rows = await supabaseRequest(env, "post_drafts", {
    method: "POST",
    body: JSON.stringify([row])
  }, "post_drafts.insert_from_approval_snapshot");
  return Array.isArray(rows) ? rows[0] : null;
}

async function ensureDraftForApproval(env, draftId, userId, snapshot) {
  const existing = await loadDraftForUser(env, draftId, userId);
  if (existing) return { draft: existing, draftId: existing.id };
  const created = await createDraftFromSnapshot(env, snapshot, userId, draftId);
  if (created) return { draft: created, draftId: created.id };
  return { draft: null, draftId };
}

async function loadExistingApproval(env, draftId) {
  const rows = await supabaseRequest(env, `approval_queue?draft_id=eq.${encodeURIComponent(draftId)}&select=*`, { method: "GET" }, "approval_queue.select_existing");
  return Array.isArray(rows) ? rows[0] : null;
}

async function saveApproval(env, draftId, row) {
  const existing = await loadExistingApproval(env, draftId);
  if (existing?.id) {
    const rows = await supabaseRequest(env, `approval_queue?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      body: JSON.stringify(row)
    }, "approval_queue.patch_existing");
    return Array.isArray(rows) ? rows[0] : null;
  }
  const rows = await supabaseRequest(env, "approval_queue", {
    method: "POST",
    body: JSON.stringify([{ draft_id: draftId, ...row }])
  }, "approval_queue.insert");
  return Array.isArray(rows) ? rows[0] : null;
}

async function upsertApproval(env, request, status) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), persistenceEnv, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);
  const body = await request.json().catch(() => ({}));
  const draftId = String(body.draftId || "").trim();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const draftSnapshot = body.draft && typeof body.draft === "object" ? body.draft : null;
  if (!draftId) return json(apiError("missing_draft_id", "draftId is required."), persistenceEnv, request, 400);

  await ensureProfile(persistenceEnv, userId);
  const resolved = await ensureDraftForApproval(persistenceEnv, draftId, userId, draftSnapshot);
  if (!resolved.draft) {
    return json(apiError("draft_not_found", "Draft was not found for this user and no draft snapshot was provided."), persistenceEnv, request, 404);
  }

  const now = new Date().toISOString();
  const approval = await saveApproval(persistenceEnv, resolved.draftId, {
    status,
    approved_at: status === "approved" ? now : null,
    rejected_at: status === "rejected" ? now : null,
    notes
  });
  await supabaseRequest(persistenceEnv, `post_drafts?id=eq.${encodeURIComponent(resolved.draftId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }, "post_drafts.patch_status");
  return json({ success: true, approval: clientApproval({ ...approval, draft: resolved.draft }) }, persistenceEnv, request);
}

export async function handleApproveDraft(request, env) {
  try {
    return await upsertApproval(env, request, "approved");
  } catch (error) {
    console.error("approve draft failed", error);
    return json(apiError("approve_failed", "Draft could not be approved.", String(error?.message || error)), env, request, 500);
  }
}

export async function handleRejectDraft(request, env) {
  try {
    return await upsertApproval(env, request, "rejected");
  } catch (error) {
    console.error("reject draft failed", error);
    return json(apiError("reject_failed", "Draft could not be rejected.", String(error?.message || error)), env, request, 500);
  }
}

export async function handleApprovalQueue(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  if (!hasSupabase(persistenceEnv)) return json({ success: true, approvals: [] }, persistenceEnv, request);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), persistenceEnv, request, 401);
  try {
    const rows = await supabaseRequest(
      persistenceEnv,
      `approval_queue?status=eq.approved&select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=approved_at.desc.nullslast,created_at.desc`,
      { method: "GET" },
      "approval_queue.select"
    );
    const approvals = (rows || []).map(clientApproval);
    return json({ success: true, approvals }, persistenceEnv, request);
  } catch (error) {
    console.error("approval queue load failed", error);
    return json(apiError("approval_queue_failed", "Approval queue could not be loaded.", String(error?.message || error)), persistenceEnv, request, 500);
  }
}

export async function handleDashboardWithApprovals(request, env) {
  const authIssuer = getAuthIssuerUrl(request);
  const persistenceEnv = authIssuer ? { ...env, SUPABASE_AUTH_ISSUER: authIssuer } : env;
  const userId = getAuthUserId(request);
  if (hasSupabase(persistenceEnv) && userId) {
    try {
      await ensureProfile(persistenceEnv, userId);
      const [draftRows, approvalRows, briefRows, jobRows, auditRows] = await Promise.all([
        supabaseRequest(persistenceEnv, `post_drafts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`, { method: "GET" }, "post_drafts.dashboard"),
        supabaseRequest(persistenceEnv, `approval_queue?select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`, { method: "GET" }, "approval_queue.dashboard"),
        supabaseRequest(persistenceEnv, `research_briefs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }, "research_briefs.dashboard"),
        supabaseRequest(persistenceEnv, `publish_jobs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=scheduled_at.asc&limit=20`, { method: "GET" }, "publish_jobs.dashboard"),
        supabaseRequest(persistenceEnv, `audit_events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }, "audit_events.dashboard")
      ]);
      const drafts = (draftRows || []).map(clientDraft).filter(Boolean);
      const approvals = (approvalRows || []).map(clientApproval);
      const approvedDraftIds = new Set(approvals.filter((approval) => approval.status === "approved").map((approval) => approval.draftId));
      const rejectedDraftIds = new Set(approvals.filter((approval) => approval.status === "rejected").map((approval) => approval.draftId));
      const totalDrafts = drafts.length;
      const approvedDrafts = approvals.filter((approval) => approval.status === "approved").length;
      const rejectedDrafts = approvals.filter((approval) => approval.status === "rejected").length;
      const awaitingApproval = drafts.filter((draft) => !approvedDraftIds.has(draft.id) && !rejectedDraftIds.has(draft.id) && (draft.status === "scored" || draft.status === "draft")).length;
      const published = drafts.filter((draft) => draft.status === "published").length;
      const failed = drafts.filter((draft) => draft.status === "failed").length;
      const scheduled = drafts.filter((draft) => draft.status === "scheduled").length;
      const averageScore = drafts.length ? Math.round(drafts.reduce((sum, draft) => sum + (draft.totalScore || draft.scoreTotal || draft.score || 0), 0) / drafts.length) : 0;
      return json({
        ok: true,
        researchCount: briefRows?.length || 0,
        draftCount: totalDrafts,
        queueCount: approvedDrafts,
        success: true,
        profile: { id: userId, displayName: "Viral OS Operator", threadsConnected: Boolean(persistenceEnv.THREADS_ACCESS_TOKEN) },
        drafts,
        approvalQueue: approvals.filter((approval) => approval.status === "approved"),
        researchBriefs: (briefRows || []).map((brief) => ({ id: brief.id, topic: brief.topic, summary: brief.summary, sourceCount: brief.source_count || 0, createdAt: brief.created_at })),
        publishJobs: (jobRows || []).map((job) => ({ id: job.id, draftId: job.draft_id, status: job.status, scheduledAt: job.scheduled_at, attemptCount: job.attempt_count, lastError: job.last_error })),
        auditEvents: (auditRows || []).map((event) => ({ id: event.id, entityType: event.entity_type, entityId: event.entity_id, action: event.action, metadata: event.metadata || {}, createdAt: event.created_at })),
        metrics: { totalDrafts, approvedDrafts, rejectedDrafts, awaitingApproval, scheduled, failed, published, averageScore, sourceBackedDrafts: drafts.filter((draft) => draft.sourceTrace?.length).length }
      }, persistenceEnv, request);
    } catch (error) {
      console.error("dashboard approval fallback", error);
    }
  }
  return json({
    ok: true,
    researchCount: 0,
    draftCount: 0,
    queueCount: 0,
    success: true,
    profile: { id: "iwakan-lab", displayName: "Iwakan Lab", threadsConnected: Boolean(persistenceEnv.THREADS_ACCESS_TOKEN) },
    drafts: [],
    approvalQueue: [],
    researchBriefs: [],
    publishJobs: [],
    auditEvents: [],
    metrics: { totalDrafts: 0, approvedDrafts: 0, rejectedDrafts: 0, awaitingApproval: 0, scheduled: 0, failed: 0, published: 0, averageScore: 0, sourceBackedDrafts: 0 }
  }, persistenceEnv, request);
}
