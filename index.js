const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Monitoramento & Anti-Hibernação
========================= */
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com"; 
setInterval(async () => {
  try {
    const res = await fetch(URL_DO_SEU_SITE);
    if (res.ok) console.log(`[Keep-Alive] Ping executado. Servidor ativo.`);
  } catch (err) {
    console.log(`[Keep-Alive] Falha no ping: ${err.message}`);
  }
}, 600000);

let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-BR');
  logsArray.unshift(`[${time}] ${args.join(" ")}`); 
  if (logsArray.length > 15) logsArray.pop(); 
  originalLog.apply(console, args);
};

app.use((req, res, next) => { totalRequests++; next(); });

setInterval(() => {
  const percent = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
  ramHistory.push({ time: new Date().toLocaleTimeString('pt-BR'), value: percent });
  if (ramHistory.length > 20) ramHistory.shift(); 
}, 10000);

/* =========================
   Funções de Coleta de Dados
========================= */
const toGB = (v) => (v / 1024 / 1024 / 1024).toFixed(2);
const toMB = (v) => (v / 1024 / 1024).toFixed(2);
const calcPercent = (p, t) => t ? ((p / t) * 100).toFixed(0) : "0";

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function getSystemData() {
  const cpus = os.cpus();
  const avgCpu = (cpus.reduce((s, c) => s + Number(calcPercent(c.times.user + c.times.nice + c.times.sys + c.times.irq, c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq)), 0) / cpus.length).toFixed(0);
  
  let disk = { size: 'N/A', used: 'N/A', avail: 'N/A', percent: '0%' };
  try {
    const df = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    disk = { size: df[1], used: df[2], avail: df[3], percent: df[4] };
  } catch (e) {}

  let git = { hash: 'N/A', branch: 'N/A' };
  try {
    git.hash = execSync("git rev-parse --short HEAD").toString().trim();
    git.branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  } catch (e) {}

  const ips = Object.values(os.networkInterfaces()).flat().filter(i => !i.internal && i.family === "IPv4");
  const mainIP = ips.length ? ips[0].address : "Desconhecido";

  let files = [];
  try { files = fs.readdirSync(".").slice(0, 8); } catch (e) {}

  const ramUsage = calcPercent(os.totalmem() - os.freemem(), os.totalmem());
  const status = ramUsage > 85 ? { text: "Crítico", color: "#ff4d4f" } : (ramUsage > 65 ? { text: "Atenção", color: "#faad14" } : { text: "Saudável", color: "#52c41a" });

  return { cpus, avgCpu, disk, git, mainIP, files, ramUsage, status };
}

/* =========================
   Geração da Interface
========================= */
app.get("/", (req, res) => {
  const data = getSystemData();
  if (ramHistory.length === 0) ramHistory.push({ time: new Date().toLocaleTimeString('pt-BR'), value: data.ramUsage });

  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel Administrativo | Servidor</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif;
    margin: 0;
    display: flex;
    height: 100vh;
    background: #0f172a; /* Slate 900 */
    color: #f8fafc;
    overflow: hidden;
  }
  
  /* Estrutura Sidebar */
  .sidebar {
    width: 280px;
    background: #1e293b; /* Slate 800 */
    border-right: 1px solid #334155;
    display: flex;
    flex-direction: column;
    padding: 25px 20px;
    overflow-y: auto;
  }

  .brand { margin-bottom: 30px; text-align: center; }
  .brand h1 { margin: 0; font-size: 1.5em; font-weight: 700; color: #38bdf8; }
  .brand p { margin: 5px 0 0; font-size: 0.85em; color: #94a3b8; }

  /* Estrutura Main Content */
  .main-content {
    flex: 1;
    padding: 30px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  /* Painéis Estilizados */
  .panel {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .panel h2 { margin-top: 0; font-size: 1.1em; color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;}

  /* Elementos da Sidebar */
  .kpi-vertical { display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px; }
  .kpi-box { background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #334155; text-align: center; }
  .kpi-box span { display: block; font-size: 0.75em; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .kpi-box strong { font-size: 1.6em; color: #f1f5f9; }

  .status-indicator { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; background: ${data.status.color}; color: #fff; }

  /* Listas de Dados */
  .data-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;}
  .data-list li { display: flex; justify-content: space-between; font-size: 0.9em; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .data-list li span:first-child { color: #94a3b8; }
  .data-list li span:last-child { font-weight: 500; color: #e2e8f0; text-align: right;}

  /* Grid 3 Colunas na Main */
  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }

  /* Terminal */
  .terminal {
    background: #000;
    color: #4ade80;
    font-family: 'Courier New', Courier, monospace;
    padding: 15px;
    border-radius: 8px;
    height: 180px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid #333;
  }

  /* Scrollbar customizada */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>
</head>
<body>

  <!-- Barra Lateral -->
  <aside class="sidebar">
    <div class="brand">
      <h1>SO Dashboard</h1>
      <p>Node.js Server Monitor</p>
    </div>

    <div style="text-align: center; margin-bottom: 25px;">
      <span class="status-indicator">${data.status.text}</span>
    </div>

    <div class="kpi-vertical">
      <div class="kpi-box"><span>Uso de RAM</span><strong>${data.ramUsage}%</strong></div>
      <div class="kpi-box"><span>Carga CPU</span><strong>${data.avgCpu}%</strong></div>
      <div class="kpi-box"><span>Tráfego Web</span><strong>${totalRequests}</strong></div>
    </div>

    <div class="panel" style="padding: 15px; margin-top: auto;">
      <h2 style="font-size: 0.9em; margin-bottom: 10px;">Git Status</h2>
      <ul class="data-list" style="font-size: 0.85em;">
        <li><span>Branch</span> <span>${data.git.branch}</span></li>
        <li><span>Commit</span> <span>${data.git.hash}</span></li>
      </ul>
    </div>
  </aside>

  <!-- Área Principal -->
  <main class="main-content">
    
    <!-- Seção: Gráfico Superior -->
    <div class="panel">
      <h2>Métricas de Memória (Linha do Tempo)</h2>
      <div style="height: 220px; width: 100%;">
        <canvas id="ramChart"></canvas>
      </div>
    </div>

    <!-- Seção: Grade de Informações -->
    <div class="grid-3">
      
      <div class="panel">
        <h2>Hardware Base</h2>
        <ul class="data-list">
          <li><span>Processador</span> <span>${data.cpus[0].model}</span></li>
          <li><span>Núcleos</span> <span>${data.cpus.length} vCPUs</span></li>
          <li><span>RAM Total</span> <span>${toGB(os.totalmem())} GB</span></li>
          <li><span>Node (RSS)</span> <span>${toMB(process.memoryUsage().rss)} MB</span></li>
          <li><span>Disco Total</span> <span>${data.disk.size}</span></li>
          <li><span>Disco Usado</span> <span>${data.disk.used} (${data.disk.percent})</span></li>
          <li><span>Load (1m)</span> <span>${os.loadavg()[0].toFixed(2)}</span></li>
        </ul>
      </div>

      <div class="panel">
        <h2>Ambiente e SO</h2>
        <ul class="data-list">
          <li><span>Plataforma</span> <span>${os.type()} ${os.arch()}</span></li>
          <li><span>Hostname</span> <span>${os.hostname()}</span></li>
          <li><span>IP Principal</span> <span>${data.mainIP}</span></li>
          <li><span>Versão Node</span> <span>${process.version}</span></li>
          <li><span>NODE_ENV</span> <span>${process.env.NODE_ENV || 'N/A'}</span></li>
          <li><span>Uptime (OS)</span> <span>${formatUptime(os.uptime())}</span></li>
          <li><span>Uptime (App)</span> <span>${formatUptime(process.uptime())}</span></li>
        </ul>
      </div>

      <div class="panel">
        <h2>Arquivos na Raiz</h2>
        <ul class="data-list">
          ${data.files.map(f => `<li><span>📄 ${f}</span> <span style="font-size: 0.8em; color: #10b981;">Lido</span></li>`).join("") || "<li>Nenhum arquivo</li>"}
        </ul>
      </div>

    </div>

    <!-- Seção: Terminal Inferior -->
    <div class="panel">
      <h2>Console Interativo (Logs)</h2>
      <div class="terminal">
        ${logsArray.length > 0 ? logsArray.join("<br>") : "Aguardando eventos do sistema..."}
      </div>
    </div>

  </main>

  <script>
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const ctx = document.getElementById('ramChart').getContext('2d');
    const history = ${JSON.stringify(ramHistory)};
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.time),
        datasets: [{
          label: 'Uso de RAM (%)',
          data: history.map(h => h.value),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 2, 
          tension: 0.4, 
          fill: true, 
          pointRadius: 3,
          pointBackgroundColor: '#0ea5e9'
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false,
        scales: { 
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { color: 'rgba(255,255,255,0.05)' } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => console.log("Painel Admin rodando na porta " + PORT));
