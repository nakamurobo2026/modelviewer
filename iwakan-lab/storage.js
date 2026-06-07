(function () {
  const keys = {
    ideas: "iwakan_lab_ideas_v1",
    lastInput: "iwakan_lab_last_input_v1",
    view: "iwakan_lab_view_v1",
    edgeFunctionUrl: "iwakan_lab_edge_function_url_v1",
    history: "iwakan_lab_history_v1",
    apiModalSeen: "iwakan_lab_api_modal_seen_v1"
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clearLegacyOpenAISecrets() {
    localStorage.removeItem("iwakan_lab_openai_api_key_v1");
    localStorage.removeItem("iwakan_lab_openai_model_v1");
    localStorage.removeItem("iwakan_lab_openai_api_mode_v1");
  }

  clearLegacyOpenAISecrets();

  window.IwakanStorage = {
    keys,
    getIdeas: () => read(keys.ideas, []),
    setIdeas: (ideas) => write(keys.ideas, ideas),
    getLastInput: () => read(keys.lastInput, {}),
    setLastInput: (input) => write(keys.lastInput, input),
    getView: () => read(keys.view, { mode: "all" }),
    setView: (view) => write(keys.view, view),
    getEdgeFunctionUrl: () => localStorage.getItem(keys.edgeFunctionUrl) || window.IWAKAN_EDGE_FUNCTION_URL || "",
    setEdgeFunctionUrl: (url) => localStorage.setItem(keys.edgeFunctionUrl, url || ""),
    clearEdgeFunctionUrl: () => localStorage.removeItem(keys.edgeFunctionUrl),
    clearLegacyOpenAISecrets,
    getApiKey: () => localStorage.getItem(keys.edgeFunctionUrl) || window.IWAKAN_EDGE_FUNCTION_URL || "",
    setApiKey: (url) => localStorage.setItem(keys.edgeFunctionUrl, url || ""),
    clearApiKey: () => localStorage.removeItem(keys.edgeFunctionUrl),
    getModel: () => "gpt-5-mini",
    setModel: () => {},
    getApiMode: () => "supabase-edge",
    setApiMode: () => {},
    getHistory: () => read(keys.history, []),
    setHistory: (history) => write(keys.history, history.slice(0, 8)),
    clearHistory: () => localStorage.removeItem(keys.history),
    hasSeenApiModal: () => localStorage.getItem(keys.apiModalSeen) === "1",
    markApiModalSeen: () => localStorage.setItem(keys.apiModalSeen, "1")
  };
})();
