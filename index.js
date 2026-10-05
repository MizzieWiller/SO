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
    if (res.ok) console.log(`[SYS_PING] Sonda orbital ativa. Telemetria retransmitida com sucesso.`);
  } catch (err) {
    console.log(`[SYS_ERR] Perda temporária de sinal: ${err.message}`);
  }
}, 600000);

let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-PT');
  logsArray.unshift(`[${time}] > ${args.join(" ")}`); 
  if (logsArray.length.toString() > 15) logsArray.pop(); 
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
  const status = ramUsage > 85 ? { text: "CRÍTICO", color: "#ff003c" } : 
                 (ramUsage > 65 ? { text: "SOBRECARGA", color: "#ffea00" } : 
                 { text: "ESTÁVEL", color: "#00f0ff" });

  return { cpus, avgCpu, disk, git, mainIP, files, ramUsage, status };
}

/* =========================
   Geração da Interface HUD Avançada
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
<title>HUD Tático Avançado | Comando Orbital</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Share+Tech+Mono&display=swap');
  
  :root {
    --bg-color: #020408;
    --hud-cyan: #00f0ff;
    --hud-cyan-dim: rgba(0, 240, 255, 0.12);
    --hud-cyan-glow: 0 0 12px rgba(0, 240, 255, 0.4);
    --hud-alert: #ff003c;
    --hud-warn: #ffea00;
    --text-color: #c5f0ff;
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
    background-image: 
      radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.04) 0%, transparent 70%);
  }

  /* Scanlines e Radar de Fundo */
  .scanlines {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 50%);
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 999;
  }

  .radar-bg {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 800px; height: 800px;
    border: 1px dashed rgba(0, 240, 255, 0.05);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    animation: spin 60s linear infinite;
  }
  @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

  /* Grelha Principal */
  .hud-wrapper {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-areas: 
      "header header header"
      "left center right"
      "bottom bottom bottom";
    grid-template-columns: 340px 1fr 340px;
    grid-template-rows: auto 1fr 200px;
    gap: 15px;
    padding: 15px;
    height: 100vh;
    box-sizing: border-box;
  }

  header { 
    grid-area: header; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid var(--hud-cyan); 
    padding-bottom: 8px;
    background: linear-gradient(90deg, rgba(0,240,255,0.1), transparent);
  }
  header h1 { 
    margin: 0; 
    font-family: 'Orbitron', sans-serif;
    font-size: 1.8em; 
    color: var(--hud-cyan); 
    text-shadow: var(--hud-cyan-glow); 
    letter-spacing: 3px; 
  }
  header .status-box { 
    background: ${data.status.color}; 
    color: #000; 
    padding: 6px 16px; 
    font-family: 'Orbitron', sans-serif;
    font-weight: 800; 
    letter-spacing: 2px;
    box-shadow: 0 0 10px ${data.status.color};
  }

  /* Painéis Estilo Sci-Fi Tático */
  .hud-panel {
    background: rgba(2, 12, 27, 0.75);
    border: 1px solid var(--hud-cyan);
    padding: 15px;
    clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
    position: relative;
    display: flex;
    flex-direction: column;
    box-shadow: inset 0 0 20px var(--hud-cyan-dim);
  }

  .hud-panel h2 { 
    margin-top: 0; 
    font-family: 'Orbitron', sans-serif;
    font-size: 0.95em; 
    color: var(--hud-cyan); 
    border-bottom: 1px solid var(--hud-cyan-dim); 
    padding-bottom: 6px; 
    margin-bottom: 12px; 
    letter-spacing: 2px;
    display: flex;
    justify-content: space-between;
  }

  .area-left { grid-area: left; }
  .area-center { grid-area: center; display: flex; flex-direction: column; gap: 15px; }
  .area-right { grid-area: right; }
  .area-bottom { grid-area: bottom; }

  /* Barras de Energia Estilo Futuristicas */
  .energy-bar-container {
    background: rgba(0, 240, 255, 0.1);
    border: 1px solid var(--hud-cyan);
    height: 10px;
    width: 100%;
    position: relative;
    margin-top: 5px;
    overflow: hidden;
  }
  .energy-bar-fill {
    background: var(--hud-cyan);
    height: 100%;
    width: ${data.ramUsage}%;
    box-shadow: var(--hud-cyan-glow);
    transition: width 0.5s ease;
  }

  /* KPIs Centrais */
  .kpi-target { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
  .kpi-item { 
    border: 1px solid var(--hud-cyan); 
    padding: 12px; 
    text-align: center; 
    background: rgba(0, 240, 255, 0.04);
    position: relative;
  }
  .kpi-item span { display: block; font-size: 0.75em; color: #7cb8cc; margin-bottom: 5px; letter-spacing: 1px; }
  .kpi-item strong { font-family: 'Orbitron', sans-serif; font-size: 1.6em; color: var(--hud-cyan); text-shadow: var(--hud-cyan-glow); }

  /* Listas de Dados */
  .telemetry-list { list-style: none; padding: 0; margin: 0; flex: 1; }
  .telemetry-list li { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 9px; border-bottom: 1px dotted rgba(0,240,255,0.1); padding-bottom: 4px; }
  .telemetry-list li span:first-child { color: #699fb3; }
  .telemetry-list li span:last-child { color: #fff; text-align: right; font-weight: bold; }

  /* Terminal Estelar */
  .terminal-output {
    flex: 1;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.4;
    color: #00f0ff;
    padding-right: 5px;
  }
  .log-line { border-left: 2px solid var(--hud-cyan); padding-left: 8px; margin-bottom: 3px; background: rgba(0,240,255,0.02); }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--hud-cyan); }

  .blink { animation: blinker 0.8s ease-in-out infinite alternate; }
  @keyframes blinker { 0% { opacity: 1; } 100% { opacity: 0.3; } }
</style>
</head>
<body>
  
  <div class="scanlines"></div>
  <div class="radar-bg"></div>

  <div class="hud-wrapper">
    <!-- Cabeçalho -->
    <header>
      <div>
        <h1>ORBITAL.SYS // v3.0</h1>
        <div style="font-size: 0.75em; color: #699fb3; margin-top: 2px;">TIMESTAMP: ${new Date().toLocaleTimeString('pt-PT')} | UPTIME: ${formatUptime(process.uptime())}</div>
      </div>
      <div class="status-box ${data.ramUsage > 85 ? 'blink' : ''}">ESTADO: ${data.status.text}</div>
    </header>

    <!-- Coluna Esquerda: Hardware -->
    <div class="hud-panel area-left">
      <h2><span>[ NÚCLEO FÍSICO ]</span> <span>HARDWARE</span></h2>
      <ul class="telemetry-list">
        <li><span>CPU:</span> <span>${data.cpus[0].model.substring(0, 16)}...</span></li>
        <li><span>VCPUS ATIVOS:</span> <span>${data.cpus.length}</span></li>
        <li><span>ARQ:</span> <span>${os.arch()}</span></li>
        <li><span>RAM TOTAL:</span> <span>${toGB(os.totalmem())} GB</span></li>
        <li><span>RSS (NODE):</span> <span>${toMB(process.memoryUsage().rss)} MB</span></li>
        <li style="margin-top: 10px; border-top: 1px solid var(--hud-cyan); padding-top: 5px;"><span>DISCO TOTAL:</span> <span>${data.disk.size}</span></li>
        <li><span>DISCO USADO:</span> <span>${data.disk.used} (${data.disk.percent})</span></li>
        <li><span>DISCO LIVRE:</span> <span>${data.disk.avail}</span></li>
      </ul>
    </div>

    <!-- Coluna Central: Alvo Principal (Gráfico e KPIs) -->
    <div class="area-center">
      <div class="kpi-target">
        <div class="kpi-item">
          <span>MOTOR CPU</span>
          <strong>${data.avgCpu}%</strong>
        </div>
        <div class="kpi-item">
          <span>MEMÓRIA RAM</span>
          <strong>${data.ramUsage}%</strong>
          <div class="energy-bar-container"><div class="energy-bar-fill"></div></div>
        </div>
        <div class="kpi-item">
          <span>TRÁFEGO WEB</span>
          <strong>${totalRequests}</strong>
        </div>
      </div>
      
      <div class="hud-panel" style="flex: 1;">
        <h2><span>[ TELEMETRIA AO VIVO ]</span> <span>ESPECTRO DE RAM</span></h2>
        <div style="flex: 1; min-height: 160px; position: relative;">
          <canvas id="ramChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Coluna Direita: Ambiente, Git e Ficheiros -->
    <div class="hud-panel area-right">
      <h2><span>[ AMBIENTE & REDE ]</span> <span>INFRA</span></h2>
      <ul class="telemetry-list">
        <li><span>SO:</span> <span>${os.type()}</span></li>
        <li><span>HOSTNAME:</span> <span>${os.hostname()}</span></li>
        <li><span>IP:</span> <span>${data.mainIP}</span></li>
        <li><span>NODE:</span> <span>v${process.version}</span></li>
        <li><span>BRANCH:</span> <span>${data.git.branch}</span></li>
        <li><span>COMMIT:</span> <span>${data.git.hash}</span></li>
      </ul>

      <h2 style="margin-top: 10px;"><span>[ DIRETÓRIO ]</span> <span>RAIZ</span></h2>
      <ul class="telemetry-list" style="font-size: 0.75em; color: var(--hud-cyan);">
        ${data.files.map(f => `<li><span>FILE:</span> <span>${f}</span></li>`).join("") || "<li>VAZIO</li>"}
      </ul>
    </div>

    <!-- Base: Terminal Horizontal -->
    <div class="hud-panel area-bottom">
      <h2><span>[ REGISTOS DE EVENTOS ]</span> <span class="blink">TERMINAL ATIVO</span></h2>
      <div class="terminal-output">
        ${logsArray.length > 0 ? logsArray.map(log => `<div class="log-line">${log}</div>`).join("") : '<div class="log-line">A AGUARDAR FLUXO DE DADOS...</div>'}
      </div>
    </div>
  </div>

  <script>
    Chart.defaults.color = '#699fb3';
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    
    const ctx = document.getElementById('ramChart').getContext('2d');
    const history = ${JSON.stringify(ramHistory)};
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.time),
        datasets: [{
          label: 'RAM (%)',
          data: history.map(h => h.value),
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.15)',
          borderWidth: 2, 
          tension: 0.2, 
          fill: true, 
          pointRadius: 2,
          pointBackgroundColor: '#00f0ff'
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false,
        scales: { 
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0, 240, 255, 0.1)' }, border: { dash: [3, 3] } },
          x: { grid: { color: 'rgba(0, 240, 255, 0.05)' }, ticks: { display: false } } 
        },
        plugins: { legend: { display: false } }
      }
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("Interface HUD Avançada pronta na porta " + PORT));
