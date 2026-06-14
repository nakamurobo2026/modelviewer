import worker from "../worker.js";
import { handleResearchWithTrend, handleTrends, corsHeaders } from "../trend-engine.js";
import { handleDashboard, handleResearchWithPersistence } from "../draft-engine.js";
import { handleDraftGenerateV2 } from "../draft-v2-engine.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("Origin")) });
    if (request.method === "GET" && url.pathname === "/api/dashboard") return handleDashboard(request, env);
    if (request.method === "GET" && url.pathname === "/api/trends") return handleTrends(request, env);
    if (request.method === "POST" && url.pathname === "/api/drafts/generate") return handleDraftGenerateV2(request, env);
    if ((url.pathname === "/research" || url.pathname === "/api/research") && !url.searchParams.has("ai")) {
      return handleResearchWithTrend(request, env, ctx, worker, { ...env, OPENAI_API_KEY: "" }, handleResearchWithPersistence);
    }
    if (url.pathname === "/research" || url.pathname === "/api/research") {
      return handleResearchWithTrend(request, env, ctx, worker, env, handleResearchWithPersistence);
    }
    return worker.fetch(request, env, ctx);
  }
};
