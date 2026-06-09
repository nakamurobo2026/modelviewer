const DEFAULT_MODEL = 'gpt-5-mini';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    const debug = new URL(request.url).searchParams.get('debug') === '1';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405, cors);
    }

    let plan;
    try {
      plan = await request.json();
      validatePlan(plan);
    } catch (error) {
      return json({ error: 'Invalid DreamPlan payload.' }, 400, cors);
    }

    const openAiApiKey = getEnv(env, 'OPENAI_API_KEY');
    if (!openAiApiKey) {
      return json({
        source: 'worker-fallback',
        warning: 'OPENAI_API_KEY is not available in this Worker runtime.',
        ...(debug ? { debug: { envKeys: Object.keys(env).sort() } } : {}),
        ...fallbackAnalysis(plan)
      }, 200, cors);
    }

    try {
      const analysis = await analyzeWithOpenAI(plan, env, openAiApiKey);
      return json({ source: 'openai', ...analysis }, 200, cors);
    } catch (error) {
      return json({
        source: 'worker-fallback',
        warning: 'OpenAI analysis failed. Returned local fallback.',
        ...(debug ? { debug: sanitizeError(error) } : {}),
        ...fallbackAnalysis(plan)
      }, 200, cors);
    }
  }
};

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || 'https://nakamurobo2026.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function validatePlan(plan) {
  const required = ['dreamTitle', 'currentAge', 'targetAge', 'currentSituation'];
  for (const key of required) {
    if (plan[key] === undefined || plan[key] === null || plan[key] === '') {
      throw new Error(`Missing ${key}`);
    }
  }
  if (Number(plan.targetAge) < Number(plan.currentAge)) {
    throw new Error('targetAge must be greater than or equal to currentAge.');
  }
}

async function analyzeWithOpenAI(plan, env, openAiApiKey) {
  const model = getEnv(env, 'OPENAI_MODEL') || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('OpenAI request timed out.'), 25000);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 5000,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'あなたは現実的でやわらかい夢ロードマップ設計者です。成功を断言せず、JSONだけを返してください。NG語: KPI, 未達成, ノルマ, 失敗, 達成率が低い。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `次のDreamPlanをAnalysisResult JSONにしてください。必ず summary, possibilityLevel, message, existingAssets, missingPieces, risks, roadmap, todayActions を含めます。ロードマップは currentAge から targetAge まで各年齢分を作ります。\n\n${JSON.stringify(plan)}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_object'
        }
      }
    })
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${shorten(body, 600)}`);
  }

  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
  if (!text) {
    throw new Error('OpenAI response did not include output_text.');
  }
  const parsed = JSON.parse(text);
  return normalizeAnalysis(parsed, plan);
}

function normalizeAnalysis(value, plan) {
  const fallback = fallbackAnalysis(plan);
  return {
    summary: stringOr(value.summary, fallback.summary),
    possibilityLevel: ['low', 'medium', 'high'].includes(value.possibilityLevel) ? value.possibilityLevel : fallback.possibilityLevel,
    message: stringOr(value.message, fallback.message),
    existingAssets: arrayOr(value.existingAssets, fallback.existingAssets),
    missingPieces: arrayOr(value.missingPieces, fallback.missingPieces),
    risks: arrayOr(value.risks, fallback.risks),
    roadmap: arrayOr(value.roadmap, fallback.roadmap),
    todayActions: arrayOr(value.todayActions, fallback.todayActions)
  };
}

function fallbackAnalysis(plan) {
  const currentAge = Number(plan.currentAge);
  const targetAge = Number(plan.targetAge);
  const years = Math.max(targetAge - currentAge, 0);
  const possibilityLevel = years >= 5 ? 'high' : years >= 2 ? 'medium' : 'low';

  return {
    summary: `${currentAge}歳の今から「${plan.dreamTitle}」へ向かうために、${targetAge}歳までを小さな検証と積み上げに分けて考えます。`,
    possibilityLevel,
    message: possibilityLevel === 'high'
      ? '確実とは言えません。ただ、時間を味方にして検証を重ねられる余地があります。'
      : possibilityLevel === 'medium'
        ? '楽ではありませんが、範囲を絞れば現実的に試せる道があります。'
        : 'かなり絞り込みが必要です。まず形を変えた小さな到達点から見るのがよさそうです。',
    existingAssets: [
      { title: '今の状況を言葉にできていること', description: `「${shorten(plan.currentSituation, 58)}」という現在地は、次の判断材料になります。` },
      { title: '普通だと思っている経験', description: `${plan.skills ? shorten(plan.skills, 76) : 'これまでの仕事、生活、対人経験'}の中に使える材料があります。` },
      { title: '制約を先に見ていること', description: '使える時間やお金を先に置くことで、続く形を探せます。' }
    ],
    missingPieces: [
      { title: '小さく試す場', description: '発信、見学、相談、試作品など、反応を得る場が必要です。' },
      { title: '比較できる実例', description: '近い年齢や制約の人を探すと、現実的な順番を見積もれます。' }
    ],
    risks: [
      { title: '最初から大きく賭けすぎる', description: '大きな支出や退職を最初に置くと、検証前に後戻りしにくくなります。', avoidance: 'まずは無料から低額で、1週間以内に試せる行動へ落とします。' },
      { title: '調べ続けて動けなくなる', description: '情報収集だけだと始める日が遠くなります。', avoidance: '調査は30分で区切り、小さな外向き行動を1つ入れます。' }
    ],
    roadmap: buildRoadmap(currentAge, targetAge),
    todayActions: [
      { title: '夢を1行にする', description: `「${plan.dreamTitle}」で誰に何を届けたいのかを、粗いまま1行で書きます。`, estimatedMinutes: 8, emotionalMessage: 'きれいな言葉でなくて大丈夫です。' },
      { title: '近い人を3人保存する', description: '年齢、制約、出発点が少し近い実例を3人だけ保存します。', estimatedMinutes: 15, emotionalMessage: '近い実例のほうが今日の味方になります。' },
      { title: '1人に小さく話す', description: '信頼できる人に「少し調べていること」として話します。', estimatedMinutes: 10, emotionalMessage: '宣言にしなくて大丈夫です。' }
    ]
  };
}

function buildRoadmap(currentAge, targetAge) {
  const ages = Array.from({ length: targetAge - currentAge + 1 }, (_, index) => currentAge + index);
  const total = Math.max(ages.length - 1, 1);
  return ages.map((age, index) => {
    const progress = index / total;
    if (progress === 0) return item(age, '現在地を見える形にする', ['夢を1行で書く', '近い実例を3つ集める'], '最初は夢と制約を同じテーブルに置くことが大切です。', 'スマホのメモに1行だけ書きます。', '動けない場合は実例を1つ見るだけに縮めます。');
    if (progress < 0.5) return item(age, '小さく試して反応を見る', ['小さな発信や相談を行う', '必要スキルを1つ練習する'], '早い段階では現実の反応を集めるほうが判断材料になります。', '15分だけ参考事例を保存します。', '反応が薄い場合は対象者や出し方を変えます。');
    if (progress < 1) return item(age, '続く型を作る', ['週1回の固定時間を作る', '試したことを記録する'], '戻ってこられるリズムがあると続けやすくなります。', 'カレンダーに30分だけ入れます。', '忙しい週は記録だけ残します。');
    return item(age, '達成の形を選び直す', ['到達点を具体化する', '次の小さな目標へ分ける'], '得た反応から達成の形を選び直します。', '記録を10分だけ読み返します。', '期限や形を調整します。');
  });
}

function item(age, theme, actions, reason, smallStart, fallbackPlan) {
  return { age, theme, actions, reason, smallStart, risks: ['大きな決断を急ぐ', '他人の速度と比べる'], fallbackPlan };
}

function stringOr(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function arrayOr(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function shorten(value, max) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getEnv(env, name) {
  if (env[name]) return env[name];
  const matchingKey = Object.keys(env).find((key) => key.trim() === name);
  return matchingKey ? env[matchingKey] : undefined;
}

function sanitizeError(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]');
}
