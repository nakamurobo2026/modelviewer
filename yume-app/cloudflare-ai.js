(() => {
  const localAnalyze = window.analyze;

  if (typeof localAnalyze !== 'function') return;

  window.analyze = function analyzeWithCloudflare(plan) {
    const endpoint = window.YUME_AI_ENDPOINT;
    if (!endpoint) return localAnalyze(plan);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(plan));

      if (xhr.status < 200 || xhr.status >= 300) {
        return localAnalyze(plan);
      }

      return normalizeAnalysis(JSON.parse(xhr.responseText), plan);
    } catch (_) {
      return localAnalyze(plan);
    }
  };

  function normalizeAnalysis(value, plan) {
    const fallback = localAnalyze(plan);
    return {
      summary: typeof value.summary === 'string' ? value.summary : fallback.summary,
      possibilityLevel: ['low', 'medium', 'high'].includes(value.possibilityLevel) ? value.possibilityLevel : fallback.possibilityLevel,
      message: typeof value.message === 'string' ? value.message : fallback.message,
      existingAssets: Array.isArray(value.existingAssets) && value.existingAssets.length ? value.existingAssets : fallback.existingAssets,
      risks: Array.isArray(value.risks) && value.risks.length ? value.risks : fallback.risks,
      roadmap: Array.isArray(value.roadmap) && value.roadmap.length ? value.roadmap : fallback.roadmap,
      todayActions: Array.isArray(value.todayActions) && value.todayActions.length ? value.todayActions : fallback.todayActions,
      source: value.source || 'cloudflare'
    };
  }
})();
