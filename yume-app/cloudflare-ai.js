(() => {
  const localAnalyze = window.analyze;

  if (typeof localAnalyze !== 'function') return;

  window.analyze = async function analyzeWithCloudflare(plan) {
    const endpoint = window.YUME_AI_ENDPOINT;
    if (!endpoint) return localAnalyze(plan);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
        signal: controller.signal
      });

      if (!response.ok) return localAnalyze(plan);

      const value = await response.json();
      return normalizeAnalysis(value, plan);
    } catch (_) {
      return localAnalyze(plan);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  function normalizeAnalysis(value, plan) {
    const fallback = localAnalyze(plan);
    return {
      summary: typeof value.summary === 'string' ? value.summary : fallback.summary,
      possibilityLevel: ['low', 'medium', 'high'].includes(value.possibilityLevel) ? value.possibilityLevel : fallback.possibilityLevel,
      message: typeof value.message === 'string' ? value.message : fallback.message,
      existingAssets: Array.isArray(value.existingAssets) && value.existingAssets.length ? value.existingAssets : fallback.existingAssets,
      missingPieces: Array.isArray(value.missingPieces) && value.missingPieces.length ? value.missingPieces : fallback.missingPieces,
      risks: Array.isArray(value.risks) && value.risks.length ? value.risks : fallback.risks,
      roadmap: Array.isArray(value.roadmap) && value.roadmap.length ? value.roadmap : fallback.roadmap,
      todayActions: Array.isArray(value.todayActions) && value.todayActions.length ? value.todayActions : fallback.todayActions,
      source: value.source || 'cloudflare'
    };
  }
})();
