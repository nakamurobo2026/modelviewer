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
  const timeoutId = setTimeout(() => controller.abort('OpenAI request timed out.'), 55000);
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
              text: [
                'あなたは現実的でやわらかい夢ロードマップ設計者です。',
                '成功を断言せず、自己啓発臭を強くしすぎず、深夜でも安心して読める温度で書きます。',
                'このアプリは夢達成アプリではなく、止まっていたものを少し再起動するための心の避難所です。',
                '内部では、共感、資産発見、ブレーキ検知、小さな一歩、根拠説明の5役で整理してください。',
                'JSONだけを返してください。Markdownや説明文は不要です。',
                'NG語: KPI, 未達成, ノルマ, 失敗, 達成率が低い, 実行フェーズ, 最適化, 資産化, 型化, ペルソナ, スケール。',
                '空文字、null、単なる文字列配列は使わず、必ず指定されたオブジェクト構造で返してください。'
              ].join('\n')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                '次のDreamPlanをAnalysisResult JSONにしてください。',
                '入力値を不明扱いせず、JSON内の各値を根拠にして具体化してください。',
                '',
                '必須スキーマ:',
                '{',
                '  "summary": "夢の整理を2〜4文で。",',
                '  "possibilityLevel": "low | medium | high",',
                '  "message": "確実とは言えないが今あるものから始められる、という温度の文。",',
                '  "reasoning": "ユーザー入力のどこを見て、なぜその整理にしたか。診断ではなく整理として書く。",',
                '  "evidence": [{ "label": "入力の種類", "quote": "ユーザー入力の短い引用", "interpretation": "そこから読み取ったこと" }],',
                '  "existingAssets": [{ "title": "", "description": "" }],',
                '  "missingPieces": [{ "title": "", "description": "" }],',
                '  "risks": [{ "title": "", "description": "", "avoidance": "" }],',
                '  "detectedBlocks": [{ "title": "止まりやすい理由", "description": "責めない文体で、入力と繋げて説明" }],',
                '  "roadmap": [{ "age": 44, "theme": "", "actions": ["短い行動"], "reason": "", "smallStart": "", "risks": ["短いリスク"], "fallbackPlan": "" }],',
                '  "todayActions": [{ "title": "", "description": "", "estimatedMinutes": 10, "emotionalMessage": "", "actionReason": "なぜ今この一歩なのか" }]',
                '}',
                '',
                '制約:',
                '- roadmap は currentAge から targetAge まで各年齢分を必ず作る。',
                '- actions と risks は必ず配列にする。文字列でまとめない。',
                '- todayActions は3つ。10〜15分程度でできる小さな行動にする。',
                '- evidence は3〜5個。必ず dreamTitle, currentSituation, availableTime, availableMoney, skills, anxieties のいずれかを短く引用する。',
                '- detectedBlocks は2〜3個。「完璧に始めようとしている」「比較疲れ」「今さら感」「お金や時間の不安」などを、入力と接続して優しく整理する。',
                '- 各 todayActions には actionReason を入れる。心理負荷・生活への影響・検証しやすさの観点で短く書く。',
                '- 使う言葉: 今日の一歩, 小さな前進, 今あるもの, 止まる週があるのも普通, 一緒に整理しよう。',
                '- 「必ず成功」などの断言はしない。',
                '- 「向いています」と断定せず、「始めやすい可能性」「経験と繋がりやすい」「小さく試しやすい」と書く。',
                '- 文章は短めに。読むより感覚で整理されるよう、1項目1メッセージにする。',
                '',
                `DreamPlan: ${JSON.stringify(plan)}`
              ].join('\n')
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
    reasoning: stringOr(value.reasoning, fallback.reasoning),
    evidence: normalizeEvidence(value.evidence || value.userAssets, fallback.evidence),
    existingAssets: normalizeTextItems(value.existingAssets, fallback.existingAssets, '今あるもの'),
    missingPieces: normalizeTextItems(value.missingPieces, fallback.missingPieces, '足りないもの'),
    risks: normalizeRisks(value.risks, fallback.risks),
    detectedBlocks: normalizeTextItems(value.detectedBlocks || value.blocks || value.brakes, fallback.detectedBlocks, '止まりやすいところ'),
    roadmap: normalizeRoadmap(value.roadmap, fallback.roadmap),
    todayActions: normalizeTodayActions(value.todayActions, fallback.todayActions)
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
    reasoning: `「${shorten(plan.currentSituation, 44)}」という今の状況と、「${shorten(plan.availableTime, 28)}」「${shorten(plan.availableMoney, 28)}」という制約を見ると、最初から大きく変えるより、小さく試して反応を見る順番が合いやすそうです。`,
    evidence: [
      { label: '今の状況', quote: shorten(plan.currentSituation, 58), interpretation: '現在地が言葉になっているので、無理のない始め方を選びやすくなります。' },
      { label: '使える時間', quote: shorten(plan.availableTime, 42), interpretation: 'まとまった時間より、短い行動に分けるほうが続けやすい可能性があります。' },
      { label: '経験・スキル', quote: shorten(plan.skills, 58), interpretation: '普通だと思っている経験の中に、最初の試作や相談に使える材料があります。' }
    ],
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
    detectedBlocks: [
      { title: '完璧に始めようとして止まりやすい', description: `「${shorten(plan.anxieties, 42)}」という不安があるため、最初から正解を出そうとすると重くなりやすいです。` },
      { title: '今さら感で比較しやすい', description: `${currentAge}歳から${targetAge}歳までの時間を考えると、遠い成功例より近い実例を見るほうが動きやすそうです。` }
    ],
    roadmap: buildRoadmap(currentAge, targetAge),
    todayActions: [
      { title: '夢を1行にする', description: `「${plan.dreamTitle}」で誰に何を届けたいのかを、粗いまま1行で書きます。`, estimatedMinutes: 8, emotionalMessage: 'きれいな言葉でなくて大丈夫です。', actionReason: '頭の中だけにある状態より、1行にすると次に調べることが軽くなるため。' },
      { title: '近い人を3人保存する', description: '年齢、制約、出発点が少し近い実例を3人だけ保存します。', estimatedMinutes: 15, emotionalMessage: '近い実例のほうが今日の味方になります。', actionReason: '比較疲れを減らし、今の生活に近い始め方を見つけやすくするため。' },
      { title: '1人に小さく話す', description: '信頼できる人に「少し調べていること」として話します。', estimatedMinutes: 10, emotionalMessage: '宣言にしなくて大丈夫です。', actionReason: '大きな決意ではなく、外に少し出す練習として心理負荷が低いため。' }
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

function normalizeTextItems(value, fallback, label) {
  return arrayOr(value, fallback).map((item, index) => {
    if (typeof item === 'string') {
      return { title: item, description: `${label}として小さな前進に使える材料です。` };
    }
    return {
      title: stringOr(item?.title || item?.name || item?.label, `${label}${index + 1}`),
      description: stringOr(item?.description || item?.detail || item?.reason, '小さく分けて確認していきます。')
    };
  });
}

function normalizeRisks(value, fallback) {
  return arrayOr(value, fallback).map((item, index) => {
    if (typeof item === 'string') {
      return { title: item, description: '焦る前に見ておきたい点です。', avoidance: '小さく試せる形へ戻します。' };
    }
    return {
      title: stringOr(item?.title || item?.risk || item?.name, `避けたいリスク${index + 1}`),
      description: stringOr(item?.description || item?.detail, '焦る前に見ておきたい点です。'),
      avoidance: stringOr(item?.avoidance || item?.fallbackPlan || item?.fallback, '小さく試せる形へ戻します。')
    };
  });
}

function normalizeTodayActions(value, fallback) {
  return arrayOr(value, fallback).slice(0, 3).map((item, index) => {
    if (typeof item === 'string') {
      return { title: item, description: '今日できる大きさまで小さくした一歩です。', estimatedMinutes: 10, emotionalMessage: '大きく変えなくて大丈夫です。', actionReason: '心理負荷が低く、今の生活を壊さず試せるため。' };
    }
    const minutes = Number(item?.estimatedMinutes || item?.minutes || 10);
    return {
      title: stringOr(item?.title || item?.action || item?.step, ['夢を1行にする', '近い人を3人保存する', '1人に小さく話す'][index]),
      description: stringOr(item?.description || item?.detail, '今日できる大きさまで小さくした一歩です。'),
      estimatedMinutes: Number.isFinite(minutes) ? minutes : 10,
      emotionalMessage: stringOr(item?.emotionalMessage || item?.message, '大きく変えなくて大丈夫です。'),
      actionReason: stringOr(item?.actionReason || item?.reason || item?.whyThis || item?.why, '心理負荷が低く、今の生活を壊さず試せるため。')
    };
  });
}

function normalizeEvidence(value, fallback) {
  return arrayOr(value, fallback).map((item, index) => {
    const labels = ['入力から拾ったこと', '今ある環境', '過去の経験', '不安の中身', '使える制約'];
    if (typeof item === 'string') {
      return { label: labels[index] || '手がかり', quote: item, interpretation: 'この言葉を起点に、今日できる大きさへ分けています。' };
    }
    return {
      label: stringOr(item?.label || item?.title || item?.source, labels[index] || '手がかり'),
      quote: stringOr(item?.quote || item?.input || item?.value || item?.text, '入力内容'),
      interpretation: stringOr(item?.interpretation || item?.reason || item?.description, 'この手がかりから、小さく試せる順番を考えています。')
    };
  }).slice(0, 5);
}

function normalizeRoadmap(value, fallback) {
  return arrayOr(value, fallback).map((item, index) => {
    const base = fallback[index] || {};
    return {
      age: Number(item?.age || base.age),
      theme: stringOr(item?.theme || item?.title, base.theme || '小さく前へ進む'),
      actions: toTextArray(item?.actions || base.actions),
      reason: stringOr(item?.reason || item?.why, base.reason || '確認しながら進むためです。'),
      smallStart: stringOr(item?.smallStart || item?.small_start || item?.firstStep, base.smallStart || '10分だけメモに書きます。'),
      risks: toTextArray(item?.risks || base.risks),
      fallbackPlan: stringOr(item?.fallbackPlan || item?.fallback || item?.alternative, base.fallbackPlan || 'さらに小さい一歩へ戻します。')
    };
  });
}

function toTextArray(value) {
  if (Array.isArray(value) && value.length) return value.map((item) => typeof item === 'string' ? item : stringOr(item?.title || item?.description || item?.action, '小さく試す'));
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n|。|・/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  return ['小さく試す'];
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
