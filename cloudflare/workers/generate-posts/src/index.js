import worker from "../worker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/research" && !url.searchParams.has("ai")) {
      return worker.fetch(request, { ...env, OPENAI_API_KEY: "" }, ctx);
    }
    return worker.fetch(request, env, ctx);
  }
};
