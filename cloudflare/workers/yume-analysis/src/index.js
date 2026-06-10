const DEFAULT_MODEL = 'gpt-5-mini';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    const debug = new URL(request.url).searchParams.get('debug') === '1';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);

    let plan;
    try {
      const payload = await request.json();
      plan = payload?.plan || payload;
      for (const key of ['dreamTitle', 'currentAge', 'targetAge', 'currentSituation']) {
        if (plan?.[key] === undefined || plan?.[key] === null || plan?.[key] === '') throw new Error(`Missing ${key}`);
      }
    } catch (_) {
      return json({ error: 'Invalid DreamPlan payload.' }, 400, cors);
    }

    const pipeline = await researchPipeline(plan, env);
    const base = buildAnalysis(plan, pipeline);
    if (!env.OPENAI_API_KEY) return json({ source: 'worker-voice-research', ...(debug ? { debug: debugPayload(env, pipeline) } : {}), ...base }, 200, cors);

    try {
      const edited = await editWithOpenAI(plan, pipeline, base, env);
      return json({ source: 'openai-voice-research', ...(debug ? { debug: debugPayload(env, pipeline) } : {}), ...mergeAnalysis(edited, base) }, 200, cors);
    } catch (error) {
      return json({ source: 'worker-voice-research', warning: sanitizeError(error), ...(debug ? { debug: debugPayload(env, pipeline) } : {}), ...base }, 200, cors);
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

async function researchPipeline(plan, env) {
  const queries = buildQueries(plan).slice(0, 10);
  const search = await searchWeb(queries, env);
  const extracted = extract(search.results);
  const cases = analyzeCases(extracted);
  const scores = scorePlan(plan, cases);
  const ranked = rankCases(plan, cases, scores).slice(0, 5);
  const patterns = analyzePatterns(ranked);
  return {
    provider: search.provider,
    status: search.status,
    warning: search.warning || '',
    generatedQueries: queries,
    rawResultCount: search.results.length,
    extractedCount: extracted.length,
    cases: ranked,
    patterns,
    scores,
    notes: buildNotes(ranked, patterns, scores)
  };
}

function buildQueries(plan) {
  const text = join(plan.dreamTitle, plan.targetDescription, plan.currentSituation, plan.skills, plan.anxieties);
  const age = Number(plan.currentAge || 40);
  const ageWord = age >= 50 ? '50代' : age >= 40 ? '40代' : age >= 30 ? '30代' : '中高年';
  const category = inferCategory(text);
  const local = /地方|田舎|地域|地元|ローカル/.test(text);
  const family = /子供|子ども|家族|妻|夫|育児|親|介護/.test(text);
  const craft = /CNC|加工|製造|ものづくり|工場|工房|機械|作品|木工|金属|ハンドメイド/.test(text);
  const sns = /SNS|投稿|発信|Instagram|Threads|X|Twitter|YouTube|ブログ|note/.test(text);
  const base = [
    `${ageWord} ${category} 怖い 体験談`,
    `${ageWord} ${category} 不安 始めたいけど`,
    local ? `地方 副業 不安 ${category} 体験談` : `${category} 副業 不安 体験談`,
    family ? `家族あり 起業 迷い ${category}` : `中年 やり直したい ${category}`,
    craft ? 'ものづくり 食べていけない 体験談' : `${category} 食べていけない 不安`,
    sns ? 'SNS 投稿 恥ずかしい 副業 体験談' : `${ageWord} 起業 怖い 体験談`
  ];
  const sources = ['site:reddit.com', 'site:threads.net', 'site:youtube.com comments', 'site:note.com', 'site:chiebukuro.yahoo.co.jp', 'site:quora.com', 'site:komachi.yomiuri.co.jp', '個人ブログ'];
  return [...new Set([...sources.map((source, index) => `${base[index % base.length]} ${source}`), ...base].map((q) => q.replace(/\s+/g, ' ').trim()))];
}

async function searchWeb(queries, env) {
  if (!env.TAVILY_API_KEY) return { provider: 'none', status: 'missing_search_key', warning: 'TAVILY_API_KEY is missing.', results: [] };
  const batches = await Promise.all(queries.slice(0, 8).map(async (query) => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: 'advanced', include_answer: false, include_raw_content: true, max_results: 5 })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((item) => {
      const text = `${item.title || ''} ${item.content || ''} ${item.raw_content || ''}`;
      const url = item.url || '';
      return { query, title: item.title || '', url, snippet: item.content || '', rawContent: item.raw_content || '', score: item.score || 0, source: sourceName(url), sourceKind: sourceKind(url), sourceScore: sourceScore(url, text) };
    });
  }));
  return { provider: 'tavily', status: 'ok', results: rankRaw(uniqueByUrl(batches.flat())).slice(0, 14) };
}

function extract(results) {
  return results.slice(0, 10).map((item) => {
    const text = clean(`${item.title}. ${item.snippet}. ${item.rawContent || ''}`).slice(0, 1800);
    return { title: clean(item.title).slice(0, 90), url: item.url, source: item.source, sourceKind: item.sourceKind, sourceScore: item.sourceScore, query: item.query, text };
  }).filter((item) => item.text.length > 20);
}

function analyzeCases(extracted) {
  return extracted.map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    sourceKind: item.sourceKind,
    sourceScore: item.sourceScore,
    sourceType: classifySource(item),
    ageRange: detectAge(item.text),
    category: inferCategory(item.text),
    emotion: detectEmotions(item.text),
    firstStep: detectFirstStep(item.text),
    mistakes: detectMistakes(item.text),
    successPattern: detectPattern(item.text),
    voice: summarizeVoice(item.text),
    quote: summarizeEvidence(item.text),
    signals: {
      family: /家族|子供|子ども|育児|介護/.test(item.text),
      local: /地方|地域|田舎|地元/.test(item.text),
      sns: /SNS|投稿|発信|Instagram|YouTube|note|ブログ|X|Twitter|Threads/.test(item.text),
      craft: /CNC|加工|製造|ものづくり|工房|工場|作品|ハンドメイド/.test(item.text),
      money: /資金|初期投資|お金|費用|赤字|低資金|食べていけ/.test(item.text)
    }
  }));
}

function scorePlan(plan, cases) {
  const text = join(plan.dreamTitle, plan.targetDescription, plan.currentSituation, plan.availableTime, plan.availableMoney, plan.skills, plan.anxieties);
  const money = /不安|少ない|ない|月1万|大きく|投資|資金|費用/.test(text);
  const family = /子供|子ども|家族|育児|介護/.test(text);
  const skill = /経験|年|CNC|営業|接客|SNS|投稿|制作|加工|資格/.test(text);
  const fear = /怖い|不安|今さら|比較|失敗|自信|恥ずかしい/.test(text);
  const time = /分|少ない|忙しい|平日|週末/.test(text);
  return { financialPressure: clamp((money ? 74 : 42) + (family ? 12 : 0)), executionPower: clamp((skill ? 68 : 42) + (cases.length > 3 ? 6 : 0) - (time ? 8 : 0)), socialResistance: clamp((fear ? 72 : 44) + (/SNS|投稿|発信/.test(text) ? 8 : 0)), burnoutRisk: clamp((family ? 62 : 42) + (time ? 14 : 0) + (fear ? 8 : 0)), stabilityNeed: clamp((family ? 78 : 52) + (money ? 12 : 0)) };
}

function rankCases(plan, cases, scores) {
  const text = join(plan.dreamTitle, plan.currentSituation, plan.skills, plan.anxieties);
  return cases.map((item) => {
    let score = 20 + Math.round((item.sourceScore || 50) / 4);
    if (detectAge(`${text} ${plan.currentAge}代`) === item.ageRange) score += 12;
    if (/家族|子供|育児|介護/.test(text) && item.signals.family) score += 16;
    if (/地方|地域|田舎|地元/.test(text) && item.signals.local) score += 12;
    if (/SNS|投稿|発信|Instagram|YouTube|note|ブログ/.test(text) && item.signals.sns) score += 12;
    if (/CNC|加工|製造|ものづくり|工房|工場|作品/.test(text) && item.signals.craft) score += 16;
    if (/お金|資金|投資|費用|不安/.test(text) && item.signals.money) score += 12;
    if (scores.financialPressure > 75 && item.mistakes.includes('初期投資')) score += 8;
    return { ...item, similarityScore: clamp(score) };
  }).sort((a, b) => b.similarityScore - a.similarityScore);
}

function analyzePatterns(cases) {
  const flow = mostCommon(cases.flatMap((item) => item.successPattern)).slice(0, 4);
  const mistakes = mostCommon(cases.flatMap((item) => item.mistakes)).slice(0, 4);
  const firstSteps = mostCommon(cases.map((item) => item.firstStep)).slice(0, 4);
  return { similarFlow: [firstSteps[0] || '今あるものを見せる', flow[0] || '近い人に少し見せる', flow[1] || '短い投稿を残す', flow[2] || '必要なら小さく売る'], commonMistakes: mistakes.length ? mistakes : ['初期投資', '情報集めだけで止まる', '広く見せすぎる'] };
}

function buildNotes(cases, patterns, scores) {
  const top = cases[0];
  const second = cases[1];
  const risk = patterns.commonMistakes[0] || '初期投資';
  return [
    { title: top?.title || '似た人は、先に小さく見せている', finding: top?.voice || top?.quote || '似た領域では、完成品や大きな準備より先に、写真・相談・短い投稿から入る声が見えます。', sourceType: 'case', whyItMatters: '統計よりも、同じように迷った人の入口を見ています。', confidence: top?.sourceScore >= 75 ? 'high' : top ? 'medium' : 'low', url: top?.url || '', sourceName: top?.source || '', sourceKind: top?.sourceKind || 'web', sourceScore: top?.sourceScore || 0 },
    { title: second?.title || '実際に多かった流れ', finding: second?.voice || second?.quote || `「${patterns.similarFlow.slice(0, 3).join(' → ')}」に近い始め方が多いです。`, sourceType: 'case', whyItMatters: 'いきなり広げず、戻れる順番を作れます。', confidence: second?.sourceScore >= 75 ? 'high' : second ? 'medium' : 'low', url: second?.url || '', sourceName: second?.source || '', sourceKind: second?.sourceKind || 'web', sourceScore: second?.sourceScore || 0 },
    { title: 'よく止まるところ', finding: `${risk}で止まりやすい声が見えます。お金の重さは ${scores.financialPressure} / 100 です。`, sourceType: 'risk', whyItMatters: '最初の一歩を、お金を使わない形に寄せます。', confidence: cases.length ? 'medium' : 'low', url: top?.url || '', sourceName: top?.source || '', sourceKind: top?.sourceKind || 'web', sourceScore: top?.sourceScore || 0 }
  ];
}

function buildAnalysis(plan, pipeline) {
  const notes = pipeline.notes;
  const scores = pipeline.scores;
  const actions = buildActions(plan, scores);
  const flow = pipeline.patterns.similarFlow;
  const mistakes = pipeline.patterns.commonMistakes;
  const category = inferCategory(join(plan.dreamTitle, plan.skills));
  return {
    conclusion: { title: '今あるものを、いきなり広く出さない形がよさそうです。', body: `${category}では、怖さや不安を抱えたまま、身近な人・写真・短い投稿から始める声が多めです。`, tags: ['似た人の声', `${actions[0].estimatedMinutes}分`, '無理しない'] },
    observedFacts: [{ label: 'やりたいこと', value: plan.dreamTitle, whyItMatters: '探す声の方向をここに合わせます。' }, { label: '今の状況', value: plan.currentSituation, whyItMatters: '生活を壊さない一歩にするためです。' }, { label: '使える時間', value: plan.availableTime || '未入力', whyItMatters: '5〜15分で切れる行動にします。' }, { label: '使えるお金', value: plan.availableMoney || '未入力', whyItMatters: '先に大きく払わない理由になります。' }, { label: '経験', value: plan.skills || '未入力', whyItMatters: '新しく作る前に、今あるものを使えるか見ます。' }, { label: '不安', value: plan.anxieties || '未入力', whyItMatters: '止まる場所を先に小さくします。' }],
    emotionalInsight: { plainSummary: '動きたい気持ちと、見られる怖さが同時にありそうです。', detectedConflict: `「${short(plan.anxieties, 44)}」があるので、いきなり公開や出費に進むと重くなりそうです。`, gentleMessage: '止まっていた時間は、なくなった時間ではありません。' },
    researchNotes: notes,
    detectedBlocks: [{ title: 'お金の不安', plainDescription: `「${short(plan.availableMoney, 32)}」があるので、出費から入ると重くなります。`, softCounterAction: '0円で見せられるものを1つ選ぶ。' }, { title: '見られる怖さ', plainDescription: '広く公開する前に、気持ちが止まりやすいです。', softCounterAction: '信頼できる1人だけに見せる。' }, { title: '比べてしまう感じ', plainDescription: '遠い成功例を見ると、自分だけ遅い気がしやすいです。', softCounterAction: '生活が近い人だけを3人保存する。' }],
    reasoningLinks: [{ fact: `経験: ${short(plan.skills, 34)}`, research: notes[0]?.finding || '似た人は手元のものから出しています。', therefore: actions[0].title }, { fact: `お金: ${short(plan.availableMoney, 28)}`, research: notes[2]?.finding || '先に重くすると止まりやすいです。', therefore: '今日はお金を使わない一歩にします。' }, { fact: `不安: ${short(plan.anxieties, 34)}`, research: notes[1]?.finding || '近い人にだけ見せる流れがあります。', therefore: '広く出す前の小さい共有にします。' }],
    todayActions: actions,
    phaseTimeline: flow.slice(0, 4).map((title, index) => ({ title, goal: index === 0 ? '手元の経験を見える形にする。' : '無理なく次へ進む。', smallAction: actions[index]?.title || actions[0].title, whyNow: '戻れる形を残すためです。', researchBasis: notes[index % notes.length]?.finding || '似た人は小さく見せる所から始めています。' })),
    worldContext: { label: category, commonStarts: [notes[0]?.finding || '手元のものを見せる人が多いです。'], commonFlow: flow, commonMistakes: mistakes },
    similarPatterns: [{ label: '実際に多かった流れ', summary: flow.slice(0, 3).join(' → '), timeline: flow, evidence: notes[1]?.finding || '' }],
    commonMistakes: mistakes.slice(0, 3).map((label) => ({ label, whyCommon: '似た声の中で、ここで止まりやすい流れが見えました。', softAvoidance: '今日できそうな小さい行動へ戻します。' })),
    visualSummary: { currentState: ['止まっていた', '少し動きたい', '不安もある'], assets: ['経験', '使える時間', '過去に続いたこと'], blocks: mistakes.slice(0, 3), nextSteps: actions.map((x) => x.title) },
    scores,
    shareText: `今からでも遅くないかもしれない。\n今日の一歩：${actions[0].title}。`,
    roadmap: []
  };
}

function buildActions(plan, scores) {
  const text = join(plan.dreamTitle, plan.currentSituation, plan.skills, plan.anxieties);
  const craft = /CNC|加工|製造|ものづくり|工房|工場|作品|ハンドメイド/.test(text);
  const actions = [];
  if (scores.financialPressure > 78) actions.push({ title: craft ? '過去作品を3つ写真に撮る' : '今ある実績を3つメモする', description: '新しく買わず、手元にあるものだけを使います。', estimatedMinutes: 10, whyThisAction: '先に出費を置かないほうが戻りやすいからです。', researchBasis: '似た人は、大きな支払いより先に見せられるものを出す流れが多いです。' });
  if (scores.socialResistance > 68) actions.push({ title: '信頼できる1人に一言だけ送る', description: '「これ少し考えてる」とだけ送ります。', estimatedMinutes: 5, whyThisAction: '広く見せる前に、怖さを小さくできるからです。', researchBasis: '最初から公開せず、身近な反応を見る始め方があります。' });
  actions.push({ title: craft ? '作れるものを5個だけ書く' : 'できることを5個だけ書く', description: '売れるかは考えず、手元の経験だけを書きます。', estimatedMinutes: 8, whyThisAction: '頭の中だけに置くより、次の一歩が見えやすいからです。', researchBasis: '似た人は、最初にできる範囲を狭く置く流れが多いです。' });
  return actions.slice(0, 3);
}

async function editWithOpenAI(plan, pipeline, fallback, env) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OPENAI_MODEL || DEFAULT_MODEL, max_output_tokens: 3600, input: [{ role: 'system', content: [{ type: 'input_text', text: promptText() }] }, { role: 'user', content: [{ type: 'input_text', text: `DreamPlan:\n${JSON.stringify(plan)}\n\nResearchPipeline:\n${JSON.stringify(pipeline)}\n\nBaseAnalysis:\n${JSON.stringify(fallback)}` }] }], text: { format: { type: 'json_object' } } })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${short(await response.text(), 500)}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
  return JSON.parse(text);
}
function promptText() { return ['あなたは分析AIではなく、似た人の声を短く整理する編集係です。', 'ResearchPipeline の cases, notes, scores を必ず使う。AIだけの一般論は禁止。', 'sourceScore が高い一次情報、コメント、失敗談、感情のある声を優先する。', '企業LPやSEO記事は補助に留める。', '成功断言、自己啓発、コンサル語は禁止。', 'ユーザー表示で避ける語: 資産, 制約, 検証, KPI, 最適化, フェーズ, 実行, 解像度, 未達成, ノルマ, 失敗。', '使う語: 今あるもの, 止まってる理由, 小さく試す, 少し動く, 今の状況, 無理しない, 今日できそう, まずこれだけ。', 'JSONだけ返す。BaseAnalysisと同じキーを保つ。researchNotesのurl/sourceName/sourceKind/sourceScoreは消さない。'].join('\n'); }
function mergeAnalysis(value, fallback) { const v = value && typeof value === 'object' ? value : {}; return { ...fallback, ...v, conclusion: { ...fallback.conclusion, ...(v.conclusion || {}) }, emotionalInsight: { ...fallback.emotionalInsight, ...(v.emotionalInsight || {}) }, researchNotes: keepNotes(v.researchNotes, fallback.researchNotes), todayActions: Array.isArray(v.todayActions) && v.todayActions.length ? v.todayActions.slice(0, 3) : fallback.todayActions, phaseTimeline: Array.isArray(v.phaseTimeline) && v.phaseTimeline.length ? v.phaseTimeline.slice(0, 4) : fallback.phaseTimeline, similarPatterns: Array.isArray(v.similarPatterns) && v.similarPatterns.length ? v.similarPatterns.slice(0, 2) : fallback.similarPatterns, commonMistakes: Array.isArray(v.commonMistakes) && v.commonMistakes.length ? v.commonMistakes.slice(0, 3) : fallback.commonMistakes, roadmap: [] }; }
function keepNotes(value, fallback) { const notes = Array.isArray(value) && value.length ? value : fallback; return notes.slice(0, 3).map((note, i) => ({ ...fallback[i], ...note, url: note.url || fallback[i]?.url || '', sourceName: note.sourceName || fallback[i]?.sourceName || '', sourceKind: note.sourceKind || fallback[i]?.sourceKind || '', sourceScore: Number(note.sourceScore ?? fallback[i]?.sourceScore ?? 0) })); }
function classifySource(item) { if (/失敗|注意|リスク|やめた|赤字|後悔|初期投資|食べていけ/.test(item.text)) return 'risk'; if (/comment|social|personal|qa/.test(item.sourceKind)) return 'case'; if (/事例|体験|始めた|インタビュー|note|reddit|youtube/.test(`${item.source} ${item.text}`.toLowerCase())) return 'case'; if (/市場|トレンド|増加|需要|人気/.test(item.text)) return 'trend'; return 'market'; }
function detectAge(text) { if (/60代/.test(text)) return '60s'; if (/50代/.test(text)) return '50s'; if (/40代/.test(text)) return '40s'; if (/30代/.test(text)) return '30s'; return 'unknown'; }
function detectEmotions(text) { return [['今さら感', /今さら|遅い|年齢/], ['比較疲れ', /比較|SNS疲れ|周り/], ['家族責任', /家族|子供|子ども|介護|生活/], ['不安', /不安|怖い|失敗|赤字|恥ずかしい/]].filter(([, r]) => r.test(text)).map(([label]) => label).slice(0, 4); }
function detectFirstStep(text) { return [['投稿', '短い投稿'], ['写真', '写真を出す'], ['相談', '身近な人に相談'], ['販売', '小さな販売'], ['受注', '小さな受注'], ['試作', '試作を見せる'], ['note', 'noteを書く'], ['YouTube', '動画を1本出す']].find(([key]) => text.includes(key))?.[1] || '今あるものを見せる'; }
function detectMistakes(text) { const out = []; if (/初期投資|設備|物件|仕入れ|在庫|広告費/.test(text)) out.push('初期投資'); if (/続かない|時間がない|忙しい/.test(text)) out.push('時間で止まる'); if (/比較|SNS疲れ|伸びない|恥ずかしい/.test(text)) out.push('人目で疲れる'); if (/情報収集|調べすぎ|迷う/.test(text)) out.push('情報集めだけで止まる'); return out.length ? out : ['大きく始めすぎる']; }
function detectPattern(text) { const out = []; if (/写真|作品|実績/.test(text)) out.push('今あるものを見せる'); if (/相談|知人|友人|家族|コミュニティ/.test(text)) out.push('近い人に見せる'); if (/SNS|投稿|発信|note|ブログ|YouTube/.test(text)) out.push('短く発信する'); if (/受注|販売|小さく|少額/.test(text)) out.push('小さく売る'); if (/地域|地方|地元/.test(text)) out.push('地域に寄せる'); return out.length ? out : ['戻れる形で始める']; }
function summarizeVoice(text) { const s = sentences(text); return short(s.find((x) => /怖い|不安|恥ずかしい|迷う|悩む|今さら|家族|子供|続かな|やめた|後悔|赤字|食べていけ/.test(x)) || s.find((x) => /始めた|投稿|相談|副業|起業|SNS|販売|受注/.test(x)) || s[0] || text, 82); }
function summarizeEvidence(text) { const s = sentences(text); return short(s.find((x) => /始め|投稿|写真|相談|初期投資|副業|地方|家族|40代|50代|SNS|販売|受注/.test(x)) || s[0] || text, 86); }
function sourceName(url) { try { const host = new URL(url).hostname.replace(/^www\./, ''); if (host.includes('reddit')) return 'Reddit'; if (host.includes('note.com')) return 'note'; if (host.includes('youtube')) return 'YouTube'; if (host.includes('threads')) return 'Threads'; if (host.includes('chiebukuro.yahoo')) return 'Yahoo知恵袋'; if (host.includes('quora')) return 'Quora'; if (host.includes('komachi.yomiuri')) return '発言小町'; if (host.includes('x.com') || host.includes('twitter')) return 'X'; return host; } catch (_) { return 'web'; } }
function sourceKind(url) { try { const host = new URL(url).hostname.replace(/^www\./, ''); if (/reddit|youtube/.test(host)) return 'comment'; if (/threads|x\.com|twitter/.test(host)) return 'social'; if (/note\.com|ameblo|hatenablog|blog|wordpress|fc2|livedoor|seesaa/.test(host)) return 'personal'; if (/chiebukuro\.yahoo|quora|komachi\.yomiuri/.test(host)) return 'qa'; if (/\.co\.jp|corp|company|service|lp/.test(host)) return 'seo'; return 'web'; } catch (_) { return 'web'; } }
function sourceScore(url, text = '') { const haystack = `${url} ${text}`.toLowerCase(); const kind = sourceKind(url); let score = 50; if (kind === 'comment') score += 28; if (kind === 'social') score += 24; if (kind === 'qa') score += 22; if (kind === 'personal') score += 18; if (/reddit|threads|youtube|note\.com|chiebukuro|quora|komachi/.test(haystack)) score += 12; if (/怖い|不安|恥ずかしい|迷う|悩み|後悔|やめた|続かな|赤字|失敗|今さら|家族|子供/.test(text)) score += 18; if (/体験|実体験|経験談|始めた|やってみた|時系列|その後|コメント|返信/.test(text)) score += 16; if (/ランキング|おすすめ|徹底解説|完全ガイド|比較|資料請求|無料相談|公式|サービス|料金|導入/.test(text)) score -= 22; if (/\.co\.jp|lp|affiliate|adservice|prtimes|pressrelease/.test(haystack)) score -= 18; return clamp(score); }
function rankRaw(results) { return results.sort((a, b) => (b.sourceScore || 0) - (a.sourceScore || 0) || (b.score || 0) - (a.score || 0)); }
function uniqueByUrl(results) { const seen = new Set(); return results.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url)); }
function inferCategory(text) { if (/CNC|加工|製造|工場|工房|ものづくり|機械|作品|ハンドメイド/.test(text)) return 'ものづくり'; if (/カフェ|飲食|料理|お店/.test(text)) return '飲食'; if (/SNS|投稿|発信|YouTube|Instagram|note|ブログ/.test(text)) return '発信'; if (/講師|教える|コーチ|相談/.test(text)) return '教える仕事'; return '副業'; }
function sentences(text) { return String(text || '').split(/[。.!?\n]/).map(clean).filter((x) => x.length > 12); }
function clean(value) { return stripHtml(value).replace(/\s+/g, ' ').trim(); }
function stripHtml(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function mostCommon(items) { const counts = new Map(); items.filter(Boolean).forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x); }
function join(...values) { return values.map((v) => String(v || '')).join(' '); }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(value))); }
function short(value, max) { const text = String(value || '').trim(); return text.length > max ? `${text.slice(0, max)}...` : text; }
function sanitizeError(error) { return String(error?.message || error || 'Unknown error').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]').replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]'); }
function debugPayload(env, pipeline) { return { envKeys: Object.keys(env).filter((key) => !/KEY|TOKEN|SECRET/i.test(key)).sort(), searchProvider: pipeline.provider, searchStatus: pipeline.status, queryCount: pipeline.generatedQueries.length, rawResultCount: pipeline.rawResultCount, extractedCount: pipeline.extractedCount, topSources: pipeline.cases.map((item) => ({ source: item.source, sourceKind: item.sourceKind, sourceScore: item.sourceScore, title: item.title })), warning: pipeline.warning }; }
