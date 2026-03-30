<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NAKAMUROBO AI</title>
<style>
body{
  margin:0;
  background:#000;
  color:#fff;
  font-family:sans-serif;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
}
.app{max-width:500px;width:100%;padding:20px;text-align:center;}
button{padding:15px;margin:5px;border-radius:10px;border:none;}
input{padding:12px;width:70%;}
.response{font-size:22px;margin:20px 0;}
</style>
</head>
<body>

<div class="app">
  <h2 id="robotName">ナカムロボユニット01</h2>
  <div class="response" id="response">…</div>
  <div id="status">待機中</div>

  <button id="mic">話す</button>
  <button id="stop">停止</button>
  <br><br>
  <input id="input" placeholder="テキスト入力">
  <button id="send">送信</button>
</div>

<script>
const qs = new URLSearchParams(location.search);

const config = {
  endpoint: qs.get("endpoint") || "",
  name: qs.get("name") || "ナカムロボユニット01",
  rate: Number(qs.get("rate") || 0.90),
  pitch: Number(qs.get("pitch") || 0.78)
};

const responseEl = document.getElementById("response");
const statusEl = document.getElementById("status");
const input = document.getElementById("input");

let lastReply = "…";
let audioUnlocked = false;

/* ===== 音声アンロック ===== */
function unlockSpeech(){
  if(audioUnlocked) return;
  try{
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
    audioUnlocked = true;
  }catch(e){
    console.log(e);
  }
}

/* ===== 音声 ===== */
function speak(text){
  try{
    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = config.rate;
    u.pitch = config.pitch;

    const voices = speechSynthesis.getVoices();
    const v = voices.find(v=>v.lang==="ja-JP") || voices[0];
    if(v) u.voice = v;

    u.onstart = ()=>statusEl.textContent="応答中";
    u.onend = ()=>statusEl.textContent="待機中";

    speechSynthesis.speak(u);

  }catch(e){
    console.log("speech error",e);
    statusEl.textContent="音声エラー";
  }
}

/* ===== AI ===== */
async function askAI(text){
  if(!config.endpoint){
    return {reply:"…受信した。保持する"};
  }

  const res = await fetch(config.endpoint,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      userText:text,
      robotName:config.name
    })
  });

  const data = await res.json();
  return data;
}

/* ===== メイン処理 ===== */
async function sendText(text){
  statusEl.textContent="思考中";

  try{
    const r = await askAI(text);
    const reply = r.reply || "…";

    lastReply = reply;
    responseEl.textContent = reply;

    unlockSpeech();
    setTimeout(()=>{
      speak(reply);
    },250);

  }catch(e){
    responseEl.textContent="…接続が乱れている";
  }
}

/* ===== 音声入力 ===== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec;

if(SR){
  rec = new SR();
  rec.lang="ja-JP";

  rec.onresult = e=>{
    const t = e.results[0][0].transcript;
    sendText(t);
  };

  rec.onstart = ()=>statusEl.textContent="聞き取り中";
  rec.onend = ()=>statusEl.textContent="待機中";
}

/* ===== UI ===== */
document.getElementById("mic").onclick=()=>{
  unlockSpeech();
  if(rec) rec.start();
};

document.getElementById("stop").onclick=()=>{
  speechSynthesis.cancel();
  if(rec) rec.stop();
};

document.getElementById("send").onclick=()=>{
  unlockSpeech();
  if(input.value.trim()){
    sendText(input.value.trim());
    input.value="";
  }
};

/* ===== 初期 ===== */
responseEl.textContent="…認識した。ここにいる";
statusEl.textContent="接続完了";
</script>

</body>
</html>
