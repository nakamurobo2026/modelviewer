(function () {
  const TIMEOUT_MS = 15000;

  function cleanEndpoint(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function makeError(message, detail = {}) {
    const error = new Error(message);
    Object.assign(error, detail);
    return error;
  }

  async function generate({ endpointUrl, apiKey, theme, category, tune, count }) {
    const endpoint = cleanEndpoint(endpointUrl || apiKey || window.IwakanStorage?.getEdgeFunctionUrl?.());
    if (!endpoint) {
      throw makeError("Supabase Edge Function URL is not configured.", { code: "EDGE_URL_MISSING" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, category, tune, count })
      });
      const rawText = await response.text();
      console.groupCollapsed("[Iwakan Lab AI] Edge Function response");
      console.log("endpoint", endpoint);
      console.log("status", response.status, response.statusText);
      console.log("elapsedMs", Date.now() - startedAt);
      console.log("rawResponse", rawText);
      console.groupEnd();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        throw makeError("Edge Function returned non-JSON response.", {
          endpoint,
          status: response.status,
          rawResponse: rawText,
          originalError: error
        });
      }

      if (!response.ok || data.ok === false) {
        throw makeError(data.error || `Edge Function failed: HTTP ${response.status}`, {
          endpoint,
          status: response.status,
          detail: data.detail,
          rawResponse: rawText,
          response: data
        });
      }

      const ideas = Array.isArray(data.ideas) ? data.ideas : [];
      if (!ideas.length) {
        throw makeError("Edge Function response did not include ideas.", {
          endpoint,
          status: response.status,
          rawResponse: rawText,
          response: data
        });
      }

      ideas.ideas = ideas;
      ideas.mode = "supabase-edge";
      ideas.model = data.model || "gpt-5-mini";
      return ideas;
    } catch (error) {
      if (error.name === "AbortError") {
        throw makeError("Supabase Edge Function timed out after 15 seconds.", {
          endpoint,
          timeoutMs: TIMEOUT_MS,
          originalError: error
        });
      }
      if (!error.endpoint && !error.code) {
        throw makeError("Supabase Edge Function browser fetch failed.", {
          endpoint,
          originalError: error
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.AIClient = { TIMEOUT_MS, generate };
  window.OpenAIClient = window.AIClient;
})();
