import worker from "../worker.js";
import { corsHeaders, handleDashboard, handleDraftGenerate, handleResearchWithPersistence } from "../draft-engine.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, request.headers.get("Origin")) });
    if (request.method === "GET" && url.pathname === "/api/dashboard") return handleDashboard(request, env);
    if (request.method === "POST" && url.pathname === "/api/drafts/generate") return handleDraftGenerate(request, env);
    if ((url.pathname === "/research" || url.pathname === "/api/research") && !url.searchParams.has("ai")) {
      return handleResearchWithPersistence(request, env, ctx, worker, { ...env, OPENAI_API_KEY: "" });
    }
    if (url.pathname === "/research" || url.pathname === "/api/research") return handleResearchWithPersistence(request, env, ctx, worker, env);
    return worker.fetch(request, env, ctx);
  }
};
