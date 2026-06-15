import worker from "../worker.js";
import { handleResearchWithTrend, handleTrends, corsHeaders } from "../trend-engine.js";
import { handleResearchWithCompatiblePersistence } from "../research-persistence-engine.js";
import { handleDraftGenerateWithLearning } from "../draft-learning-engine.js";
import { handleApprovalQueue, handleApproveDraft, handleRejectDraft } from "../approval-engine.js";
import { handleDashboardWithSchedule } from "../dashboard-engine.js";
import { handleCreateSchedule, handleDeleteSchedule, handleListSchedule } from "../schedule-engine.js";
import { handleLearning, handlePostPerformance } from "../learning-engine.js";

function json(data, env, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(env, request.headers.get("Origin"))
  });
}

function apiError(code, message, details) {
  return { success: false, error: { code, message, details } };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("Origin")) });
      if (request.method === "GET" && url.pathname === "/api/dashboard") return handleDashboardWithSchedule(request, env);
      if (request.method === "GET" && url.pathname === "/api/learning") return handleLearning(request, env);
      if (request.method === "POST" && url.pathname === "/api/performance") return handlePostPerformance(request, env);
      if (request.method === "GET" && url.pathname === "/api/approval-queue") return handleApprovalQueue(request, env);
      if (request.method === "GET" && url.pathname === "/api/schedule") return handleListSchedule(request, env);
      if (request.method === "POST" && url.pathname === "/api/schedule") return handleCreateSchedule(request, env);
      if (request.method === "DELETE" && url.pathname.startsWith("/api/schedule/")) return handleDeleteSchedule(request, env, url.pathname.split("/").pop());
      if (request.method === "GET" && url.pathname === "/api/trends") return handleTrends(request, env);
      if (request.method === "POST" && url.pathname === "/api/drafts/generate") return handleDraftGenerateWithLearning(request, env);
      if (request.method === "POST" && url.pathname === "/api/drafts/approve") return handleApproveDraft(request, env);
      if (request.method === "POST" && url.pathname === "/api/drafts/reject") return handleRejectDraft(request, env);
      if ((url.pathname === "/research" || url.pathname === "/api/research") && !url.searchParams.has("ai")) {
        return handleResearchWithTrend(request, env, ctx, worker, { ...env, OPENAI_API_KEY: "" }, handleResearchWithCompatiblePersistence);
      }
      if (url.pathname === "/research" || url.pathname === "/api/research") {
        return handleResearchWithTrend(request, env, ctx, worker, env, handleResearchWithCompatiblePersistence);
      }
      if (url.pathname.startsWith("/api/")) {
        return json(apiError("route_not_found", `No Worker API route matched ${request.method} ${url.pathname}.`), env, request, 404);
      }
      return worker.fetch(request, env, ctx);
    } catch (error) {
      console.error("worker route failed", request.method, url.pathname, error);
      return json(apiError("worker_runtime_error", "Worker route failed before a response was returned.", String(error?.message || error)), env, request, 500);
    }
  }
};
