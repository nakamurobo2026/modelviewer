(function () {
  const DEFAULT_MODEL = "gpt-5-mini";
  const ENDPOINT = "https://api.openai.com/v1/responses";

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

  function extractText(data) {
    if (data.output_text) return data.output_text;
    const chunks = [];
    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (content.type === "output_text" && content.text) chunks.push(content.text);
        if (content.text) chunks.push(content.text);
      }
    }
    return chunks.join("\n");
  }

  function parseJsonArray(text) {
    const trimmed = String(text || "").trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const match = trimmed.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    }
  }

  async function generate({ apiKey, model = DEFAULT_MODEL, theme, category, tune, count }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: buildPrompt({ theme, category, tune, count }) })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${detail.slice(0, 160)}`);
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("OpenAI response was not JSON.");
      }
      const ideas = parseJsonArray(extractText(data));
      if (!ideas.length) throw new Error("OpenAI response did not include a JSON array.");
      return ideas;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.OpenAIClient = { DEFAULT_MODEL, generate };
})();
