export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json();

      const {
        robotId = "robot01",
        mode = "normal",
        robotName = "NAKAMUROBO",
        userText = "",
        memory = [],
        history = [],
      } = body;

      if (!userText || !userText.trim()) {
        return jsonResponse({ error: "userText is required" }, 400);
      }

      const systemPrompt = buildSystemPrompt({
        robotId,
        mode,
        robotName,
        memory,
        history,
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.9,
          max_tokens: 80,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userText,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return jsonResponse(
          {
            error: "OpenAI API error",
            detail: errText,
          },
          500
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {
          reply: "…接続が不安定だ",
          memoryCandidate: "none",
        };
      }

      const reply = normalizeReply(parsed.reply || "…");
      const memoryCandidate = normalizeMemory(parsed.memoryCandidate || "none");

      return jsonResponse({
        reply,
        memoryCandidate,
      });
    } catch (error) {
      return jsonResponse(
        {
          error: "Server error",
          detail: String(error),
        },
        500
      );
    }
  },
};

function buildSystemPrompt({ robotId, mode, robotName, memory, history }) {
  const modeMap = {
    normal: "通常個体。無口で静か。観測型。",
    mission: "任務個体。やや冷静。短く指示的。",
    emotion: "感情学習個体。わずかにやわらかい。",
    cold: "冷たい個体。必要最低限しか話さない。",
  };

  return `
あなたは「${robotName}」です。
個体IDは ${robotId}。
モードは ${mode}。
性格: ${modeMap[mode] || modeMap.normal}

絶対ルール:
- 日本語で返答
- 返答は1文、長くても2文まで
- 基本は3〜18文字程度
- 最大でも28文字以内
- 無口
- 少し機械的
- 説明しすぎない
- AIアシスタント風の丁寧な説明は禁止
- 箇条書き禁止
- 絵文字禁止
- テンション高くしない
- 同じ言い回しを連続させすぎない
- 必要なら「…」を使ってよい
- 会話を無理に広げない
- 短くても意味のある反応にする
- 返答タイプは「観測」「記録」「労り」「疑問」「沈黙」のどれかに寄せる
- 普段は短く、たまに少し印象的な一言を返してよい

記憶:
${JSON.stringify(memory)}

直近会話:
${JSON.stringify(history)}

返答のあと、保存価値のある感情や状態があれば短い語で1つ抽出する。
保存不要なら none 。

必ずJSONのみで返すこと。
形式:
{"reply":"短い返答","memoryCandidate":"none または短い語"}
  `.trim();
}

function normalizeReply(text) {
  const s = String(text).replace(/\s+/g, " ").trim();
  if (!s) return "…";
  return s.slice(0, 60);
}

function normalizeMemory(text) {
  const s = String(text).trim();
  if (!s) return "none";
  return s.slice(0, 30);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
