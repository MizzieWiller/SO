const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Monitorização & Anti-Hibernação (Sonda)
========================= */
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com"; 
setInterval(async () => {
  try {
    const res = await fetch(URL_DO_SEU_SITE);
    if (res.ok) console.log(`[Telemetria] Ping orbital executado. O expresso continua a sua viagem.`);
  } catch (err) {
    console.log(`[Telemetria] Falha no sinal: ${err.message}`);
  }
}, 600000); // 10 minutos

let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-PT');
  logsArray.unshift(`[${time}] ${args.join(" ")}`); 
  if (logsArray.length > 15) logsArray.pop(); 
  originalLog.apply(console, args);
};

app.use((req, res, next) => { totalRequests++; next(); });

setInterval(() => {
  const percent = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
  ramHistory.push({ time: new Date().toLocaleTimeString('pt-PT'), value: percent });
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

  let git = { hash: 'N/A', branch: 'N/A', msg: 'Sem dados' };
  try {
    git.hash = execSync("git rev-parse --short HEAD").toString().trim();
    git.branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    git.msg = execSync("git log -1 --pretty=%B").toString().trim();
  } catch (e) {}

  const ips = Object.values(os.networkInterfaces()).flat().filter(i => !i.internal && i.family === "IPv4");
  const mainIP = ips.length ? ips[0].address : "Desconhecido";

  let files = [];
  try { files = fs.readdirSync(".").slice(0, 8); } catch (e) {}

  const ramUsage = calcPercent(os.totalmem() - os.freemem(), os.totalmem());
  const status = ramUsage > 85 ? { text: "CRÍTICO", color: "#ff4d4f", glow: "rgba(255,77,79,0.5)" } : 
                 (ramUsage > 65 ? { text: "ALERTA", color: "#faad14", glow: "rgba(250,173,20,0.5)" } : 
                 { text: "ESTÁVEL", color: "#00e5ff", glow: "rgba(0,229,255,0.5)" });

  return { cpus, avgCpu, disk, git, mainIP, files, ramUsage, status };
}

/* =========================
   Geração da Interface (Astral)
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
<title>Terminal Astral | Monitorização</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Noto+Sans:wght@300;400;600&display=swap');
  
  :root {
    --bg-deep: #05070e;
    --bg-panel: #0d1222;
    --text-main: #c7d2fe;
    --text-muted: #6366f1;
    --accent-gold: #d4af37;
    --accent-cyan: #00e5ff;
    --border-subtle: rgba(99, 102, 241, 0.2);
  }

  * { box-sizing: border-box; }
  
  body {
    font-family: 'Noto Sans', sans-serif;
    margin: 0;
    display: flex;
    height: 100vh;
    background: var(--bg-deep);
    color: var(--text-main);
    overflow: hidden;
    background-image: 
      radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.05), transparent 25%),
      radial-gradient(circle at 85% 30%, rgba(0, 229, 255, 0.05), transparent 25%);
  }
  
  /* Sidebar / Painel de Controlo Lateral */
  .sidebar {
    width: 300px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    padding: 30px 20px;
    overflow-y: auto;
    box-shadow: 5px 0 20px rgba(0,0,0,0.5);
    z-index: 10;
  }

  .brand { margin-bottom: 40px; text-align: center; }
  .brand h1 { 
    margin: 0; 
    font-family: 'Rajdhani', sans-serif; 
    font-size: 2.2em; 
    font-weight: 700; 
    color: var(--accent-gold); 
    text-transform: uppercase;
    letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
  }
  .brand p { margin: 5px 0 0; font-size: 0.85em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

  .status-badge {
    display: inline-block;
    padding: 8px 20px;
    border-radius: 4px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 1.1em;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--bg-deep);
    background: ${data.status.color};
    box-shadow: 0 0 15px ${data.status.glow};
    text-transform: uppercase;
  }

  /* Grid KPIs na Sidebar */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
  .kpi-box { 
    background: rgba(5, 7, 14, 0.8); 
    padding: 15px; 
    border-radius: 6px; 
    border: 1px solid var(--border-subtle); 
    text-align: center; 
    border-top: 2px solid var(--accent-cyan);
  }
  .kpi-box span { display: block; font-family: 'Rajdhani', sans-serif; font-size: 0.85em; color: var(--text-muted); text-transform: uppercase; margin-bottom: 5px; }
  .kpi-box strong { font-family: 'Rajdhani', sans-serif; font-size: 1.8em; color: #fff; }

  .kpi-box.full-width { grid-column: 1 / -1; border-top-color: var(--accent-gold); }

  /* Área Principal */
  .main-content {
    flex: 1;
    padding: 30px 40px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  /* Painéis de Dados */
  .hologram-panel {
    background: rgba(13, 18, 34, 0.6);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 25px;
    position: relative;
    backdrop-filter: blur(4px);
  }
  
  .hologram-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 30px; height: 30px;
    border-top: 2px solid var(--accent-cyan);
    border-left: 2px solid var(--accent-cyan);
    border-top-left-radius: 8px;
  }
  .hologram-panel::after {
    content: '';
    position: absolute;
    bottom: 0; right: 0;
    width: 30px; height: 30px;
    border-bottom: 2px solid var(--accent-cyan);
    border-right: 2px solid var(--accent-cyan);
    border-bottom-right-radius: 8px;
  }

  .hologram-panel h2 { 
    margin-top: 0; 
    font-family: 'Rajdhani', sans-serif; 
    font-size: 1.4em; 
    color: #fff; 
    border-bottom: 1px solid var(--border-subtle); 
    padding-bottom: 10px; 
    margin-bottom: 20px; 
    text-transform: uppercase; 
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Listas de Informação */
  .data-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px;}
  .data-list li { display: flex; justify-content: space-between; font-size: 0.9em; padding-bottom: 8px; border-bottom: 1px dashed rgba(99, 102, 241, 0.15); }
  .data-list li span:first-child { color: var(--text-muted); font-family: 'Rajdhani', sans-serif; font-size: 1.1em; letter-spacing: 0.5px; }
  .data-list li span:last-child { font-weight: 600; color: #e0e7ff; text-align: right;}

  /* Grid de 3 Colunas */
  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }

  /* Terminal Estelar */
  .terminal-box {
    background: #020306;
    color: var(--accent-cyan);
    font-family: 'Courier New', Courier, monospace;
    padding: 20px;
    border-radius: 4px;
    height: 220px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.6;
    border: 1px solid rgba(0, 229, 255, 0.2);
    box-shadow: inset 0 0 20px rgba(0, 229, 255, 0.05);
  }

  /* Scrollbar Intergaláctica */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg-deep); }
  ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-cyan); }
</style>
</head>
<body>

  <!-- Menu de Navegação Esquerdo -->
  <aside class="sidebar">
    <div class="brand">
      <h1>Arquivo Astral</h1>
      <p>Rede de Monitorização Node</p>
    </div>

    <div style="text-align: center; margin-bottom: 40px;">
      <span class="status-badge">${data.status.text}</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box"><span>RAM Acumulada</span><strong>${data.ramUsage}%</strong></div>
      <div class="kpi-box"><span>Stress Motor</span><strong>${data.avgCpu}%</strong></div>
      <div class="kpi-box full-width"><span>Sondas Recebidas (Tráfego)</span><strong>${totalRequests}</strong></div>
    </div>

    <div class="hologram-panel" style="padding: 15px; margin-top: auto; border: none; background: rgba(0,0,0,0.3);">
      <h2 style="font-size: 1.1em; margin-bottom: 15px; color: var(--accent-gold); border-bottom-color: rgba(212, 175, 55, 0.2);">Coordenadas Git</h2>
      <ul class="data-list" style="font-size: 0.85em;">
        <li><span>Rota (Branch)</span> <span>${data.git.branch}</span></li>
        <li><span>Salto (Commit)</span> <span>${data.git.hash}</span></li>
        <li style="border:none; padding-top:10px;"><span style="color:#fff; font-size:0.9em; font-style:italic;">"${data.git.msg}"</span></li>
      </ul>
    </div>
  </aside>

  <!-- Área Principal de Dados -->
  <main class="main-content">
    
    <!-- Gráfico de Espectro -->
    <div class="hologram-panel">
      <h2><span style="color: var(--accent-cyan);">✦</span> Espectro de Memória (Linha Temporal)</h2>
      <div style="height: 250px; width: 100%;">
        <canvas id="ramChart"></canvas>
      </div>
    </div>

    <!-- Modulos de Informação -->
    <div class="grid-3">
      
      <div class="hologram-panel">
        <h2><span style="color: var(--accent-gold);">✦</span> Núcleo de Hardware</h2>
        <ul class="data-list">
          <li><span>Processador Base</span> <span>${data.cpus[0].model}</span></li>
          <li><span>Cilindros (Cores)</span> <span>${data.cpus.length} vCPUs</span></li>
          <li><span>Capacidade Total</span> <span>${toGB(os.totalmem())} GB</span></li>
          <li><span>Consumo Node</span> <span>${toMB(process.memoryUsage().rss)} MB</span></li>
          <li><span>Armazém Principal</span> <span>${data.disk.size}</span></li>
          <li><span>Massa Ocupada</span> <span>${data.disk.used} (${data.disk.percent})</span></li>
          <li><span>Gravidade (Load 1m)</span> <span>${os.loadavg()[0].toFixed(2)}</span></li>
        </ul>
      </div>

      <div class="hologram-panel">
        <h2><span style="color: var(--accent-gold);">✦</span> Atmosfera do Sistema</h2>
        <ul class="data-list">
          <li><span>Classificação SO</span> <span>${os.type()} ${os.arch()}</span></li>
          <li><span>Designação Host</span> <span>${os.hostname()}</span></li>
          <li><span>Frequência IP</span> <span>${data.mainIP}</span></li>
          <li><span>Versão do Motor</span> <span>${process.version}</span></li>
          <li><span>Diretriz (ENV)</span> <span>${process.env.NODE_ENV || 'Padrão'}</span></li>
          <li><span>Ciclo de Vida (OS)</span> <span>${formatUptime(os.uptime())}</span></li>
          <li><span>Ciclo de Vida (App)</span> <span>${formatUptime(process.uptime())}</span></li>
        </ul>
      </div>

      <div class="hologram-panel">
        <h2><span style="color: var(--accent-gold);">✦</span> Registo de Ficheiros</h2>
        <ul class="data-list">
          ${data.files.map(f => `<li><span>📄 ${f}</span> <span style="font-size: 0.8em; color: var(--accent-cyan);">Indexado</span></li>`).join("") || "<li>Nenhum ficheiro detetado</li>"}
        </ul>
      </div>

    </div>

    <!-- Registo de Logs -->
    <div class="hologram-panel" style="margin-bottom: 20px;">
      <h2><span style="color: var(--accent-cyan);">✦</span> Consola de Bordo (Eventos)</h2>
      <div class="terminal-box">
        ${logsArray.length > 0 ? logsArray.join("<br>") : "A escutar frequências do espaço profundo..."}
      </div>
    </div>

  </main>

  <script>
    Chart.defaults.color = '#6366f1';
    Chart.defaults.font.family = "'Noto Sans', sans-serif";
    
    const ctx = document.getElementById('ramChart').getContext('2d');
    const history = ${JSON.stringify(ramHistory)};
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.time),
        datasets: [{
          label: 'Alocação de RAM (%)',
          data: history.map(h => h.value),
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          borderWidth: 2, 
          tension: 0.4, 
          fill: true, 
          pointRadius: 4,
          pointBackgroundColor: '#00e5ff',
          pointBorderColor: '#05070e',
          pointBorderWidth: 2
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: false,
        scales: { 
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(99, 102, 241, 0.1)' } },
          x: { grid: { color: 'rgba(99, 102, 241, 0.1)' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 18, 34, 0.9)',
            titleFont: { family: 'Rajdhani', size: 14 },
            bodyFont: { family: 'Noto Sans', size: 13 },
            borderColor: '#00e5ff',
            borderWidth: 1
          }
        }
      }
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("Terminal Astral online na porta " + PORT));
