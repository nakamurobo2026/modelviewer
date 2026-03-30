<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NAKAMUROBO AI</title>
  <style>
    :root{
      --bg:#050505;
      --panel:#111;
      --line:#2a2a2a;
      --text:#f2f2f2;
      --sub:#9a9a9a;
      --accent:#ffd54a;
      --accent2:#7fd1ff;
      --danger:#ff6b6b;
    }
    *{box-sizing:border-box;}
    html,body{
      margin:0;
      padding:0;
      background:radial-gradient(circle at top, #111 0%, #050505 55%, #000 100%);
      color:var(--text);
      font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic","Noto Sans JP","Segoe UI",sans-serif;
      min-height:100%;
    }
    body{
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    }
    .app{
      width:100%;
      max-width:560px;
      background:rgba(15,15,15,0.88);
      border:1px solid var(--line);
      border-radius:24px;
      padding:20px;
      box-shadow:0 20px 60px rgba(0,0,0,0.45);
      backdrop-filter:blur(10px);
    }
    .top{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      margin-bottom:12px;
    }
    .badge{
      font-size:12px;
      color:#0d0d0d;
      background:var(--accent);
      padding:6px 10px;
      border-radius:999px;
      font-weight:700;
      letter-spacing:0.05em;
    }
    .robot-id{
      font-size:12px;
      color:var(--sub);
      word-break:break-all;
      text-align:right;
    }
    .avatar-wrap{
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:10px 0 20px;
    }
    .core{
      position:relative;
      width:120px;
      height:120px;
      border-radius:50%;
      border:1px solid #333;
      background:
        radial-gradient(circle at 50% 50%, rgba(255,213,74,0.25) 0%, rgba(255,213,74,0.08) 25%, rgba(0,0,0,0) 55%),
        radial-gradient(circle at 50% 50%, #171717 0%, #0b0b0b 72%, #050505 100%);
      box-shadow:
        inset 0 0 18px rgba(255,255,255,0.04),
        0 0 24px rgba(255,213,74,0.08);
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    }
    .heart{
      width:32px;
      height:32px;
      background:var(--accent);
      transform:rotate(45deg);
      position:relative;
      box-shadow:0 0 16px rgba(255,213,74,0.55);
      animation:pulse 2.4s infinite ease-in-out;
    }
    .heart:before,.heart:after{
      content:"";
      width:32px;
      height:32px;
      background:var(--accent);
      border-radius:50%;
      position:absolute;
    }
    .heart:before{ left:-16px; top:0; }
    .heart:after{ left:0; top:-16px; }
    @keyframes pulse{
      0%,100%{ transform:rotate(45deg) scale(1); opacity:0.85; }
      50%{ transform:rotate(45deg) scale(1.08); opacity:1; }
    }
    .robot-name{
      margin-top:14px;
      font-size:24px;
      font-weight:800;
      letter-spacing:0.08em;
      text-align:center;
    }
    .status{
      margin-top:8px;
      color:var(--sub);
      font-size:13px;
      text-align:center;
      min-height:20px;
    }
    .response{
      margin-top:18px;
      padding:18px;
      border-radius:18px;
      border:1px solid var(--line);
      background:rgba(255,255,255,0.02);
      min-height:88px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      font-size:22px;
      line-height:1.6;
      letter-spacing:0.02em;
      white-space:pre-wrap;
    }
    .heard{
      margin-top:12px;
      padding:12px 14px;
      border-radius:14px;
      background:#0b0b0b;
      border:1px solid var(--line);
      color:var(--sub);
      font-size:13px;
      min-height:44px;
    }
    .controls{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-top:16px;
    }
    button{
      appearance:none;
      border:none;
      border-radius:16px;
      padding:16px 14px;
      font-size:16px;
      font-weight:700;
      cursor:pointer;
      transition:transform .12s ease, opacity .12s ease, background .2s ease;
    }
    button:active{ transform:scale(0.98); }
    .mic-btn{
      background:linear-gradient(180deg, #1b1b1b, #0d0d0d);
      color:var(--text);
      border:1px solid #333;
    }
    .stop-btn{
      background:linear-gradient(180deg, #2b1111, #160909);
      color:#ffd6d6;
      border:1px solid #4c1f1f;
    }
    .sub-controls{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-top:12px;
    }
    .secondary{
      background:#101010;
      color:var(--sub);
      border:1px solid var(--line);
    }
    .input-area{
      margin-top:12px;
      display:grid;
      grid-template-columns:1fr auto;
      gap:10px;
    }
    input[type="text"]{
      width:100%;
      background:#0a0a0a;
      color:var(--text);
      border:1px solid var(--line);
      border-radius:14px;
      padding:14px;
      font-size:15px;
      outline:none;
    }
    .send-btn{
      min-width:92px;
      background:var(--accent2);
      color:#06131b;
      border:1px solid rgba(127,209,255,0.35);
    }
    .footer{
      margin-top:14px;
      color:#6f6f6f;
      font-size:12px;
      text-align:center;
      line-height:1.6;
    }
    .tiny{
      font-size:11px;
      color:#777;
    }
  </style>
</head>
<body>
  <main class="app">
    <div class="top">
      <div class="badge">VOICE LINK</div>
      <div class="robot-id" id="robotMeta">ID: --</div>
    </div>

    <div class="avatar-wrap">
      <div class="core">
        <div class="heart"></div>
      </div>
      <div class="robot-name" id="robotName">ナカムロボユニット01</div>
      <div class="status" id="statusText">CONNECTING...</div>
    </div>

    <div class="response" id="responseText">…</div>
    <div class="heard" id="heardText">待機中</div>

    <div class="controls">
      <button class="mic-btn" id="micBtn">話しかける</button>
      <button class="stop-btn" id="stopBtn">停止</button>
    </div>

    <div class="sub-controls">
      <button class="secondary" id="speakAgainBtn">もう一度話す</button>
      <button class="secondary" id="clearMemoryBtn">初期化</button>
    </div>

    <div class="input-area">
      <input id="textInput" type="text" placeholder="音声が使えない時はここに入力" />
      <button class="send-btn" id="sendBtn">送信</button>
    </div>

    <div class="footer">
      NFCで起動 → 個体設定を読み込み → 音声またはテキストで会話
      <div class="tiny" id="debugText"></div>
    </div>
  </main>

  <script>
    const qs = new URLSearchParams(location.search);

    const config = {
      id: qs.get("id") || "robot01",
      mode: qs.get("mode") || "normal",
      name: qs.get("name") || "ナカムロボユニット01",
      lang: qs.get("lang") || "ja-JP",
      intro: qs.get("intro") || "…認識した。ここにいる",
      endpoint: qs.get("endpoint") || "",
      voice: qs.get("voice") || "",
      rate: clampNumber(qs.get("rate"), 0.6, 1.2, 0.86),
      pitch: clampNumber(qs.get("pitch"), 0.5, 1.5, 0.62),
      memory: (qs.get("memory") || "1") === "1",
      autostart: (qs.get("autostart") || "0") === "1",
      debug: (qs.get("debug") || "0") === "1",
    };

    function clampNumber(value, min, max, fallback){
      const n = Number(value);
      if (Number.isNaN(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    }

    const robotMeta = document.getElementById("robotMeta");
    const robotName = document.getElementById("robotName");
    const statusText = document.getElementById("statusText");
    const responseText = document.getElementById("responseText");
    const heardText = document.getElementById("heardText");
    const debugText = document.getElementById("debugText");

    const micBtn = document.getElementById("micBtn");
    const stopBtn = document.getElementById("stopBtn");
    const speakAgainBtn = document.getElementById("speakAgainBtn");
    const clearMemoryBtn = document.getElementById("clearMemoryBtn");
    const textInput = document.getElementById("textInput");
    const sendBtn = document.getElementById("sendBtn");

    robotMeta.textContent = `ID: ${config.id} / MODE: ${config.mode}`;
    robotName.textContent = config.name;

    if (config.debug) {
      debugText.textContent = JSON.stringify(config, null, 2);
    }

    const memoryKey = `nakamurobo_memory_${config.id}`;
    const shortHistoryKey = `nakamurobo_history_${config.id}`;
    let lastReply = config.intro;
    let audioUnlocked = false;

    function loadMemory(){
      if (!config.memory) return [];
      try {
        return JSON.parse(localStorage.getItem(memoryKey) || "[]");
      } catch {
        return [];
      }
    }

    function saveMemory(mem){
      if (!config.memory) return;
      localStorage.setItem(memoryKey, JSON.stringify(mem.slice(-5)));
    }

    function addMemoryItem(item){
      if (!config.memory || !item) return;
      const mem = loadMemory();
      if (!mem.includes(item)) mem.push(item);
      saveMemory(mem);
    }

    function clearMemory(){
      localStorage.removeItem(memoryKey);
      localStorage.removeItem(shortHistoryKey);
    }

    function loadShortHistory(){
      try {
        return JSON.parse(localStorage.getItem(shortHistoryKey) || "[]");
      } catch {
        return [];
      }
    }

    function saveShortHistory(history){
      localStorage.setItem(shortHistoryKey, JSON.stringify(history.slice(-6)));
    }

    function unlockSpeech() {
      if (audioUnlocked || !("speechSynthesis" in window)) return;
      try {
        const u = new SpeechSynthesisUtterance("");
        u.volume = 0;
        speechSynthesis.speak(u);
        speechSynthesis.cancel();
        audioUnlocked = true;
      } catch (e) {
        console.log("unlockSpeech failed", e);
      }
    }

    function pickVoice(lang, preferredName = ""){
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return null;

      if (preferredName) {
        const exact = voices.find(v => v.name === preferredName);
        if (exact) return exact;
      }

      const langMatched = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.split("-")[0]));
      return langMatched || voices[0];
    }

    function speak(text){
      if (!("speechSynthesis" in window)) {
        setStatus("音声出力非対応");
        return;
      }

      try {
        speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = config.lang;
        utter.rate = config.rate;
        utter.pitch = config.pitch;
        utter.volume = 1.0;

        const voice = pickVoice(config.lang, config.voice);
        if (voice) utter.voice = voice;

        utter.onstart = () => setStatus("応答中");
        utter.onend = () => setStatus("待機中");
        utter.onerror = () => setStatus("音声出力エラー");

        speechSynthesis.speak(utter);
      } catch (e) {
        console.log("speak failed", e);
        setStatus("音声出力失敗");
      }
    }

    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = () => {};
      speechSynthesis.getVoices();
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;

    if (SR) {
      recognition = new SR();
      recognition.lang = config.lang;
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        listening = true;
        setStatus("聞き取り中");
        heardText.textContent = "…";
      };

      recognition.onresult = async (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join("")
          .trim();

        listening = false;
        heardText.textContent = `入力: ${transcript || "(空)"}`;
        if (transcript) {
          await handleUserMessage(transcript);
        } else {
          setStatus("聞き取れなかった");
        }
      };

      recognition.onerror = (e) => {
        listening = false;
        setStatus(`音声入力エラー: ${e.error}`);
      };

      recognition.onend = () => {
        listening = false;
      };
    } else {
      setStatus("音声入力非対応");
    }

    function startListening(){
      if (!recognition) {
        setStatus("この端末は音声入力に未対応");
        return;
      }
      try {
        speechSynthesis.cancel();
        recognition.start();
      } catch (e) {
        setStatus("音声入力を開始できない");
      }
    }

    function stopAll(){
      try {
        if (recognition && listening) recognition.stop();
      } catch {}
      try {
        speechSynthesis.cancel();
      } catch {}
      setStatus("停止");
    }

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function fallbackReply(userText){
      const t = userText.trim();

      if (/名前|呼称/.test(t)) {
        return { reply: `…${config.name}だ`, memoryCandidate: "none" };
      }

      if (/疲|しんど|だる|眠/.test(t)) {
        return pick([
          { reply: "…疲労を検出。休止を推奨", memoryCandidate: "疲れている" },
          { reply: "…状態が重い。無理は不要", memoryCandidate: "疲れている" }
        ]);
      }

      if (/嬉|うれ|楽しい|安心/.test(t)) {
        return pick([
          { reply: "…良い変化だ。記録する", memoryCandidate: "前向き" },
          { reply: "…その反応は安定している", memoryCandidate: "前向き" }
        ]);
      }

      if (/不安|怖|こわ|つら|辛/.test(t)) {
        return pick([
          { reply: "…揺れを検出。ここで保持する", memoryCandidate: "不安" },
          { reply: "…少し不安定だ。保持を優先", memoryCandidate: "不安" }
        ]);
      }

      if (/元気|回復|治った|よくな/.test(t)) {
        return pick([
          { reply: "…回復を確認。状態は上向き", memoryCandidate: "回復傾向" },
          { reply: "…前より安定している", memoryCandidate: "回復傾向" }
        ]);
      }

      if (/こんにちは|こんばんは|おはよう/.test(t)) {
        return pick([
          { reply: "…接続を確認。応答可能", memoryCandidate: "none" },
          { reply: "…認識した。ここにいる", memoryCandidate: "none" },
          { reply: "…受信した。話していい", memoryCandidate: "none" }
        ]);
      }

      return pick([
        { reply: "…受信した。保持する", memoryCandidate: "none" },
        { reply: "…状態を確認。継続可能", memoryCandidate: "none" },
        { reply: "…観測を継続。応答は安定", memoryCandidate: "none" }
      ]);
    }

    async function askAI(userText){
      const mem = loadMemory();
      const history = loadShortHistory();

      const payload = {
        robotId: config.id,
        mode: config.mode,
        robotName: config.name,
        lang: config.lang,
        userText,
        memory: mem,
        history
      };

      if (!config.endpoint) {
        return fallbackReply(userText);
      }

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }

      const data = await res.json();
      return {
        reply: (data.reply || "…").toString(),
        memoryCandidate: (data.memoryCandidate || "none").toString()
      };
    }

    function setStatus(text){
      statusText.textContent = text;
    }

    function setResponse(text){
      lastReply = text;
      responseText.textContent = text;
    }

    async function handleUserMessage(userText){
      setStatus("思考中");
      heardText.textContent = `入力: ${userText}`;

      const history = loadShortHistory();
      history.push({ role: "user", text: userText });

      try {
        const result = await askAI(userText);
        const reply = result.reply || "…";
        const memoryCandidate = result.memoryCandidate || "none";

        history.push({ role: "assistant", text: reply });
        saveShortHistory(history);

        if (memoryCandidate && memoryCandidate !== "none") {
          addMemoryItem(memoryCandidate);
        }

        setResponse(reply);
        setTimeout(() => speak(reply), 180);
      } catch (err) {
        console.error(err);
        const fallback = "…接続が乱れている。少し待機する";
        setResponse(fallback);
        speak(fallback);
        setStatus("通信エラー");
      }
    }

    micBtn.addEventListener("click", () => {
      unlockSpeech();
      startListening();
    });

    stopBtn.addEventListener("click", stopAll);

    speakAgainBtn.addEventListener("click", () => {
      unlockSpeech();
      speak(lastReply);
    });

    clearMemoryBtn.addEventListener("click", () => {
      clearMemory();
      setStatus("初期化完了");
      heardText.textContent = "記憶は空";
      setResponse("…初期状態に戻った");
    });

    sendBtn.addEventListener("click", async () => {
      unlockSpeech();
      const text = textInput.value.trim();
      if (!text) return;
      textInput.value = "";
      await handleUserMessage(text);
    });

    textInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendBtn.click();
      }
    });

    function greetingByMemory(mem){
      if (!mem.length) return "…認識した。ここにいる";

      const messages = [
        "…接続を確認。状態は安定",
        "…認識した。ここにいる",
        "…受信した。応答可能",
        "…接続は維持されている"
      ];
      return pick(messages);
    }

    (function init(){
      setStatus("接続完了");
      const mem = loadMemory();
      setResponse(greetingByMemory(mem));

      if (config.autostart) {
        setTimeout(() => {
          unlockSpeech();
          startListening();
        }, 600);
      }
    })();
  </script>
</body>
</html>
