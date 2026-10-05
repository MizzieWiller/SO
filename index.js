const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Monitorização & Anti-Hibernação
========================= */
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com"; 
setInterval(async () => {
  try {
    const res = await fetch(URL_DO_SEU_SITE);
    if (res.ok) console.log(`[SYS_PING] Sinal de telemetria emitido. Conexão estável.`);
  } catch (err) {
    console.log(`[SYS_ERR] Falha de comunicação: ${err.message}`);
  }
}, 600000);

let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-PT');
  logsArray.unshift(`[${time}] > ${args.join(" ")}`); 
  if (logsArray.length > 15) logsArray.pop(); 
  originalLog.apply(console, args);
};

app.use((req, res, next) => { totalRequests++; next(); });

setInterval(() => {
  const percent = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
  ramHistory.push({ time: new Date().toLocaleTimeString('pt-PT'), value: percent });
  if (ramHistory.length > 25) ramHistory.shift(); 
}, 10000);

/* =========================
   Módulos de Extração de Dados
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

  let git = { hash: 'N/A', branch: 'N/A', msg: 'Sem dados' };
  try {
    git.hash = execSync("git rev-parse --short HEAD").toString().trim();
    git.branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    git.msg = execSync("git log -1 --pretty=%B").toString().trim();
  } catch (e) {}

  const ips = Object.values(os.networkInterfaces()).flat().filter(i => !i.internal && i.family === "IPv4");
  const mainIP = ips.length ? ips[0].address : "N/A";

  let files = [];
  try { files = fs.readdirSync(".").slice(0, 7); } catch (e) {}

  const ramUsage = calcPercent(os.totalmem() - os.freemem(), os.totalmem());
  const status = ramUsage > 85 ? { text: "FALHA IMINENTE", color: "#ff003c" } : 
                 (ramUsage > 65 ? { text: "SOBRECARGA", color: "#ffea00" } : 
                 { text: "OPERAÇÕES NORMAIS", color: "#00f0ff" });

  return { cpus, avgCpu, disk, git, mainIP, files, ramUsage, status };
}

/* =========================
   Geração da Interface HUD
========================= */
app.get("/", (req, res) => {
  const data = getSystemData();
  if (ramHistory.length === 0) ramHistory.push({ time: new Date().toLocaleTimeString('pt-PT'), value: data.ramUsage });

  res.send(`<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HUD Tático | Monitorização</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
  
  :root {
    --bg-color: #03070c;
    --hud-cyan: #00f0ff;
    --hud-cyan-dim: rgba(0, 240, 255, 0.15);
    --hud-alert: #ff003c;
    --text-color: #d1f8ff;
  }

  body {
    font-family: 'Share Tech Mono', monospace;
    margin: 0;
    padding: 0;
    background-color: var(--bg-color);
    color: var(--text-color);
    height: 100vh;
    overflow: hidden;
    text-transform: uppercase;
  }

  .scanlines {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%);
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 999;
  }

  .hud-wrapper {
    display: grid;
    grid-template-areas: 
      "header header header"
      "left center right"
      "bottom bottom bottom";
    grid-template-columns: 320px 1fr 320px;
    grid-template-rows: auto 1fr 220px;
    gap: 20px;
    padding: 20px;
    height: 100%;
    box-sizing: border-box;
  }

  header { grid-area: header; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid var(--hud-cyan); padding-bottom: 10px; }
  header h1 { margin: 0; font-size: 2em; color: var(--hud-cyan); text-shadow: 0 0 10px var(--hud-cyan); letter-spacing: 4px; }
  header .status-box { background: ${data.status.color}; color: #000; padding: 5px 15px; font-weight: bold; letter-spacing: 2px; }

  .hud-panel {
    background: rgba(0, 20, 40, 0.4);
    border: 1px solid var(--hud-cyan);
    padding: 20px;
    clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px);
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .hud-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    box-shadow: inset 0 0 30px var(--hud-cyan-dim); pointer-events: none;
  }

  .hud-panel h2 { margin-top: 0; font-size: 1.1em; color: var(--hud-cyan); border-bottom: 1px dashed var(--hud-cyan-dim); padding-bottom: 10px; margin-bottom: 15px; letter-spacing: 1px;}

  .area-left { grid-area: left; }
  .area-center { grid-area: center; display: flex; flex-direction: column; gap: 20px; }
  .area-right { grid-area: right; }
  .area-bottom { grid-area: bottom; }

  .kpi-target { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
  .kpi-item { border: 1px solid var(--hud-cyan); padding: 15px; text-align: center; background: rgba(0, 240, 255, 0.05); }
  .kpi-item span { display: block; font-size: 0.8em; color: #8cb4c7; margin-bottom: 10px; }
  .kpi-item strong { font-size: 2em; color: var(--hud-cyan); text-shadow: 0 0 8px var(--hud-cyan); }

  .telemetry-list { list-style: none; padding: 0; margin: 0; flex: 1; }
  .telemetry-list li { display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 12px; }
  .telemetry-list li span:first-child { color: #5a8d9e; }
  .telemetry-list li span:last-child { color: #fff; text-align: right; }

  .terminal-output {
    flex: 1;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.4;
    color: #fff;
    padding-right: 10px;
  }
  .log-line { border-left: 2px solid var(--hud-cyan); padding-left: 10px; margin-bottom: 4px; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--hud-cyan); }

  .blink { animation: blinker 1s linear infinite; }
  @keyframes blinker { 50% { opacity: 0; } }
</style>
</head>
<body>
  
  <div class="scanlines"></div>

  <div class="hud-wrapper">
    <!-- Cabeçalho -->
    <header>
      <div>
        <h1>SYS.MONITOR.v2</h1>
        <div style="font-size: 0.8em; color: #5a8d9e; margin-top: 5px;">T: ${new Date().toLocaleTimeString('pt-PT')} // UPTIME: ${formatUptime(process.uptime())}</div>
      </div>
      <div class="status-box ${data.ramUsage > 85 ? 'blink' : ''}">ESTADO: ${data.status.text}</div>
    </header>

    <!-- Coluna Esquerda: Hardware -->
    <div class="hud-panel area-left">
      <h2>// ESPECIFICAÇÕES FÍSICAS</h2>
      <ul class="telemetry-list">
        <li><span>PROCESSADOR:</span> <span>${data.cpus[0].model.substring(0, 15)}...</span></li>
        <li><span>NÚCLEOS ATIVOS:</span> <span>${data.cpus.length}</span></li>
        <li><span>ARQUITETURA:</span> <span>${os.arch()}</span></li>
        <li><span>MEMÓRIA FÍSICA:</span> <span>${toGB(os.totalmem())} GB</span></li>
        <li><span>USO INTERNO (NODE):</span> <span>${toMB(process.memoryUsage().rss)} MB</span></li>
        <li style="margin-top: 20px; border-top: 1px dashed var(--hud-cyan-dim); padding-top: 10px;"><span>ARMAZENAMENTO:</span> <span>${data.disk.size}</span></li>
        <li><span>ESPAÇO UTILIZADO:</span> <span>${data.disk.used} (${data.disk.percent})</span></li>
        <li><span>ESPAÇO LIVRE:</span> <span>${data.disk.avail}</span></li>
      </ul>
    </div>

    <!-- Coluna Central: Alvo Principal (Gráfico e KPIs) -->
    <div class="area-center">
      <div class="kpi-target">
        <div class="kpi-item"><span>CARGA DO MOTOR</span><strong>${data.avgCpu}%</strong></div>
        <div class="kpi-item"><span>USO DE RAM</span><strong>${data.ramUsage}%</strong></div>
        <div class="kpi-item"><span>REQUISIÇÕES EXT.</span><strong>${totalRequests}</strong></div>
      </div>
      
      <div class="hud-panel" style="flex: 1;">
        <h2>// TELEMETRIA DE MEMÓRIA (TEMPO REAL)</h2>
        <div style="flex: 1; min-height: 200px; position: relative;">
          <canvas id="ramChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Coluna Direita: Ambiente e Ficheiros -->
    <div class="hud-panel area-right">
      <h2>// AMBIENTE & REDE</h2>
      <ul class="telemetry-list">
        <li><span>SISTEMA (OS):</span> <span>${os.type()}</span></li>
        <li><span>ID DA MÁQUINA:</span> <span>${os.hostname()}</span></li>
        <li><span>IP DE SINAL:</span> <span>${data.mainIP}</span></li>
        <li><span>MOTOR (NODE):</span> <span>v${process.version}</span></li>
      </ul>
      
      <h2 style="margin-top: 20px;">// REGISTO GIT</h2>
      <ul class="telemetry-list">
        <li><span>ROTA (BRANCH):</span> <span>${data.git.branch}</span></li>
        <li><span>HASH:</span> <span>${data.git.hash}</span></li>
      </ul>

      <h2 style="margin-top: 20px;">// LISTAGEM DO DIRETÓRIO</h2>
      <ul class="telemetry-list" style="font-size: 0.8em; color: var(--hud-cyan);">
        ${data.files.map(f => `<li><span>[FILE]</span> <span>${f}</span></li>`).join("") || "<li>VAZIO</li>"}
      </ul>
    </div>

    <!-- Base: Terminal Horizontal -->
    <div class="hud-panel area-bottom">
      <h2>// FLUXO DE EVENTOS DO SISTEMA <span class="blink" style="float: right;">_</span></h2>
      <div class="terminal-output">
        ${logsArray.length > 0 ? logsArray.map(log => `<div class="log-line">${log}</div>`).join("") : '<div class="log-line">A AGUARDAR DADOS DE ENTRADA...</div>'}
      </div>
    </div>
  </div>

  <script>
    Chart.defaults.color = '#5a8d9e';
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    
    const ctx = document.getElementById('ramChart').getContext('2d');
    const history = ${JSON.stringify(ramHistory)};
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.time),
        datasets: [{
          label: 'RAM ALOCADA (%)',
          data: history.map(h => h.value),
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          borderWidth: 2, 
          tension: 0, 
          fill: true, 
          pointRadius: 0, 
          stepped: false
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false,
        scales: { 
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0, 240, 255, 0.2)' }, border: { dash: [5, 5] } },
          x: { grid: { color: 'rgba(0, 240, 255, 0.2)' }, border: { dash: [5, 5] }, ticks: { display: false } } 
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("Interface HUD inicializada na porta " + PORT));
