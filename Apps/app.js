const STORAGE_KEY = "material_price_records_v6_stable";
let records = [];
let parsedRows = [];
let imageFile = null;

const $ = id => document.getElementById(id);
const yen = n => Number(n || 0).toLocaleString("ja-JP");

function normalize(s){
  return String(s || "").replace(/×/g,"x").replace(/[　]+/g," ").replace(/\s+/g," ").trim();
}
function searchKey(s){
  return normalize(s).toLowerCase().replace(/[（）()\/／・#＃\-\s]/g,"");
}
function today(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function uid(){
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
}
function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if(Array.isArray(saved) && saved.length){
      records = saved;
    }else{
      restoreSeed(false);
    }
  }catch(e){
    restoreSeed(false);
  }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function addRecord(r){
  records.push({
    id: uid(),
    date: r.date || today(),
    name: normalize(r.name),
    qty: Number(r.qty || 1),
    unitPrice: Number(r.unitPrice || 0),
    amount: Number(r.amount || 0),
    supplier: r.supplier || "ソゴウ"
  });
}
function restoreSeed(showAlert=true){
  records = SEED_RECORDS.map(r => ({
    id: uid(),
    date: r.date,
    name: normalize(r.name),
    qty: Number(r.qty),
    unitPrice: Number(r.unitPrice),
    amount: Number(r.amount),
    supplier: r.supplier || "ソゴウ"
  }));
  save();
  if(showAlert) alert("納品書データを復元しました。");
  render();
}
function dedupe(){
  const seen = new Set();
  records = records.filter(r=>{
    const key = [r.date,r.name,r.qty,r.unitPrice,r.amount,r.supplier].join("|");
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSpec(name){
  const s = normalize(name);
  let thickness = null, widthMm = null, lengthMm = null, standard = "";
  const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if(m){
    thickness = Number(m[1]);
    const a = Number(m[2]);
    const b = Number(m[3]);
    if(a <= 10 && b <= 10){
      if(a === 4 && b === 8){ widthMm = 1220; lengthMm = 2440; standard = "4x8"; }
      if(a === 3 && b === 6){ widthMm = 910; lengthMm = 1820; standard = "3x6"; }
    }else{
      widthMm = a; lengthMm = b; standard = `${Math.round(a)}x${Math.round(b)}`;
    }
  }
  if(!standard){
    if(/4\s*x\s*8|4×8|４×８/.test(s)){ widthMm = 1220; lengthMm = 2440; standard = "4x8"; }
    if(/3\s*x\s*6|3×6|３×６/.test(s)){ widthMm = 910; lengthMm = 1820; standard = "3x6"; }
  }
  if(thickness === null){
    const n = s.match(/\d+(?:\.\d+)?/);
    if(n) thickness = Number(n[0]);
  }
  const areaM2 = widthMm && lengthMm ? (widthMm/1000) * (lengthMm/1000) : null;
  const volumeM3 = areaM2 && thickness ? areaM2 * (thickness/1000) : null;
  const material = s.replace(/\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?/ig,"").replace(/\s+/g," ").trim();
  return { material, thickness, widthMm, lengthMm, standard, areaM2, volumeM3 };
}
function enrich(r){
  const spec = parseSpec(r.name);
  return {
    ...r,
    spec,
    pricePerM2: spec.areaM2 ? Math.round(r.unitPrice / spec.areaM2) : null,
    pricePerM3: spec.volumeM3 ? Math.round(r.unitPrice / spec.volumeM3) : null
  };
}
function productKey(r){
  const e = enrich(r);
  return `${e.spec.material}|${e.spec.thickness||""}|${e.spec.standard||""}|${e.spec.widthMm||""}|${e.spec.lengthMm||""}`;
}
function filtered(){
  const q = searchKey($("search").value);
  return records
    .filter(r => !q || searchKey(`${r.date} ${r.name} ${r.supplier} ${r.unitPrice} ${r.amount}`).includes(q))
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function graphRowsFor(rows){
  const mode = $("graphMode").value;
  let rows2 = rows.map(enrich);
  if(mode === "exact" && rows2.length){
    const key = productKey(rows2[0]);
    rows2 = rows2.filter(r => productKey(r) === key);
  }
  if(mode === "sqm") rows2 = rows2.filter(r => r.pricePerM2);
  if(mode === "m3") rows2 = rows2.filter(r => r.pricePerM3);
  return rows2;
}
function graphValue(r){
  const mode = $("graphMode").value;
  if(mode === "sqm") return r.pricePerM2;
  if(mode === "m3") return r.pricePerM3;
  return r.unitPrice;
}
function graphLabel(){
  const mode = $("graphMode").value;
  if(mode === "exact") return "同一商品";
  if(mode === "thickness") return "厚み別";
  if(mode === "sqm") return "㎡単価";
  return "m³単価";
}

function render(){
  const rows = filtered();
  renderSummary(rows);
  renderCards(rows);
  renderList(rows);
  drawChart(rows);
}
function renderSummary(rows){
  const prices = rows.map(r=>r.unitPrice).filter(v=>v>0);
  $("count").textContent = rows.length;
  $("avg").textContent = prices.length ? "¥" + yen(Math.round(prices.reduce((a,b)=>a+b,0)/prices.length)) : "0";
  $("min").textContent = prices.length ? "¥" + yen(Math.min(...prices)) : "0";
  $("max").textContent = prices.length ? "¥" + yen(Math.max(...prices)) : "0";
}
function cardHtml(raw, showDelete=false){
  const r = enrich(raw);
  return `<div class="itemCard">
    <div class="itemTop">
      <div class="itemName">${r.name}</div>
      <div class="price">¥${yen(r.unitPrice)}</div>
    </div>
    <div class="meta">${r.date}　数量:${r.qty}　金額:¥${yen(r.amount)}　${r.supplier}</div>
    <div class="badges">
      ${r.spec.thickness ? `<span class="badge">厚み ${r.spec.thickness}mm</span>` : ""}
      ${r.spec.standard ? `<span class="badge">規格 ${r.spec.standard}</span>` : ""}
      ${r.pricePerM2 ? `<span class="badge">¥${yen(r.pricePerM2)}/㎡</span>` : ""}
      ${r.pricePerM3 ? `<span class="badge">¥${yen(r.pricePerM3)}/m³</span>` : ""}
    </div>
    ${showDelete ? `<button class="dangerBtn" onclick="deleteRecord('${r.id}')">削除</button>` : ""}
  </div>`;
}
function renderCards(rows){
  $("cards").innerHTML = rows.length ? rows.slice().reverse().map(r=>cardHtml(r,false)).join("") : `<div class="empty">該当データなし</div>`;
}
function renderList(rows){
  $("listCards").innerHTML = records.length ? records.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>cardHtml(r,true)).join("") : `<div class="empty">登録データなし</div>`;
}
function deleteRecord(id){
  records = records.filter(r=>r.id !== id);
  save();
  render();
}

function drawChart(rows){
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(320, rect.width * dpr);
  canvas.height = 320 * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w = canvas.width/dpr;
  const h = 320;
  ctx.clearRect(0,0,w,h);

  const gr = graphRowsFor(rows);
  $("chartCount").textContent = gr.length + "件";
  const hintMap = {
    exact:"同じ厚み・規格だけを表示。見積判断はこれが安全。",
    thickness:"厚み違いも含めて表示。材料全体の傾向確認用。",
    sqm:"3x6/4x8を㎡単価に換算。面積違い比較用。",
    m3:"厚み差まで吸収するm³単価。板厚違い比較用。"
  };
  $("graphHint").textContent = hintMap[$("graphMode").value];

  if(!gr.length){
    $("barChart").innerHTML = `<div class="empty">グラフ化できるデータがありません</div>`;
    return;
  }

  const values = gr.map(graphValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 38;
  const range = max - min || max || 1;

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 18);
  ctx.lineTo(pad, h-pad);
  ctx.lineTo(w-12, h-pad);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.fillText("¥" + yen(max), 4, 24);
  ctx.fillText("¥" + yen(min), 4, h-pad);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.beginPath();
  gr.forEach((r,i)=>{
    const x = pad + (w-pad-18) * (gr.length === 1 ? 0.5 : i/(gr.length-1));
    const y = (h-pad) - ((values[i]-min)/range) * (h-pad-24);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle = "#111827";
  gr.forEach((r,i)=>{
    const x = pad + (w-pad-18) * (gr.length === 1 ? 0.5 : i/(gr.length-1));
    const y = (h-pad) - ((values[i]-min)/range) * (h-pad-24);
    ctx.beginPath();
    ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fill();
  });

  ctx.fillStyle = "#111827";
  ctx.font = "12px sans-serif";
  ctx.fillText(graphLabel(), pad, 14);

  const lastRows = gr.slice(-8);
  const lastValues = values.slice(-8);
  $("barChart").innerHTML = lastRows.map((r,i)=>{
    const v = lastValues[i];
    const pct = Math.max(4, Math.round(((v-min)/range)*100));
    return `<div class="barRow"><div>${r.date.slice(5)}</div><div class="barWrap"><div class="bar" style="width:${pct}%"></div></div><div class="barVal">¥${yen(v)}</div></div>`;
  }).join("");
}

function parseDate(text){
  const m = text.match(/20\d{2}[年\/\-.]\s*\d{1,2}[月\/\-.]\s*\d{1,2}/);
  if(!m) return today();
  const nums = m[0].match(/\d+/g);
  return `${nums[0]}-${String(nums[1]).padStart(2,"0")}-${String(nums[2]).padStart(2,"0")}`;
}
function cleanNum(s){ return Number(String(s||"").replace(/[^\d]/g,"")) || 0; }
function parseOCR(text){
  const date = parseDate(text);
  const supplier = /ソゴウ/.test(text) ? "ソゴウ" : "ソゴウ";
  const lines = text.split(/\n/).map(normalize).filter(Boolean);
  const out = [];
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(!/(MDF|L\/C|ベニヤ|集成|パイン|ジナ|ラワン|フブル|ゴム|SCP|#)/i.test(line)) continue;
    if(/合計|税|納品|数量|単価|金額|PAGE|TEL|FAX/.test(line)) continue;
    const joined = [line, lines[i+1]||"", lines[i+2]||""].join(" ");
    const nums = joined.match(/\d{1,3}(?:,\d{3})+|\d{3,6}/g) || [];
    const money = nums.map(cleanNum).filter(n=>n>=100);
    let qty = 1, unitPrice = 0, amount = 0;
    if(money.length >= 2){ unitPrice = money[money.length-2]; amount = money[money.length-1]; }
    else if(money.length === 1){ unitPrice = money[0]; amount = unitPrice; }
    if(unitPrice){
      if(amount >= unitPrice && Math.round(amount/unitPrice) > 1) qty = Math.round(amount/unitPrice);
      const name = line.replace(/\s+\d{1,3}(?:,\d{3})+.*/,"").trim();
      out.push({date,name,qty,unitPrice,amount:amount||qty*unitPrice,supplier});
    }
  }
  return out;
}
function renderParsed(){
  $("parsedCards").innerHTML = parsedRows.length ? parsedRows.map((r,i)=>`
    <div class="itemCard">
      <div class="editGrid">
        <input value="${r.date}" onchange="parsedRows[${i}].date=this.value">
        <input value="${r.name}" onchange="parsedRows[${i}].name=this.value">
        <input value="${r.qty}" onchange="parsedRows[${i}].qty=this.value">
        <input value="${r.unitPrice}" onchange="parsedRows[${i}].unitPrice=this.value">
        <input value="${r.amount}" onchange="parsedRows[${i}].amount=this.value">
        <input value="${r.supplier}" onchange="parsedRows[${i}].supplier=this.value">
      </div>
      <button class="dangerBtn" onclick="parsedRows.splice(${i},1);renderParsed()">削除</button>
    </div>
  `).join("") : `<div class="empty">抽出データなし</div>`;
}

function bindEvents(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.panel).classList.add("active");
      setTimeout(render, 50);
    };
  });
  document.querySelectorAll(".chip").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
      btn.classList.add("active");
      $("search").value = btn.dataset.q || "";
      render();
    };
  });
  $("search").oninput = ()=>{
    document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
    render();
  };
  $("graphMode").onchange = render;
  $("restoreBtn").onclick = ()=>restoreSeed(true);

  $("addBtn").onclick = ()=>{
    const qty = Number($("qty").value || 1);
    const unitPrice = Number($("unitPrice").value || 0);
    const amount = Number($("amount").value || 0) || qty * unitPrice;
    if(!$("name").value.trim()){ alert("商品名を入力してください"); return; }
    addRecord({date:$("date").value||today(), name:$("name").value, qty, unitPrice, amount, supplier:$("supplier").value||"ソゴウ"});
    dedupe(); save(); render(); alert("追加しました");
  };
  $("clearBtn").onclick = ()=>{
    if(confirm("全データを削除しますか？")){
      records = [];
      save();
      render();
    }
  };

  $("cameraBtn").onclick = ()=>{
    $("imageInput").setAttribute("capture","environment");
    $("imageInput").click();
  };
  $("imageBtn").onclick = ()=>{
    $("imageInput").removeAttribute("capture");
    $("imageInput").click();
  };
  $("imageInput").onchange = e=>{
    imageFile = e.target.files[0];
    if(!imageFile) return;
    $("preview").src = URL.createObjectURL(imageFile);
    $("preview").style.display = "block";
    $("ocrStatus").textContent = "画像を読み込みました。OCRを押してください。";
  };
  $("ocrBtn").onclick = async ()=>{
    if(!imageFile){ alert("先に撮影または画像選択してください"); return; }
    if(!window.Tesseract){ alert("OCRエンジンを読み込めません。ネット接続を確認してください。"); return; }
    $("ocrStatus").textContent = "OCR解析中...";
    try{
      const result = await Tesseract.recognize(imageFile, "jpn+eng", {
        logger: m => { if(m.status) $("ocrStatus").textContent = `OCR: ${m.status} ${m.progress ? Math.round(m.progress*100)+"%" : ""}`; }
      });
      $("ocrText").value = result.data.text;
      parsedRows = parseOCR(result.data.text);
      renderParsed();
      $("ocrStatus").textContent = "OCR完了。内容を確認してください。";
    }catch(e){
      $("ocrStatus").textContent = "OCR失敗: " + e.message;
    }
  };
  $("parseBtn").onclick = ()=>{
    parsedRows = parseOCR($("ocrText").value);
    renderParsed();
  };
  $("addParsedBtn").onclick = ()=>{
    parsedRows.forEach(addRecord);
    dedupe(); save(); render();
    alert(`${parsedRows.length}件登録しました`);
  };

  $("exportBtn").onclick = ()=>{
    const header = ["日付","商品名","数量","単価","金額","仕入先"];
    const csv = [header, ...records.map(r=>[r.date,r.name,r.qty,r.unitPrice,r.amount,r.supplier])]
      .map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "material_prices.csv";
    a.click();
  };
  $("csvInput").onchange = e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const lines = reader.result.split(/\r?\n/).filter(Boolean);
      lines.slice(1).forEach(line=>{
        const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replaceAll('""','"')) || [];
        if(cols.length >= 5) addRecord({date:cols[0], name:cols[1], qty:cols[2], unitPrice:cols[3], amount:cols[4], supplier:cols[5]||"ソゴウ"});
      });
      dedupe(); save(); render();
    };
    reader.readAsText(file);
  };
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("date").value = today();
  load();
  bindEvents();
  renderParsed();
  render();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
});
