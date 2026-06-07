(function () {
  const keys = {
    ideas: "iwakan_lab_ideas_v1",
    lastInput: "iwakan_lab_last_input_v1",
    view: "iwakan_lab_view_v1",
    apiKey: "iwakan_lab_openai_api_key_v1",
    model: "iwakan_lab_openai_model_v1",
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

  window.IwakanStorage = {
    keys,
    getIdeas: () => read(keys.ideas, []),
    setIdeas: (ideas) => write(keys.ideas, ideas),
    getLastInput: () => read(keys.lastInput, {}),
    setLastInput: (input) => write(keys.lastInput, input),
    getView: () => read(keys.view, { mode: "all" }),
    setView: (view) => write(keys.view, view),
    getApiKey: () => localStorage.getItem(keys.apiKey) || "",
    setApiKey: (key) => localStorage.setItem(keys.apiKey, key),
    clearApiKey: () => localStorage.removeItem(keys.apiKey),
    getModel: () => localStorage.getItem(keys.model) || "gpt-5-mini",
    setModel: (model) => localStorage.setItem(keys.model, model || "gpt-5-mini"),
    getHistory: () => read(keys.history, []),
    setHistory: (history) => write(keys.history, history.slice(0, 8)),
    clearHistory: () => localStorage.removeItem(keys.history),
    hasSeenApiModal: () => localStorage.getItem(keys.apiModalSeen) === "1",
    markApiModalSeen: () => localStorage.setItem(keys.apiModalSeen, "1")
  };
})();
