import { corsHeaders } from "./trend-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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

async function ensureProfile(env, userId) {
  if (!userId || !hasSupabase(env)) return;
  await supabaseRequest(env, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: userId, display_name: "Viral OS Operator" }])
  });
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

export async function handleDashboardWithSchedule(request, env) {
  const userId = getAuthUserId(request);
  if (hasSupabase(env) && userId) {
    try {
      await ensureProfile(env, userId);
      const [draftRows, approvalRows, scheduledRows, briefRows, auditRows] = await Promise.all([
        supabaseRequest(env, `post_drafts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`, { method: "GET" }),
        supabaseRequest(env, `approval_queue?select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`, { method: "GET" }),
        supabaseRequest(env, `scheduled_posts?select=*,draft:post_drafts!inner(*)&draft.user_id=eq.${encodeURIComponent(userId)}&order=scheduled_at.asc&limit=50`, { method: "GET" }),
        supabaseRequest(env, `research_briefs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" }),
        supabaseRequest(env, `audit_events?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=20`, { method: "GET" })
      ]);
      const drafts = (draftRows || []).map(clientDraft).filter(Boolean);
      const approvals = (approvalRows || []).map(clientApproval);
      const scheduledPosts = (scheduledRows || []).map(clientScheduledPost);
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
        scheduledPosts,
        researchBriefs: (briefRows || []).map((brief) => ({
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
          scheduledPosts: scheduledPostCount,
          publishedPosts: publishedPostCount,
          awaitingApproval,
          scheduled: scheduledPostCount,
          failed,
          published: publishedPostCount,
          averageScore,
          sourceBackedDrafts: drafts.filter((draft) => draft.sourceTrace?.length).length
        }
      }, env, request);
    } catch (error) {
      console.error("dashboard schedule fallback", error);
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
    scheduledPosts: [],
    researchBriefs: [],
    publishJobs: [],
    auditEvents: [],
    metrics: {
      totalDrafts: 0,
      approvedDrafts: 0,
      rejectedDrafts: 0,
      scheduledPosts: 0,
      publishedPosts: 0,
      awaitingApproval: 0,
      scheduled: 0,
      failed: 0,
      published: 0,
      averageScore: 0,
      sourceBackedDrafts: 0
    }
  }, env, request);
}
