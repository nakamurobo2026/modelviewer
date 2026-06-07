const STORAGE_KEY="material_price_records_full_v1";
let records=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
let parsedRows=[];
let currentImage=null;
let chart;

const el=id=>document.getElementById(id);
const yen=n=>Number(n||0).toLocaleString("ja-JP");
const normalize=s=>String(s||"").replace(/×/g,"x").replace(/[　]+/g," ").replace(/\s+/g," ").trim();
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
el("date").value=today();

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(records))}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function addRecord(r){records.push({id:id(),date:r.date,name:normalize(r.name),qty:Number(r.qty||0),unitPrice:Number(r.unitPrice||0),amount:Number(r.amount||0),supplier:r.supplier||"ソゴウ"})}
function dedupe(){const s=new Set();records=records.filter(r=>{const k=[r.date,r.name,r.qty,r.unitPrice,r.amount,r.supplier].join("|");if(s.has(k))return false;s.add(k);return true})}
function searchKey(s){
  return normalize(s)
    .toLowerCase()
    .replace(/[（）()]/g,"")
    .replace(/[\/／・#＃\-\s]/g,"")
    .replace(/×/g,"x");
}
function filtered(){
 const q=searchKey(el("search").value);
 return records.filter(r=>{
   if(!q) return true;
   const target=searchKey(`${r.date} ${r.name} ${r.supplier} ${r.unitPrice} ${r.amount}`);
   return target.includes(q);
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function render(){
 const rows=filtered();
 const tbody = el("tbody");
 if(rows.length===0){
   tbody.innerHTML = `<tr><td colspan="7" class="empty">該当データなし。検索語を短くするか、別表記で試してください。</td></tr>`;
 } else {
   tbody.innerHTML=rows.map(r=>`<tr><td>${r.date}</td><td>${r.name}</td><td>${r.qty}</td><td>¥${yen(r.unitPrice)}</td><td>¥${yen(r.amount)}</td><td>${r.supplier}</td><td><button class="delete" onclick="removeRecord('${r.id}')">削除</button></td></tr>`).join("");
 }
 const prices=rows.map(r=>r.unitPrice).filter(n=>n>0);
 el("count").textContent=rows.length;
 el("avg").textContent=prices.length?"¥"+yen(Math.round(prices.reduce((a,b)=>a+b,0)/prices.length)):"0";
 el("min").textContent=prices.length?"¥"+yen(Math.min(...prices)):"0";
 el("max").textContent=prices.length?"¥"+yen(Math.max(...prices)):"0";
 drawChart(rows);
}
function drawChart(rows){
 const ctx=el("chart");
 if(chart) chart.destroy();
 if(!rows.length){
   const c=ctx.getContext("2d");
   c.clearRect(0,0,ctx.width,ctx.height);
   return;
 }
 chart=new Chart(ctx,{type:"line",data:{labels:rows.map(r=>r.date),datasets:[{label:"単価",data:rows.map(r=>r.unitPrice),tension:.25}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:true}},scales:{y:{beginAtZero:false}}}})
}
function removeRecord(rid){records=records.filter(r=>r.id!==rid);save();render()}

el("addBtn").onclick=()=>{const qty=Number(el("qty").value||0);const unitPrice=Number(el("unitPrice").value||0);const amount=Number(el("amount").value||0)||qty*unitPrice;addRecord({date:el("date").value,name:el("name").value,qty,unitPrice,amount,supplier:el("supplier").value});dedupe();save();render()};
el("seedBtn").onclick=()=>{SEED_RECORDS.forEach(addRecord);dedupe();save();render();alert(`納品書データを反映しました。現在 ${records.length} 件です。`)};
el("clearBtn").onclick=()=>{if(confirm("全データを削除しますか？")){records=[];save();render()}};
el("search").oninput=render;

el("cameraBtn").onclick=()=>{el("cameraInput").setAttribute("capture","environment");el("cameraInput").click()};
el("fileBtn").onclick=()=>{el("cameraInput").removeAttribute("capture");el("cameraInput").click()};
el("cameraInput").onchange=e=>{
 const file=e.target.files[0]; if(!file)return;
 currentImage=file;
 const url=URL.createObjectURL(file); el("preview").src=url; el("preview").style.display="block"; el("ocrStatus").textContent="画像を読み込みました。OCR解析を押してください。";
};

function parseDate(text){
 const m=text.match(/20\d{2}[年\/\-\.]\s*\d{1,2}[月\/\-\.]\s*\d{1,2}/);
 if(!m)return today();
 const nums=m[0].match(/\d+/g);
 return `${nums[0]}-${String(nums[1]).padStart(2,"0")}-${String(nums[2]).padStart(2,"0")}`;
}
function cleanNum(s){return Number(String(s||"").replace(/[^\d]/g,""))||0}
function likelyProduct(line){
 const l=normalize(line);
 if(!l)return false;
 if(/合計|税|PAGE|TEL|FAX|納品|売上日|御中|住所|担当|伝票|商品コード|数量|単価|金額/.test(l))return false;
 if(/[A-Za-zＡ-Ｚａ-ｚ]|ベニヤ|MDF|集成|フブル|パイン|ジナ|ゴム|ラワン|メルク|#|SCP/.test(l) && /(\d+\s*x\s*\d+|\d+\s*×\s*\d+|#\d+|MDF|L\/C|ベニヤ|集成|パイン|ジナ)/.test(l))return true;
 return false;
}
function parseOCR(text){
 const date=parseDate(text);
 const supplier=/ソゴウ/.test(text)?"ソゴウ":"";
 const lines=text.split(/\n/).map(normalize).filter(Boolean);
 let out=[];
 for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(!likelyProduct(line))continue;
   const joined=[line,lines[i+1]||"",lines[i+2]||""].join(" ");
   const nums=joined.match(/\d{1,3}(?:,\d{3})+|\d{3,6}/g)||[];
   let qty=1, unit=0, amount=0;
   const money=nums.map(cleanNum).filter(n=>n>=100);
   if(money.length>=2){ unit=money[money.length-2]; amount=money[money.length-1]; }
   else if(money.length==1){ unit=money[0]; amount=unit; }
   const qtyM=joined.match(/(\d+(?:\.\d+)?)\s*(枚|本|個)/);
   if(qtyM) qty=Number(qtyM[1]);
   if(amount && unit && amount>=unit && Math.round(amount/unit)>1 && !qtyM) qty=Math.round(amount/unit);
   let name=line.replace(/\s+\d{1,3}(?:,\d{3})+.*/,"").trim();
   out.push({date,name,qty,unitPrice:unit,amount:amount||qty*unit,supplier});
 }
 return out;
}

el("ocrBtn").onclick=async()=>{
 if(!currentImage){alert("先に納品書を撮影または選択してください。");return}
 if(!window.Tesseract){alert("OCRエンジンを読み込めません。ネット接続を確認してください。");return}
 el("ocrStatus").textContent="OCR解析中... 30秒〜数分かかる場合があります。";
 try{
   const result=await Tesseract.recognize(currentImage,"jpn+eng",{logger:m=>{if(m.status)el("ocrStatus").textContent=`OCR: ${m.status} ${m.progress?Math.round(m.progress*100)+"%":""}`}});
   el("ocrText").value=result.data.text;
   el("ocrStatus").textContent="OCR完了。抽出内容を確認してください。";
   parsedRows=parseOCR(result.data.text);
   renderParsed();
 }catch(e){el("ocrStatus").textContent="OCR失敗: "+e.message}
};
el("parseBtn").onclick=()=>{parsedRows=parseOCR(el("ocrText").value);renderParsed()};

function renderParsed(){
 el("parsedTbody").innerHTML=parsedRows.map((r,i)=>`<tr>
 <td><input class="miniInput" value="${r.date}" onchange="parsedRows[${i}].date=this.value"></td>
 <td><input class="miniInput nameInput" value="${r.name}" onchange="parsedRows[${i}].name=this.value"></td>
 <td><input class="miniInput" value="${r.qty}" onchange="parsedRows[${i}].qty=this.value"></td>
 <td><input class="miniInput" value="${r.unitPrice}" onchange="parsedRows[${i}].unitPrice=this.value"></td>
 <td><input class="miniInput" value="${r.amount}" onchange="parsedRows[${i}].amount=this.value"></td>
 <td><input class="miniInput" value="${r.supplier||'ソゴウ'}" onchange="parsedRows[${i}].supplier=this.value"></td>
 <td><button class="delete" onclick="parsedRows.splice(${i},1);renderParsed()">削除</button></td>
 </tr>`).join("");
}
el("registerParsedBtn").onclick=()=>{parsedRows.forEach(addRecord);dedupe();save();render();alert(`${parsedRows.length}件を登録しました。`)};

el("exportBtn").onclick=()=>{const header=["日付","商品名","数量","単価","金額","仕入先"];const csv=[header,...records.map(r=>[r.date,r.name,r.qty,r.unitPrice,r.amount,r.supplier])].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="material_prices.csv";a.click()};
el("importFile").onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const lines=reader.result.split(/\r?\n/).filter(Boolean);lines.slice(1).forEach(line=>{const cols=line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replaceAll('""','"'))||[];if(cols.length>=5)addRecord({date:cols[0],name:cols[1],qty:cols[2],unitPrice:cols[3],amount:cols[4],supplier:cols[5]||""})});dedupe();save();render()};reader.readAsText(file)};

if(records.length===0){SEED_RECORDS.forEach(addRecord);dedupe();save()}
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"))}
render();
