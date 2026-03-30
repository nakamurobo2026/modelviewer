<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
}
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
.hidden-audio{
  display:none;
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
      <div class="core"><div class="heart"></div></div>
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
      <button class="secondary" id="playAgainBtn">もう一度話す</button>
      <button class="secondary" id="clearMemoryBtn">初期化</button>
    </div>

    <div class="input-area">
      <input id="textInput" type="text" placeholder="音声が使えない時はここに入力" />
      <button class="send-btn" id="sendBtn">送信</button>
    </div>

    <div class="footer">
      OpenAI TTS 再生版
    </div>

    <audio id="ttsAudio" class="hidden-audio" playsinline preload="auto"></audio>
  </main>

<script>
const qs = new URLSearchParams(location.search);

const config = {
  id: qs.get("id") || "robot01",
  mode: qs.get("mode") || "normal",
  name: qs.get("name") || "ナカムロボユニット01",
  lang: qs.get("lang") || "ja-JP",
  endpoint: qs.get("endpoint") || "",
  voice: qs.get("voice") || "onyx",
  memory: (qs.get("memory") || "1") === "1",
  autostart: (qs.get("autostart") || "0") === "1"
};

const robotMeta = document.getElementById("robotMeta");
const robotName = document.getElementById("robotName");
const statusText = document.getElementById("statusText");
const responseText = document.getElementById("responseText");
const heardText = document.getElementById("heardText");

const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const clearMemoryBtn = document.getElementById("clearMemoryBtn");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const ttsAudio = document.getElementById("ttsAudio");

robotMeta.textContent = `ID: ${config.id} / MODE: ${config.mode}`;
robotName.textContent = config.name;

const memoryKey = `nakamurobo_memory_${config.id}`;
const shortHistoryKey = `nakamurobo_history_${config.id}`;
let lastReply = "…";
let lastAudioUrl = "";
let audioUnlocked = false;
let listening = false;

// Memory
function loadMemory(){
  if (!config.memory) return [];
  try { return JSON.parse(localStorage.getItem(memoryKey) || "[]"); }
  catch { return []; }
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
  try { return JSON.parse(localStorage.getItem(shortHistoryKey) || "[]"); }
  catch { return []; }
}
function saveShortHistory(history){
  localStorage.setItem(shortHistoryKey, JSON.stringify(history.slice(-6)));
}

// Audio unlock
async function unlockAudio() {
  if (audioUnlocked) return;
  try {
    ttsAudio.muted = true;
    ttsAudio.src = "";
    await ttsAudio.play().catch(() => {});
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
    ttsAudio.muted = false;
    audioUnlocked = true;
  } catch (e) {
    console.log("unlockAudio failed", e);
  }
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

async function playRobotAudio(base64, mimeType = "audio/mpeg") {
  if (lastAudioUrl) {
    URL.revokeObjectURL(lastAudioUrl);
    lastAudioUrl = "";
  }

  const blob = base64ToBlob(base64, mimeType);
  const url = URL.createObjectURL(blob);
  lastAudioUrl = url;

  ttsAudio.src = url;
  ttsAudio.currentTime = 0;
  ttsAudio.volume = 1.0;

  statusText.textContent = "応答中";

  try {
    await ttsAudio.play();
  } catch (e) {
    console.log("audio play failed", e);
    statusText.textContent = "音声再生エラー";
  }
}

ttsAudio.addEventListener("ended", () => {
  statusText.textContent = "待機中";
});

ttsAudio.addEventListener("error", () => {
  statusText.textContent = "音声再生エラー";
});

// Speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SR) {
  recognition = new SR();
  recognition.lang = config.lang;
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    listening = true;
    statusText.textContent = "聞き取り中";
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
      statusText.textContent = "聞き取れなかった";
    }
  };

  recognition.onerror = (e) => {
    listening = false;
    statusText.textContent = `音声入力エラー: ${e.error}`;
  };

  recognition.onend = () => {
    listening = false;
  };
} else {
  statusText.textContent = "音声入力非対応";
}

function startListening() {
  if (!recognition) {
    statusText.textContent = "この端末は音声入力に未対応";
    return;
  }
  try {
    ttsAudio.pause();
    recognition.start();
  } catch {
    statusText.textContent = "音声入力を開始できない";
  }
}

// API
async function askAI(userText) {
  const payload = {
    robotId: config.id,
    mode: config.mode,
    robotName: config.name,
    userText,
    memory: loadMemory(),
    history: loadShortHistory(),
    voice: config.voice
  };

  if (!config.endpoint) {
    return {
      reply: "…接続を確認。応答可能",
      memoryCandidate: "none",
      audioBase64: "",
      mimeType: "audio/mpeg"
    };
  }

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }

  return await res.json();
}

// Helpers
function setResponse(text) {
  lastReply = text;
  responseText.textContent = text;
}

function greetingByMemory(mem) {
  if (!mem.length) return "…認識した。ここにいる";
  const messages = [
    "…接続を確認。状態は安定",
    "…認識した。ここにいる",
    "…受信した。応答可能",
    "…接続は維持されている"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Main
async function handleUserMessage(userText) {
  statusText.textContent = "思考中";
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

    if (result.audioBase64) {
      setTimeout(async () => {
        await playRobotAudio(result.audioBase64, result.mimeType || "audio/mpeg");
      }, 250);
    } else {
      statusText.textContent = "音声なし";
    }

  } catch (err) {
    console.error(err);
    setResponse("…接続が乱れている。少し待機する");
    statusText.textContent = "通信エラー";
  }
}

// Events
micBtn.addEventListener("click", async () => {
  await unlockAudio();
  startListening();
});

stopBtn.addEventListener("click", () => {
  try {
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
  } catch {}
  try {
    if (recognition && listening) recognition.stop();
  } catch {}
  statusText.textContent = "停止";
});

playAgainBtn.addEventListener("click", async () => {
  try {
    await unlockAudio();
    if (lastAudioUrl) {
      ttsAudio.currentTime = 0;
      await ttsAudio.play();
    }
  } catch (e) {
    console.log(e);
  }
});

clearMemoryBtn.addEventListener("click", () => {
  clearMemory();
  statusText.textContent = "初期化完了";
  heardText.textContent = "記憶は空";
  setResponse("…初期状態に戻った");
});

sendBtn.addEventListener("click", async () => {
  await unlockAudio();
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

// Init
(async function init() {
  statusText.textContent = "接続完了";
  setResponse(greetingByMemory(loadMemory()));

  if (config.autostart) {
    await unlockAudio();
    setTimeout(() => startListening(), 600);
  }
})();
</script>
</body>
</html>
