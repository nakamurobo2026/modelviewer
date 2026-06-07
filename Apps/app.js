const STORAGE_KEY = "material_price_records_v2";
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let chart;

const el = id => document.getElementById(id);
const yen = n => Number(n || 0).toLocaleString("ja-JP");

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeName(s){
  return String(s || "").replace(/×/g,"x").replace(/\s+/g," ").trim();
}

function today(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
el("date").value = today();

function addRecord(r){
  if(!r.date || !r.name) {
    alert("日付と商品名は入力してください。");
    return;
  }
  records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    date: r.date,
    name: normalizeName(r.name),
    qty: Number(r.qty || 0),
    unitPrice: Number(r.unitPrice || 0),
    amount: Number(r.amount || 0),
    supplier: r.supplier || ""
  });
  save();
  render();
}

function filtered(){
  const q = normalizeName(el("search").value).toLowerCase();
  return records
    .filter(r => !q || normalizeName(`${r.name} ${r.supplier}`).toLowerCase().includes(q))
    .sort((a,b)=> a.date.localeCompare(b.date));
}

function render(){
  const rows = filtered();
  el("tbody").innerHTML = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.name}</td>
      <td>${r.qty}</td>
      <td>¥${yen(r.unitPrice)}</td>
      <td>¥${yen(r.amount)}</td>
      <td>${r.supplier}</td>
      <td><button class="delete" onclick="removeRecord('${r.id}')">削除</button></td>
    </tr>
  `).join("");

  const prices = rows.map(r=>r.unitPrice).filter(n=>n>0);
  el("count").textContent = rows.length;
  el("avg").textContent = prices.length ? "¥" + yen(Math.round(prices.reduce((a,b)=>a+b,0)/prices.length)) : "0";
  el("min").textContent = prices.length ? "¥" + yen(Math.min(...prices)) : "0";
  el("max").textContent = prices.length ? "¥" + yen(Math.max(...prices)) : "0";

  drawChart(rows);
}

function drawChart(rows){
  const ctx = el("chart");
  if(chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map(r => r.date),
      datasets: [{
        label: "単価",
        data: rows.map(r => r.unitPrice),
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins:{ legend:{ display:true }},
      scales:{ y:{ beginAtZero:false }}
    }
  });
}

function removeRecord(id){
  records = records.filter(r => r.id !== id);
  save();
  render();
}

el("addBtn").onclick = () => {
  const amount = Number(el("amount").value || 0);
  const qty = Number(el("qty").value || 0);
  const unitPrice = Number(el("unitPrice").value || 0);
  addRecord({
    date: el("date").value,
    name: el("name").value,
    qty,
    unitPrice,
    amount: amount || qty * unitPrice,
    supplier: el("supplier").value
  });
};

el("sampleBtn").onclick = () => {
  const sample = [
    ["2026-02-17","ジナパック #400 1200x42M",1,2100,2100,"ソゴウ"],
    ["2026-05-07","ジナパック #400 1200x42M",1,2820,2820,"ソゴウ"],
    ["2026-03-26","MDF 30x4x8",2,12640,25280,"ソゴウ"],
    ["2026-04-17","MDF 30x4x8",1,12640,12640,"ソゴウ"],
    ["2026-05-29","メルクシパイン B 30x500x4200",2,9640,19280,"ソゴウ"],
    ["2026-04-22","ラワンベニヤ 15x4x8",1,6630,6630,"ソゴウ"]
  ];
  sample.forEach(s => records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    date:s[0], name:s[1], qty:s[2], unitPrice:s[3], amount:s[4], supplier:s[5]
  }));
  save();
  render();
};

el("clearBtn").onclick = () => {
  if(confirm("全データを削除しますか？")){
    records = [];
    save();
    render();
  }
};

el("search").oninput = render;

el("exportBtn").onclick = () => {
  const header = ["日付","商品名","数量","単価","金額","仕入先"];
  const csv = [header, ...records.map(r => [r.date,r.name,r.qty,r.unitPrice,r.amount,r.supplier])]
    .map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "material_prices.csv";
  a.click();
};

el("importFile").onchange = e => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(Boolean);
    lines.slice(1).forEach(line => {
      const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replaceAll('""','"')) || [];
      if(cols.length >= 5){
        records.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
          date: cols[0], name: normalizeName(cols[1]), qty: Number(cols[2]||0),
          unitPrice: Number(cols[3]||0), amount: Number(cols[4]||0), supplier: cols[5] || ""
        });
      }
    });
    save();
    render();
  };
  reader.readAsText(file);
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

render();
