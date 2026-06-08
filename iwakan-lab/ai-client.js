(function () {
  const WORKER_BASE_URL = "https://iwakan-lab.nakamura0407.workers.dev";
  const GENERATE_URL = `${WORKER_BASE_URL}/generate`;
  const TIMEOUT_MS = 15000;

  function makeError(message, detail = {}) {
    const error = new Error(message);
    Object.assign(error, detail);
    return error;
  }

  async function generate({ theme, category, mode = "list" }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(GENERATE_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, category, mode })
      });

      const rawText = await response.text();
      console.groupCollapsed("[Iwakan Lab AI] Cloudflare Worker response");
      console.log("endpoint", GENERATE_URL);
      console.log("status", response.status, response.statusText);
      console.log("elapsedMs", Date.now() - startedAt);
      console.log("rawResponse", rawText);
      console.groupEnd();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        throw makeError("Cloudflare Worker returned non-JSON response.", {
          endpoint: GENERATE_URL,
          status: response.status,
          rawResponse: rawText,
          originalError: error
        });
      }

      if (!response.ok || data.success !== true) {
        throw makeError(data.error || `Cloudflare Worker failed: HTTP ${response.status}`, {
          endpoint: GENERATE_URL,
          status: response.status,
          detail: data.detail,
          rawResponse: rawText,
          response: data
        });
      }

      const ideas = Array.isArray(data.ideas) ? data.ideas : [];
      if (!ideas.length) {
        throw makeError("Cloudflare Worker response did not include ideas.", {
          endpoint: GENERATE_URL,
          status: response.status,
          rawResponse: rawText,
          response: data
        });
      }

      ideas.ideas = ideas;
      ideas.mode = "cloudflare-worker";
      ideas.model = data.model || "gpt-5-mini";
      ideas.source = data.source || "openai";
      ideas.error = data.error || "";
      ideas.elapsedMs = data.elapsedMs || Date.now() - startedAt;
      return ideas;
    } catch (error) {
      if (error.name === "AbortError") {
        throw makeError("Cloudflare Worker timed out after 15 seconds.", {
          endpoint: GENERATE_URL,
          timeoutMs: TIMEOUT_MS,
          originalError: error
        });
      }
      if (!error.endpoint && !error.code) {
        throw makeError("Cloudflare Worker browser fetch failed.", {
          endpoint: GENERATE_URL,
          originalError: error
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.AIClient = { WORKER_BASE_URL, GENERATE_URL, TIMEOUT_MS, generate };
})();
