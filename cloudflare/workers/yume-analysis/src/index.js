const DEFAULT_MODEL = 'gpt-5-mini';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    const debug = new URL(request.url).searchParams.get('debug') === '1';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);

    let payload;
    let plan;
    try {
      payload = await request.json();
      plan = payload?.plan || payload;
      validatePlan(plan);
    } catch (_) {
      return json({ error: 'Invalid DreamPlan payload.' }, 400, cors);
    }

    const knowledgeContext = payload?.knowledgeContext || null;
    const clientResearchContext = payload?.researchContext || null;
    const researchPipeline = await buildResearchPipeline(plan, knowledgeContext, clientResearchContext, env);
    const openAiApiKey = getEnv(env, 'OPENAI_API_KEY');

    if (!openAiApiKey) {
      return json({
        source: 'worker-research-fallback',
        warning: 'OPENAI_API_KEY is not available. Research pipeline still ran.',
        ...(debug ? { debug: debugPayload(env, researchPipeline) } : {}),
        ...buildFallbackAnalysis(plan, knowledgeContext, researchPipeline)
      }, 200, cors);
    }

    try {
      const edited = await editWithOpenAI(plan, knowledgeContext, researchPipeline, env, openAiApiKey);
      return json({ source: 'openai-web-research', ...(debug ? { debug: debugPayload(env, researchPipeline) } : {}), ...normalizeAnalysis(edited, plan, knowledgeContext, researchPipeline) }, 200, cors);
    } catch (error) {
      return json({
        source: 'worker-research-fallback',
        warning: sanitizeError(error),
        ...(debug ? { debug: debugPayload(env, researchPipeline) } : {}),
        ...buildFallbackAnalysis(plan, knowledgeContext, researchPipeline)
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
function json(body, status, headers) { return new Response(JSON.stringify(body), { status, headers }); }
function validatePlan(plan) {
  for (const key of ['dreamTitle', 'currentAge', 'targetAge', 'currentSituation']) {
    if (plan?.[key] === undefined || plan?.[key] === null || plan?.[key] === '') throw new Error(`Missing ${key}`);
  }
}
function debugPayload(env, researchPipeline) {
  return {
    envKeys: Object.keys(env).filter((k) => !/KEY|TOKEN|SECRET/i.test(k)).sort(),
    searchProvider: researchPipeline.provider,
    searchStatus: researchPipeline.status,
    queryCount: researchPipeline.generatedQueries.length,
    rawResultCount: researchPipeline.rawResultCount,
    extractedCount: researchPipeline.extractedCount,
    warning: researchPipeline.searchWarning
  };
}

async function buildResearchPipeline(plan, knowledgeContext, clientResearchContext, env) {
  const generatedQueries = [...new Set([...(clientResearchContext?.generatedQueries || []), ...queryBuilder(plan, knowledgeContext)])].slice(0, 6);
  const search = await webResearchProvider.search(generatedQueries, env);
  const extracted = contentExtractor.extract(search.results);
  const cases = caseAnalyzer.analyze(extracted, plan);
  const scores = scoreSystem.estimate(plan, cases);
  const similarCases = similarityEngine.rank(plan, cases, scores).slice(0, 4);
  const patterns = patternAnalyzer.analyze(similarCases, extracted);
  const recommendations = actionGenerator.generate(plan, patterns, scores, similarCases);
  return {
    provider: search.provider,
    status: search.status,
    searchWarning: search.warning || '',
    generatedQueries,
    rawResultCount: search.results.length,
    extractedCount: extracted.length,
    extracted,
    cases: similarCases,
    patterns,
    scores,
    recommendations,
    notes: recommendations.researchNotes
  };
}

function queryBuilder(plan, knowledgeContext = null) {
  const text = joinText(plan.dreamTitle, plan.targetDescription, plan.currentSituation, plan.skills, plan.anxieties);
  const age = Number(plan.currentAge || 40);
  const ageWord = age >= 50 ? '50代' : age >= 40 ? '40代' : age >= 30 ? '30代' : '中高年';
  const category = inferCategoryWord(text, knowledgeContext);
  const local = /地方|田舎|地域|地元|ローカル/i.test(text);
  const family = /子供|子ども|家族|妻|夫|育児|親|介護/i.test(text);
  const sns = /SNS|投稿|発信|Instagram|Threads|X|Twitter|YouTube|ブログ|note/i.test(text);
  const craft = /CNC|加工|製造|ものづくり|工場|工房|機械|作品|木工|金属/i.test(text);
  return [...new Set([
    `${ageWord} 副業 ${category} 始め方 実例`,
    local ? `地方 起業 ${category} 小さく始める 事例` : `${category} 個人事業 小さく始める 事例`,
    family ? `家族あり 副業 ${category} 始め方` : `中高年 再挑戦 ${category} 始め方`,
    craft ? 'CNC 個人事業 SNS 集客 小受注' : `${category} SNS 発信 個人販売`,
    sns ? `${ageWord} SNS 発信 副業 事例` : `${ageWord} 副業 失敗しにくい 始め方`,
    '中高年 再挑戦 小さく始める 事例'
  ].map((q) => q.replace(/\s+/g, ' ').trim()))].slice(0, 6);
}

const webResearchProvider = {
  async search(queries, env) {
    if (getEnv(env, 'TAVILY_API_KEY')) return searchTavily(queries, env);
    if (getEnv(env, 'BRAVE_SEARCH_API_KEY')) return searchBrave(queries, env);
    if (getEnv(env, 'SERPAPI_API_KEY')) return searchSerpApi(queries, env);
    return { provider: 'none', status: 'missing_search_key', warning: 'TAVILY_API_KEY / BRAVE_SEARCH_API_KEY / SERPAPI_API_KEY のいずれかをWorker Secretsに追加してください。', results: [] };
  }
};

async function searchTavily(queries, env) {
  const apiKey = getEnv(env, 'TAVILY_API_KEY');
  const batches = await Promise.all(queries.slice(0, 4).map(async (query) => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: 'advanced', include_answer: false, include_raw_content: true, max_results: 4 })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((item) => ({
      query,
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || '',
      rawContent: item.raw_content || '',
      score: item.score || 0,
      source: sourceFromUrl(item.url || '')
    }));
  }));
  return { provider: 'tavily', status: 'ok', results: uniqueByUrl(batches.flat()).slice(0, 12) };
}
async function searchBrave(queries, env) {
  const apiKey = getEnv(env, 'BRAVE_SEARCH_API_KEY');
  const batches = await Promise.all(queries.slice(0, 4).map(async (query) => {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=4&country=jp&search_lang=ja`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.web?.results || []).map((item) => ({ query, title: item.title || '', url: item.url || '', snippet: stripHtml(item.description || ''), rawContent: '', score: 0, source: sourceFromUrl(item.url || '') }));
  }));
  return { provider: 'brave', status: 'ok', results: uniqueByUrl(batches.flat()).slice(0, 12) };
}
async function searchSerpApi(queries, env) {
  const apiKey = getEnv(env, 'SERPAPI_API_KEY');
  const batches = await Promise.all(queries.slice(0, 3).map(async (query) => {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=ja&gl=jp&api_key=${encodeURIComponent(apiKey)}&num=5`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.organic_results || []).map((item) => ({ query, title: item.title || '', url: item.link || '', snippet: item.snippet || '', rawContent: '', score: item.position ? 1 / item.position : 0, source: sourceFromUrl(item.link || '') }));
  }));
  return { provider: 'serpapi', status: 'ok', results: uniqueByUrl(batches.flat()).slice(0, 12) };
}

const contentExtractor = {
  extract(results) {
    return results.slice(0, 10).map((item) => {
      const text = cleanText(`${item.title}. ${item.snippet}. ${item.rawContent || ''}`).slice(0, 1600);
      return {
        title: cleanText(item.title).slice(0, 90),
        url: item.url,
        source: item.source || sourceFromUrl(item.url),
        query: item.query,
        text,
        firstStepHints: pickHints(text, ['投稿', '写真', '相談', '小さく', '販売', '受注', 'note', 'YouTube', 'Instagram', '試作']),
        riskHints: pickHints(text, ['初期投資', '在庫', '広告', '続かない', '時間', '家族', '不安', '比較', '赤字'])
      };
    }).filter((item) => item.text.length > 20);
  }
};
const caseAnalyzer = {
  analyze(extracted) {
    return extracted.map((item) => {
      const text = item.text;
      return {
        title: item.title,
        url: item.url,
        source: item.source,
        sourceType: classifySourceType(item, text),
        ageRange: detectAgeRange(text),
        category: inferCategoryWord(text),
        emotion: detectEmotions(text),
        firstStep: detectFirstStep(text),
        mistakes: detectMistakes(text),
        successPattern: detectSuccessPattern(text),
        quote: summarizeEvidence(text),
        similaritySignals: {
          family: /家族|子供|子ども|育児|介護/.test(text),
          local: /地方|地域|田舎|地元/.test(text),
          sns: /SNS|投稿|発信|Instagram|YouTube|note|ブログ|X|Twitter/.test(text),
          craft: /CNC|加工|製造|ものづくり|工房|工場|作品|ハンドメイド/.test(text),
          money: /資金|初期投資|お金|費用|赤字|低資金/.test(text)
        }
      };
    });
  }
};
const similarityEngine = {
  rank(plan, cases, scores) {
    const text = joinText(plan.dreamTitle, plan.currentSituation, plan.skills, plan.anxieties);
    return cases.map((item) => {
      let score = 20;
      if (detectAgeRange(`${text} ${plan.currentAge}代`) === item.ageRange) score += 16;
      if (/家族|子供|子ども|育児|介護/.test(text) && item.similaritySignals.family) score += 18;
      if (/地方|地域|田舎|地元/.test(text) && item.similaritySignals.local) score += 14;
      if (/SNS|投稿|発信|Instagram|YouTube|note|ブログ/.test(text) && item.similaritySignals.sns) score += 14;
      if (/CNC|加工|製造|ものづくり|工房|工場|作品/.test(text) && item.similaritySignals.craft) score += 18;
      if (/お金|資金|投資|費用|不安/.test(text) && item.similaritySignals.money) score += 14;
      if (scores.financialPressure > 75 && item.mistakes.includes('初期投資')) score += 10;
      return { ...item, similarityScore: Math.min(100, score) };
    }).sort((a, b) => b.similarityScore - a.similarityScore);
  }
};
const scoreSystem = {
  estimate(plan, cases) {
    const text = joinText(plan.dreamTitle, plan.targetDescription, plan.currentSituation, plan.availableTime, plan.availableMoney, plan.skills, plan.anxieties);
    const money = /不安|少ない|ない|月1万|大きく|投資|資金|費用/.test(text);
    const family = /子供|子ども|家族|育児|介護/.test(text);
    const skill = /経験|年|CNC|営業|接客|SNS|投稿|制作|加工|資格/.test(text);
    const fear = /怖い|不安|今さら|比較|自信/.test(text);
    const time = /分|少ない|忙しい|平日|週末/.test(text);
    return {
      financialPressure: clampScore((money ? 74 : 42) + (family ? 12 : 0)),
      executionPower: clampScore((skill ? 68 : 42) + (cases.length > 3 ? 6 : 0) - (time ? 8 : 0)),
      socialResistance: clampScore((fear ? 72 : 44) + (/SNS|投稿|発信/.test(text) ? 8 : 0)),
      burnoutRisk: clampScore((family ? 62 : 42) + (time ? 14 : 0) + (fear ? 8 : 0)),
      stabilityNeed: clampScore((family ? 78 : 52) + (money ? 12 : 0))
    };
  }
};
const patternAnalyzer = {
  analyze(similarCases, extracted) {
    const steps = mostCommon(similarCases.flatMap((item) => item.successPattern));
    const mistakes = mostCommon(similarCases.flatMap((item) => item.mistakes));
    const firstSteps = mostCommon(similarCases.map((item) => item.firstStep));
    return {
      similarFlow: [firstSteps[0] || '今あるものを見せる', steps[0] || '近い人に少し見せる', steps[1] || '短い投稿を残す', steps[2] || '必要なら小さく売る'],
      commonMistakes: mistakes.length ? mistakes.slice(0, 4) : ['初期投資', '情報集めだけで止まる', '広く見せすぎる'],
      evidenceText: extracted.slice(0, 3).map((item) => item.text.slice(0, 160))
    };
  }
};
const actionGenerator = {
  generate(plan, patterns, scores, similarCases) {
    const branches = recommendationBranches(plan, scores);
    return { branchReasons: branches, todayActions: branches.slice(0, 3).map((branch) => branch.action), researchNotes: buildResearchNotes(patterns, similarCases, scores), firstAction: branches[0].action };
  }
};
function recommendationBranches(plan, scores) {
  const text = joinText(plan.dreamTitle, plan.currentSituation, plan.skills, plan.anxieties);
  const craft = /CNC|加工|製造|ものづくり|工房|工場|作品|ハンドメイド/.test(text);
  const sns = /SNS|投稿|発信|Instagram|Threads|YouTube|note|ブログ|X|Twitter/.test(text);
  const actions = [];
  if (scores.financialPressure > 80) actions.push({ reason: 'お金の圧が強い', action: { title: craft ? '過去作品を3つ写真に撮る' : '今ある実績を3つメモする', description: '新しく買わず、手元にあるものだけを使います。', estimatedMinutes: 10, whyThisAction: '先に出費を置かないほうが戻りやすいからです。', researchBasis: '似た人は、大きな支払いより先に見せられるものを出す流れが多いです。' } });
  if (scores.socialResistance > 70) actions.push({ reason: '人に見せる怖さが強い', action: { title: '信頼できる1人に一言だけ送る', description: '「これ少し考えてる」とだけ送ります。', estimatedMinutes: 5, whyThisAction: '広く見せる前に、怖さを小さくできるからです。', researchBasis: '似た事例では、最初から公開せず身近な反応を見る始め方があります。' } });
  if (scores.executionPower > 60 && sns) actions.push({ reason: '動ける力が少し残っている', action: { title: '1投稿だけ下書きする', description: '公開せず、写真1枚と一言だけ残します。', estimatedMinutes: 12, whyThisAction: '公開の重さを外して、形だけ作れるからです。', researchBasis: '発信系は、毎日投稿より少数の下書きから始まる流れがあります。' } });
  if (scores.stabilityNeed > 75) actions.push({ reason: '生活を守る必要が高い', action: { title: '使わない上限額を1行で決める', description: '今月はここまで、とメモに1行だけ書きます。', estimatedMinutes: 7, whyThisAction: '守る線があると、動く怖さが少し下がるからです。', researchBasis: '副業や小さな活動では、先に上限を置くと続けやすい例があります。' } });
  actions.push({ reason: 'まずこれだけ', action: { title: craft ? '作れるものを5個だけ書く' : 'できることを5個だけ書く', description: '売れるかは考えず、手元の経験だけを書きます。', estimatedMinutes: 8, whyThisAction: '頭の中だけに置くより、次の一歩が見えやすいからです。', researchBasis: '小さく始める人は、最初にできる範囲を狭く置く流れが多いです。' } });
  return actions.slice(0, 4);
}
function buildResearchNotes(patterns, similarCases, scores) {
  const top = similarCases[0];
  const second = similarCases[1];
  const risk = patterns.commonMistakes[0] || '初期投資';
  return [
    { title: top?.title || '似た人は、先に小さく見せている', topic: '市場では', finding: top?.quote || '似た領域では、完成品や大きな準備より先に、写真・相談・短い投稿から入る流れが見えます。', sourceType: 'market', whyItMatters: '今日の一歩を、手元のものから始める理由になります。', confidence: top ? 'medium' : 'low', url: top?.url || '' },
    { title: second?.title || '似た人はこう始めている', topic: '似た人の流れ', finding: second?.quote || `流れは「${patterns.similarFlow.slice(0, 3).join(' → ')}」に近い形が多いです。`, sourceType: 'case', whyItMatters: 'いきなり広げず、戻れる順番を作れます。', confidence: second ? 'medium' : 'low', url: second?.url || '' },
    { title: '先に重くしすぎない', topic: '落とし穴', finding: `${risk}で止まりやすい情報が見えます。お金の圧は ${scores.financialPressure} / 100 と高めです。`, sourceType: 'risk', whyItMatters: '最初の一歩を、お金を使わない形に寄せます。', confidence: similarCases.length ? 'medium' : 'low', url: top?.url || '' }
  ];
}

async function editWithOpenAI(plan, knowledgeContext, researchPipeline, env, apiKey) {
  const model = getEnv(env, 'OPENAI_MODEL') || DEFAULT_MODEL;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_output_tokens: 4200,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt() }] },
        { role: 'user', content: [{ type: 'input_text', text: `DreamPlan JSON:\n${JSON.stringify(plan)}\n\nKnowledgeContext JSON:\n${JSON.stringify(knowledgeContext || {})}\n\nResearchPipeline JSON:\n${JSON.stringify(researchPipeline)}` }] }
      ],
      text: { format: { type: 'json_object' } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${shorten(await response.text(), 500)}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
  if (!text) throw new Error('OpenAI response did not include output_text.');
  return JSON.parse(text);
}
function systemPrompt() {
  return [
    'あなたはEditor AIです。分析はWorker側のResearchPipelineで完了しています。',
    'ResearchPipelineのnotes, cases, patterns, scores, recommendationsを必ず使い、一般論だけで作らない。',
    '成功を断言しない。説教しない。自己啓発っぽくしない。1文を短く。',
    'ユーザー表示で避ける語: 資産, 制約, 検証, KPI, 最適化, フェーズ, 実行, 解像度, 未達成, ノルマ。',
    '返すのはJSONだけ。Markdownは禁止。',
    '必須JSON schema:',
    '{"conclusion":{"title":"","body":"","tags":[]},"summary":"","possibilityLevel":"low | medium | high","message":"","reasoning":"","observedFacts":[{"label":"","value":"","whyItMatters":""}],"emotionalInsight":{"summary":"","plainSummary":"","detectedConflict":"","gentleMessage":""},"researchNotes":[{"title":"","topic":"","finding":"","sourceType":"market | case | risk | trend","whyItMatters":"","confidence":"low | medium | high","url":""}],"existingAssets":[{"title":"","description":""}],"risks":[{"title":"","description":"","avoidance":""}],"detectedBlocks":[{"title":"","description":"","plainDescription":"","softCounterAction":""}],"reasoningLinks":[{"fact":"","research":"","therefore":""}],"todayActions":[{"title":"","description":"","estimatedMinutes":10,"emotionalMessage":"","actionReason":"","whyThisAction":"","researchBasis":""}],"phaseTimeline":[{"phase":"","title":"","goal":"","smallAction":"","reason":"","whyNow":"","researchBasis":""}],"similarPatterns":[{"label":"","summary":"","timeline":[],"evidence":""}],"commonMistakes":[{"label":"","whyCommon":"","softAvoidance":""}],"visualSummary":{"currentState":[],"assets":[],"blocks":[],"nextSteps":[]},"scores":{"financialPressure":0,"executionPower":0,"socialResistance":0,"burnoutRisk":0,"stabilityNeed":0},"shareText":""}'
  ].join('\n');
}

function normalizeAnalysis(value, plan, knowledgeContext, researchPipeline) {
  const fallback = buildFallbackAnalysis(plan, knowledgeContext, researchPipeline);
  const v = value && typeof value === 'object' ? value : {};
  const todayActions = normalizeToday(v.todayActions, fallback.todayActions);
  return {
    conclusion: normalizeConclusion(v.conclusion, fallback.conclusion),
    summary: str(v.summary, fallback.summary),
    possibilityLevel: ['low', 'medium', 'high'].includes(v.possibilityLevel) ? v.possibilityLevel : fallback.possibilityLevel,
    message: str(v.message, fallback.message),
    reasoning: str(v.reasoning, fallback.reasoning),
    observedFacts: arr(v.observedFacts || v.evidence, fallback.observedFacts),
    evidence: arr(v.evidence || v.observedFacts, fallback.evidence),
    emotionalInsight: {
      summary: str(v.emotionalInsight?.summary || v.emotionalInsight?.plainSummary, fallback.emotionalInsight.summary),
      plainSummary: str(v.emotionalInsight?.plainSummary || v.emotionalInsight?.summary, fallback.emotionalInsight.plainSummary),
      detectedConflict: str(v.emotionalInsight?.detectedConflict, fallback.emotionalInsight.detectedConflict),
      gentleMessage: str(v.emotionalInsight?.gentleMessage, fallback.emotionalInsight.gentleMessage)
    },
    researchNotes: arr(v.researchNotes, fallback.researchNotes).slice(0, 3),
    existingAssets: arr(v.existingAssets, fallback.existingAssets).slice(0, 3),
    risks: arr(v.risks, fallback.risks).slice(0, 3),
    detectedBlocks: arr(v.detectedBlocks || v.blocks, fallback.detectedBlocks).slice(0, 4),
    reasoningLinks: arr(v.reasoningLinks, fallback.reasoningLinks).slice(0, 4),
    todayActions,
    phaseTimeline: arr(v.phaseTimeline, fallback.phaseTimeline).slice(0, 4),
    worldContext: fallback.worldContext,
    similarPatterns: arr(v.similarPatterns, fallback.similarPatterns).slice(0, 2),
    commonMistakes: arr(v.commonMistakes, fallback.commonMistakes).slice(0, 3),
    visualSummary: v.visualSummary || fallback.visualSummary,
    scores: v.scores || fallback.scores,
    shareText: str(v.shareText, `今からでも遅くないかもしれない。\n今日の一歩：${todayActions[0]?.title || 'まずこれだけ'}。`),
    roadmap: []
  };
}

function buildFallbackAnalysis(plan, knowledgeContext, researchPipeline) {
  const notes = normalizeResearchNotes(researchPipeline.notes);
  const scores = enrichScores(plan, researchPipeline.scores || scoreSystem.estimate(plan, []));
  const actions = researchPipeline.recommendations?.todayActions?.length ? researchPipeline.recommendations.todayActions.slice(0, 3) : recommendationBranches(plan, scores).map((x) => x.action).slice(0, 3);
  const flow = researchPipeline.patterns?.similarFlow?.length ? researchPipeline.patterns.similarFlow : ['今あるものを外に出す', '近い人に少し見せる', '短い投稿を残す', '必要なら小さく売る'];
  const mistakes = researchPipeline.patterns?.commonMistakes?.length ? researchPipeline.patterns.commonMistakes : ['大きく始めすぎる', '情報集めだけで止まる', '広く見せすぎる'];
  const category = inferCategoryWord(joinText(plan.dreamTitle, plan.skills), knowledgeContext);
  return {
    conclusion: { title: '大きく決める前に、今あるものを外に出すのがよさそうです。', body: `${category}では、先にお金や場所を決めるより、小さく見せて反応を知る始め方が多いです。`, tags: [category, `${actions[0]?.estimatedMinutes || 10}分`, '無理しない'] },
    summary: `「${plan.dreamTitle}」は、いきなり大きく動かすより、今あるものを見せる形から始めるほうが軽そうです。`,
    possibilityLevel: 'medium',
    message: '確実とは言えません。でも、今日できそうな小さい一歩は作れます。',
    reasoning: `${researchPipeline.provider}の検索結果をもとに、似た始め方と止まりやすい所を見ました。`,
    observedFacts: buildFacts(plan),
    evidence: buildFacts(plan).map((x) => ({ label: x.label, quote: x.value, interpretation: x.whyItMatters })),
    emotionalInsight: { summary: '動きたい気持ちと、怖さが同時にあります。', plainSummary: '動きたい気持ちと、怖さが同時にあります。', detectedConflict: `「${shorten(plan.anxieties, 42)}」があるので、いきなり大きく始めると重くなりそうです。`, gentleMessage: '止まっていた時間は、なくなった時間ではありません。' },
    researchNotes: notes,
    existingAssets: [{ title: 'これまでの経験', description: shorten(plan.skills, 90) }, { title: '今の状況を言葉にできていること', description: shorten(plan.currentSituation, 90) }, { title: '使える時間とお金を見ていること', description: `${shorten(plan.availableTime, 36)} / ${shorten(plan.availableMoney, 36)}` }],
    risks: mistakes.slice(0, 3).map((label) => ({ title: label, description: '似た情報の中で、ここで止まりやすい流れが見えました。', avoidance: '今日できそうな小さい行動へ戻します。' })),
    detectedBlocks: [{ title: 'お金の不安', description: `「${shorten(plan.availableMoney, 32)}」があるので、出費を先に置くと重くなります。`, plainDescription: `「${shorten(plan.availableMoney, 32)}」があるので、出費を先に置くと重くなります。`, softCounterAction: '0円で見せられるものを1つ選ぶ。' }, { title: '今さら感', description: `「${shorten(plan.anxieties, 32)}」があると、比べる相手を間違えやすいです。`, plainDescription: `「${shorten(plan.anxieties, 32)}」があると、比べる相手を間違えやすいです。`, softCounterAction: '生活が近い人を3人だけ保存する。' }],
    reasoningLinks: [{ fact: `経験: ${shorten(plan.skills, 34)}`, research: notes[0]?.finding || '似た人は、手元のものを見せる所から始めています。', therefore: actions[0]?.title || '今あるものを外に出します。' }, { fact: `お金: ${shorten(plan.availableMoney, 28)}`, research: notes[2]?.finding || '先に重くすると戻りにくくなります。', therefore: '今日はお金を使わない一歩にします。' }],
    todayActions: normalizeToday(actions, actions),
    phaseTimeline: flow.slice(0, 4).map((title, index) => ({ phase: index === 0 ? '今ここ' : `次${index}`, title, goal: index === 0 ? '手元の経験を見える形にする。' : '無理なく次へ進む。', smallAction: actions[index]?.title || actions[0]?.title || 'メモを1つ書く', reason: '大きく決める前に戻れる形を残すためです。', whyNow: '大きく決める前に戻れる形を残すためです。', researchBasis: notes[index % notes.length]?.finding || '似た人は、小さく見せる流れから始めています。' })),
    worldContext: { label: category, commonStarts: [notes[0]?.finding || '手元のものを見せる流れが多いです。'], commonFlow: flow, commonMistakes: mistakes },
    similarPatterns: [{ label: '似た人はこう始めている', summary: flow.slice(0, 3).join(' → '), timeline: flow, evidence: notes[1]?.finding || '' }],
    commonMistakes: mistakes.slice(0, 3).map((label) => ({ label, whyCommon: '似た情報の中で、ここで止まりやすい流れが見えました。', softAvoidance: '今日できそうな小さい行動へ戻します。' })),
    visualSummary: { currentState: ['止まっていた', '少し動きたい', '不安もある'], assets: ['経験', '使える時間', '過去に続いたこと'], blocks: mistakes.slice(0, 3), nextSteps: actions.map((x) => x.title) },
    scores,
    shareText: `今からでも遅くないかもしれない。\n今日の一歩：${actions[0]?.title || 'まずこれだけ'}。`,
    roadmap: []
  };
}

function normalizeToday(value, fallback) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source.slice(0, 3).map((x, i) => ({
    title: str(x.title || x.action || x.step, fallback[i]?.title || 'まずこれだけ'),
    description: str(x.description || x.detail, fallback[i]?.description || '今日できそうな形にします。'),
    estimatedMinutes: Number(x.estimatedMinutes || x.minutes || fallback[i]?.estimatedMinutes || 10),
    emotionalMessage: str(x.emotionalMessage || x.message, fallback[i]?.emotionalMessage || '無理しなくて大丈夫です。'),
    actionReason: str(x.actionReason || x.whyThisAction || x.reason, fallback[i]?.actionReason || fallback[i]?.whyThisAction || '今あるものから始められるため。'),
    whyThisAction: str(x.whyThisAction || x.actionReason || x.reason, fallback[i]?.whyThisAction || fallback[i]?.actionReason || '今あるものから始められるため。'),
    researchBasis: str(x.researchBasis || x.basis || x.research, fallback[i]?.researchBasis || '似た人は小さく見せる流れから始めています。')
  }));
}
function normalizeConclusion(value, fallback) { value = value && typeof value === 'object' ? value : {}; return { title: str(value.title || value.summary, fallback.title), body: str(value.body || value.description, fallback.body), tags: arr(value.tags, fallback.tags).slice(0, 4) }; }
function normalizeResearchNotes(notes) {
  const safe = arr(notes, []).slice(0, 3);
  const fallback = [
    { title: '似た人は、先に小さく見せている', topic: '市場では', finding: '検索結果が少ないため、取得できた情報だけで控えめに整理しています。', sourceType: 'market', whyItMatters: '今日の一歩を軽くするためです。', confidence: 'low', url: '' },
    { title: '似た人はこう始めている', topic: '似た人の流れ', finding: '大きく決める前に、近い人へ少し見せる流れが合いやすいです。', sourceType: 'case', whyItMatters: '戻れる順番を残せます。', confidence: 'low', url: '' },
    { title: '先に重くしすぎない', topic: '落とし穴', finding: '初期投資や広い公開を先に置くと重くなりやすいです。', sourceType: 'risk', whyItMatters: 'お金を使わない一歩へ寄せます。', confidence: 'low', url: '' }
  ];
  return [0, 1, 2].map((i) => ({ ...fallback[i], ...(safe[i] || {}), topic: (safe[i]?.topic || fallback[i].topic) }));
}
function buildFacts(plan) { return [{ label: 'やりたいこと', value: plan.dreamTitle, whyItMatters: '最初の行動をこの内容に合わせます。' }, { label: '年齢', value: `${plan.currentAge}歳`, whyItMatters: '急ぎすぎない形を選ぶためです。' }, { label: '今の状況', value: plan.currentSituation, whyItMatters: '無理のない大きさを決める手がかりです。' }, { label: '使える時間', value: plan.availableTime || '未入力', whyItMatters: '5〜15分の一歩に分ける理由になります。' }, { label: '使えるお金', value: plan.availableMoney || '未入力', whyItMatters: '大きな出費を先に置かない理由になります。' }, { label: '経験', value: plan.skills || '未入力', whyItMatters: '新しく作る前に、今あるものを出せるか見ます。' }, { label: '不安', value: plan.anxieties || '未入力', whyItMatters: '止まりやすい所を先に小さくします。' }]; }
function enrichScores(plan, scores) { const text = joinText(plan.dreamTitle, plan.targetDescription, plan.currentSituation, plan.availableTime, plan.availableMoney, plan.skills, plan.anxieties); const money = /不安|投資|資金|費用|月1万|大き/.test(text); const family = /子供|子ども|家族|育児|介護/.test(text); const fear = /今さら|怖い|不安|比較|自信/.test(text); const time = /忙しい|平日|週末|分|少ない/.test(text); return { financialPressure: clampScore(Math.max(scores.financialPressure || 0, (money ? 74 : 42) + (family ? 12 : 0))), executionPower: clampScore(scores.executionPower || 50), socialResistance: clampScore(Math.max(scores.socialResistance || 0, (fear ? 72 : 44) + (/SNS|投稿|発信/.test(text) ? 8 : 0))), burnoutRisk: clampScore(Math.max(scores.burnoutRisk || 0, (family ? 62 : 42) + (time ? 14 : 0) + (fear ? 8 : 0))), stabilityNeed: clampScore(Math.max(scores.stabilityNeed || 0, (family ? 78 : 52) + (money ? 12 : 0))) }; }
function inferCategoryWord(text, knowledgeContext = null) { const label = knowledgeContext?.categoryMatch?.label; if (label) return label; if (/CNC|加工|製造|工場|工房|ものづくり|機械|作品|ハンドメイド/i.test(text)) return 'ものづくり'; if (/カフェ|飲食|料理|お店/i.test(text)) return '飲食'; if (/SNS|投稿|発信|YouTube|Instagram|note|ブログ/i.test(text)) return '発信'; if (/講師|教える|コーチ|相談/i.test(text)) return '教える仕事'; return '副業'; }
function classifySourceType(item, text) { if (/失敗|注意|リスク|やめた|赤字|後悔|初期投資/.test(text)) return 'risk'; if (/事例|体験|始めた|インタビュー|note|reddit|youtube/.test(`${item.source} ${text}`.toLowerCase())) return 'case'; if (/市場|トレンド|増加|需要|人気/.test(text)) return 'trend'; return 'market'; }
function detectAgeRange(text) { if (/60代/.test(text)) return '60s'; if (/50代/.test(text)) return '50s'; if (/40代/.test(text)) return '40s'; if (/30代/.test(text)) return '30s'; return 'unknown'; }
function detectEmotions(text) { const out = []; if (/今さら|遅い|年齢/.test(text)) out.push('今さら感'); if (/比較|SNS疲れ|周り/.test(text)) out.push('比較疲れ'); if (/家族|子供|子ども|介護|生活/.test(text)) out.push('家族責任'); if (/不安|怖い|失敗|赤字/.test(text)) out.push('不安'); return out.slice(0, 4); }
function detectFirstStep(text) { return [['投稿', '短い投稿'], ['写真', '写真を出す'], ['相談', '身近な人に相談'], ['販売', '小さな販売'], ['受注', '小さな受注'], ['試作', '試作を見せる'], ['note', 'noteを書く'], ['YouTube', '動画を1本出す']].find(([k]) => text.includes(k))?.[1] || '今あるものを見せる'; }
function detectMistakes(text) { const out = []; if (/初期投資|設備|物件|仕入れ|在庫|広告費/.test(text)) out.push('初期投資'); if (/続かない|時間がない|忙しい/.test(text)) out.push('時間で止まる'); if (/比較|SNS疲れ|伸びない/.test(text)) out.push('比較で疲れる'); if (/情報収集|調べすぎ|迷う/.test(text)) out.push('情報集めだけで止まる'); return out.length ? out : ['大きく始めすぎる']; }
function detectSuccessPattern(text) { const out = []; if (/写真|作品|実績/.test(text)) out.push('今あるものを見せる'); if (/相談|知人|友人|家族|コミュニティ/.test(text)) out.push('近い人に見せる'); if (/SNS|投稿|発信|note|ブログ|YouTube/.test(text)) out.push('短く発信する'); if (/受注|販売|小さく|少額/.test(text)) out.push('小さく売る'); if (/地域|地方|地元/.test(text)) out.push('地域に寄せる'); return out.length ? out : ['戻れる形で始める']; }
function summarizeEvidence(text) { const sentences = text.split(/[。.!?\n]/).map(cleanText).filter((s) => s.length > 18); return shorten(sentences.find((s) => /始め|投稿|写真|相談|初期投資|副業|地方|家族|40代|50代|SNS|販売|受注/.test(s)) || sentences[0] || text, 92); }
function stripHtml(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function cleanText(value) { return stripHtml(value).replace(/\s+/g, ' ').trim(); }
function pickHints(text, words) { return words.filter((word) => text.includes(word)).slice(0, 6); }
function sourceFromUrl(url) { try { const host = new URL(url).hostname.replace(/^www\./, ''); if (host.includes('reddit')) return 'Reddit'; if (host.includes('note.com')) return 'note'; if (host.includes('youtube')) return 'YouTube'; if (host.includes('threads')) return 'Threads'; if (host.includes('x.com') || host.includes('twitter')) return 'X'; return host; } catch (_) { return 'web'; } }
function uniqueByUrl(results) { const seen = new Set(); return results.filter((item) => { if (!item.url || seen.has(item.url)) return false; seen.add(item.url); return true; }); }
function mostCommon(items) { const counts = new Map(); items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item); }
function str(value, fallback) { return typeof value === 'string' && value.trim() ? value : fallback; }
function arr(value, fallback) { return Array.isArray(value) && value.length ? value : fallback; }
function joinText(...values) { return values.map((v) => String(v || '')).join(' '); }
function clampScore(value) { return Math.max(0, Math.min(100, Math.round(value))); }
function shorten(value, max) { const text = String(value || '').trim(); return text.length > max ? `${text.slice(0, max)}...` : text; }
function getEnv(env, name) { if (env[name]) return env[name]; const key = Object.keys(env).find((item) => item.trim() === name); return key ? env[key] : undefined; }
function sanitizeError(error) { return String(error?.message || error || 'Unknown error').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]').replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]'); }
