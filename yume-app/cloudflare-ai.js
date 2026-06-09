(() => {
  const localAnalyze = window.analyze;

  if (typeof localAnalyze !== 'function') return;

  window.analyze = function analyzeWithoutBlocking(plan) {
    const fallback = localAnalyze(plan);
    const endpoint = window.YUME_AI_ENDPOINT;

    if (!endpoint) return fallback;

    // The current static MVP renders synchronously. Do not block the UI while the
    // Worker/OpenAI request is running; keep the app moving with the local plan.
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan)
    }).catch(() => undefined);

    return fallback;
  };
})();
