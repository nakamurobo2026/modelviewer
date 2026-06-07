(function () {
  const DEFAULT_MODEL = "gpt-5-mini";
  const TIMEOUT_MS = 15000;
  const MODES = {
    responses: {
      label: "Responses API",
      endpoint: "https://api.openai.com/v1/responses"
    },
    chat: {
      label: "chat/completions",
      endpoint: "https://api.openai.com/v1/chat/completions"
    }
  };

  function buildPrompt({ theme, category, tune, count }) {
    const direction = tune || category;
    return [
      "Threads向けの短い投稿案をJSONだけで生成してください。",
      `テーマ: ${theme}`,
      `方向性: ${direction}`,
      `件数: ${count}`,
      "条件: AIっぽくしない。20〜90文字中心。短文中心。コメントしたくなる余白。静か、深夜、少し違和感、なんか分かる。",
      "含める空気: 共感、違和感、懐かしさ、深夜テンション、地方感、少し静か。",
      "出力は必ずJSON配列のみ。説明文やMarkdownは禁止。",
      "形式: [{\"text\":\"...\",\"category\":\"...\",\"score\":87,\"hook\":\"共感\"}]"
    ].join("\n");
  }

  function buildRequest({ mode, apiKey, model, prompt }) {
    const base = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    };
    if (mode === "chat") {
      return {
        ...base,
        url: MODES.chat.endpoint,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You write quiet, human, Japanese Threads posts and return only JSON." },
            { role: "user", content: prompt }
          ],
          max_completion_tokens: 2400
        })
      };
    }
    return {
      ...base,
      url: MODES.responses.endpoint,
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 2400
      })
    };
  }

  function orderedModes() {
    const preferred = window.IwakanStorage?.getApiMode?.();
    const all = ["responses", "chat"];
    return all.includes(preferred) ? [preferred, ...all.filter((mode) => mode !== preferred)] : all;
  }

  function extractText(data) {
    if (typeof data.output_text === "string") return data.output_text;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.choices?.[0]?.text) return data.choices[0].text;
    const chunks = [];
    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (typeof content.text === "string") chunks.push(content.text);
        if (typeof content.output_text === "string") chunks.push(content.output_text);
      }
    }
    return chunks.join("\n");
  }

  function parseJsonArray(text) {
    const trimmed = String(text || "")
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
    const candidates = [trimmed];
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) candidates.push(arrayMatch[0]);
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) candidates.push(objectMatch[0]);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.ideas)) return parsed.ideas;
        if (Array.isArray(parsed.posts)) return parsed.posts;
      } catch {
        // Try the next extraction candidate.
      }
    }
    return [];
  }

  function makeError(message, detail = {}) {
    const error = new Error(message);
    Object.assign(error, detail);
    return error;
  }

  function shouldTryNext(error) {
    if (error.parseFailed) return false;
    if (error.status === 401 || error.status === 403 || error.status === 429) return false;
    return true;
  }

  async function fetchWithTimeout(request, mode, model) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const response = await fetch(request.url, {
        method: request.method,
        signal: controller.signal,
        headers: request.headers,
        body: request.body
      });
      const rawText = await response.text();
      console.groupCollapsed(`[Iwakan Lab AI] ${MODES[mode].label} response`);
      console.log("endpoint", request.url);
      console.log("model", model);
      console.log("status", response.status, response.statusText);
      console.log("elapsedMs", Date.now() - startedAt);
      console.log("rawResponse", rawText);
      console.groupEnd();
      if (!response.ok) {
        throw makeError(`${MODES[mode].label} failed: HTTP ${response.status}`, {
          mode,
          endpoint: request.url,
          status: response.status,
          statusText: response.statusText,
          rawResponse: rawText
        });
      }
      return rawText;
    } catch (error) {
      if (error.name === "AbortError") {
        throw makeError(`${MODES[mode].label} timed out after 15 seconds`, {
          mode,
          endpoint: request.url,
          timeoutMs: TIMEOUT_MS,
          originalError: error
        });
      }
      if (!error.mode) {
        throw makeError(`${MODES[mode].label} browser fetch failed`, {
          mode,
          endpoint: request.url,
          originalError: error
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function parseResponse(rawText, mode, endpoint) {
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw makeError(`${MODES[mode].label} returned non-JSON response`, {
        mode,
        endpoint,
        rawResponse: rawText,
        parseFailed: true,
        originalError: error
      });
    }
    const outputText = extractText(data);
    const ideas = parseJsonArray(outputText);
    if (!ideas.length) {
      throw makeError(`${MODES[mode].label} response did not contain a usable JSON array`, {
        mode,
        endpoint,
        rawResponse: rawText,
        parsedResponse: data,
        outputText,
        parseFailed: true
      });
    }
    return ideas;
  }

  function summarizeError(error) {
    const parts = [
      error.message,
      error.status ? `status=${error.status}` : "",
      error.mode ? `mode=${error.mode}` : "",
      error.endpoint ? `endpoint=${error.endpoint}` : ""
    ].filter(Boolean);
    return parts.join(" / ");
  }

  async function generate({ apiKey, model = DEFAULT_MODEL, theme, category, tune, count }) {
    const prompt = buildPrompt({ theme, category, tune, count });
    const errors = [];
    for (const mode of orderedModes()) {
      const request = buildRequest({ mode, apiKey, model, prompt });
      try {
        const rawText = await fetchWithTimeout(request, mode, model);
        const ideas = parseResponse(rawText, mode, request.url);
        ideas.ideas = ideas;
        ideas.mode = mode;
        ideas.model = model;
        window.IwakanStorage?.setApiMode?.(mode);
        return ideas;
      } catch (error) {
        errors.push(error);
        console.error("[Iwakan Lab AI] API attempt failed", {
          mode,
          model,
          endpoint: request.url,
          status: error.status,
          statusText: error.statusText,
          timeoutMs: error.timeoutMs,
          message: error.message,
          rawResponse: error.rawResponse,
          parsedResponse: error.parsedResponse,
          outputText: error.outputText,
          originalError: error.originalError || error
        });
        if (!shouldTryNext(error)) break;
      }
    }
    throw makeError(`OpenAI API failed. ${errors.map(summarizeError).join(" | ")}`, {
      attempts: errors
    });
  }

  window.AIClient = { DEFAULT_MODEL, TIMEOUT_MS, MODES, generate };
  window.OpenAIClient = window.AIClient;
})();
