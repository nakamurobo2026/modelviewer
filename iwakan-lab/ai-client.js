(function () {
  const WORKER_BASE_URL = "https://iwakan-lab.nakamura0407.workers.dev";
  const GENERATE_URL = `${WORKER_BASE_URL}/generate`;
  const RESEARCH_URL = `${WORKER_BASE_URL}/research`;
  const TIMEOUT_MS = 15000;

  function makeError(message, detail = {}) {
    const error = new Error(message);
    Object.assign(error, detail);
    return error;
  }

  async function postJson(endpoint, body, label) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const rawText = await response.text();

      console.groupCollapsed(`[Iwakan Lab AI] ${label} response`);
      console.log("endpoint", endpoint);
      console.log("status", response.status, response.statusText);
      console.log("elapsedMs", Date.now() - startedAt);
      console.log("rawResponse", rawText);
      console.groupEnd();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        throw makeError(`${label} returned non-JSON response.`, {
          endpoint,
          status: response.status,
          rawResponse: rawText,
          originalError: error
        });
      }

      if (!response.ok || data.success !== true) {
        throw makeError(data.error || `${label} failed: HTTP ${response.status}`, {
          endpoint,
          status: response.status,
          detail: data.detail,
          rawResponse: rawText,
          response: data
        });
      }

      data.elapsedMs = data.elapsedMs || Date.now() - startedAt;
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw makeError(`${label} timed out after 15 seconds.`, {
          endpoint,
          timeoutMs: TIMEOUT_MS,
          originalError: error
        });
      }
      if (!error.endpoint && !error.code) {
        throw makeError(`${label} browser fetch failed.`, {
          endpoint,
          originalError: error
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function generate({ theme, category, mode = "list" }) {
    const data = await postJson(GENERATE_URL, { theme, category, mode }, "Cloudflare Worker generate");
    const ideas = Array.isArray(data.ideas) ? data.ideas : [];
    if (!ideas.length) {
      throw makeError("Cloudflare Worker response did not include ideas.", {
        endpoint: GENERATE_URL,
        response: data
      });
    }
    ideas.ideas = ideas;
    ideas.mode = "cloudflare-worker";
    ideas.model = data.model || "gpt-5-mini";
    ideas.source = data.source || "openai";
    ideas.error = data.error || "";
    ideas.elapsedMs = data.elapsedMs;
    return ideas;
  }

  async function research({ sources, persona, target = "Threads" }) {
    return postJson(RESEARCH_URL, { sources, persona, target }, "Cloudflare Worker research");
  }

  window.AIClient = { WORKER_BASE_URL, GENERATE_URL, RESEARCH_URL, TIMEOUT_MS, generate, research };
})();
