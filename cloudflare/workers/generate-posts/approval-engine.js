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
  return Boolean((env.SUPABASE_URL || env.SUPABASE_REST_URL || env.SUPABASE_PROJECT_REF) && env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeSupabaseRestBaseUrl(env) {
  const configured = String(env.SUPABASE_REST_URL || env.SUPABASE_URL || "").trim();
  const projectRef = String(env.SUPABASE_PROJECT_REF || "").trim();
  let value = configured || (projectRef ? `https://${projectRef}.supabase.co` : "");
  if (!value) throw new Error("Supabase URL is not configured.");
  if (!/^https?:\/\//i.test(value)) {
    value = /^[a-z0-9-]+$/i.test(value) ? `https://${value}.supabase.co` : `https://${value}`;
  }
  const parsed = new URL(value);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = (pathname.endsWith("/rest/v1") ? pathname : `${pathname}/rest/v1`).replace(/\/+/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
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

async function supabaseRequest(env, path, init = {}, operation = path) {
  if (!hasSupabase(env)) throw new Error("Supabase service environment variables are not configured.");
  const baseUrl = normalizeSupabaseRestBaseUrl(env);
  const url = `${baseUrl}/${path.replace(/^\/+/, "")}`;
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
  if (!response.ok) {
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch {}
    const message = parsed?.message || raw.slice(0, 500) || response.statusText;
    const code = parsed?.code || response.status;
    throw new Error(`${operation} failed: ${code} ${message}`);
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
    text: rowOrDraft.text || [detail.hook, detail.body, detail.cta].filter(Boolean).join("\n"),
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
  if (!hasSupabase(env)) return json(apiError("missing_supabase", "Supabase service environment variables are not configured."), env, request, 500);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  const body = await request.json().catch(() => ({}));
  const draftId = String(body.draftId || "").trim();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  if (!draftId) return json(apiError("missing_draft_id", "draftId is required."), env, request, 400);

  await ensureProfile(env, userId);
  const draft = await loadDraftForUser(env, draftId, userId);
  if (!draft) return json(apiError("draft_not_found", "Draft was not found for this user."), env, request, 404);

  const now = new Date().toISOString();
  const approval = await saveApproval(env, draftId, {
    status,
    approved_at: status === "approved" ? now : null,
    rejected_at: status === "rejected" ? now : null,
    notes
  });
  await supabaseRequest(env, `post_drafts?id=eq.${encodeURIComponent(draftId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }, "post_drafts.patch_status");
  return json({ success: true, approval: clientApproval({ ...approval, draft }) }, env, request);
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
  if (!hasSupabase(env)) return json({ success: true, approvals: [] }, env, request);
  const userId = getAuthUserId(request);
  if (!userId) return json(apiError("unauthorized", "A valid Supabase session token is required."), env, request, 401);
  try {
    const rows = await supabaseRequest(
      env,
      `approval_queue?status=eq.approved&select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=approved_at.desc.nullslast,created_at.desc`,
      { method: "GET" },
      "approval_queue.select"
    );
    const approvals = (rows || []).map(clientApproval);
    return json({ success: true, approvals }, env, request);
  } catch (error) {
    console.error("approval queue load failed", error);
    return json(apiError("approval_queue_failed", "Approval queue could not be loaded.", String(error?.message || error)), env, request, 500);
  }
}

export async function handleDashboardWithApprovals(request, env) {
  const userId = getAuthUserId(request);
  if (hasSupabase(env) && userId) {
    try {
      await ensureProfile(env, userId);
      const [draftRows, approvalRows, briefRows, jobRows, auditRows] = await Promise.all([
        supabaseRequest(env, `post_drafts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`, { method: "GET" }, "post_drafts.dashboard"),
        supabaseRequest(env, `approval_queue?select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`, { method: "GET" }, "approval_queue.dashboard"),
        supabaseRequest(env, `research_briefs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }, "research_briefs.dashboard"),
        supabaseRequest(env, `publish_jobs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=scheduled_at.asc&limit=20`, { method: "GET" }, "publish_jobs.dashboard"),
        supabaseRequest(env, `audit_events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }, "audit_events.dashboard")
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
        profile: {
          id: userId,
          displayName: "Viral OS Operator",
          threadsConnected: Boolean(env.THREADS_ACCESS_TOKEN)
        },
        drafts,
        approvalQueue: approvals.filter((approval) => approval.status === "approved"),
        researchBriefs: (briefRows || []).map((brief) => ({
          id: brief.id,
          topic: brief.topic,
          summary: brief.summary,
          sourceCount: brief.source_count || 0,
          createdAt: brief.created_at
        })),
        publishJobs: (jobRows || []).map((job) => ({
          id: job.id,
          draftId: job.draft_id,
          status: job.status,
          scheduledAt: job.scheduled_at,
          attemptCount: job.attempt_count,
          lastError: job.last_error
        })),
        auditEvents: (auditRows || []).map((event) => ({
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
          awaitingApproval,
          scheduled,
          failed,
          published,
          averageScore,
          sourceBackedDrafts: drafts.filter((draft) => draft.sourceTrace?.length).length
        }
      }, env, request);
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
    profile: {
      id: "iwakan-lab",
      displayName: "Iwakan Lab",
      threadsConnected: Boolean(env.THREADS_ACCESS_TOKEN)
    },
    drafts: [],
    approvalQueue: [],
    researchBriefs: [],
    publishJobs: [],
    auditEvents: [],
    metrics: {
      totalDrafts: 0,
      approvedDrafts: 0,
      rejectedDrafts: 0,
      awaitingApproval: 0,
      scheduled: 0,
      failed: 0,
      published: 0,
      averageScore: 0,
      sourceBackedDrafts: 0
    }
  }, env, request);
}
