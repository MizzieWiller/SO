const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Plugin Anti-Hibernação (Sonda Espacial)
========================= */
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com"; // Substitua pelo seu link
const INTERVALO_PING = 600000; // 10 minutos

setInterval(async () => {
  try {
    const response = await fetch(URL_DO_SEU_SITE);
    if (response.ok) {
      console.log(`[🛰️ Sonda] Sinal de vida enviado. A estação orbital continua ativa e em órbita.`);
    }
  } catch (error) {
    console.log(`[☄️ Alerta] Falha na comunicação com a sonda: ${error.message}`);
  }
}, INTERVALO_PING);

/* =========================
   Memória da Estação
========================= */
let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-PT');
  const msg = `[${time}] ${args.join(" ")}`;
  logsArray.unshift(msg); 
  if (logsArray.length > 20) logsArray.pop(); 
  originalLog.apply(console, args);
};

app.use((req, res, next) => {
  totalRequests++;
  next();
});

setInterval(() => {
  const total = os.totalmem();
  const free = os.freemem();
  const percent = (((total - free) / total) * 100).toFixed(0);
  const time = new Date().toLocaleTimeString('pt-PT');
  
  ramHistory.push({ time, value: percent });
  if (ramHistory.length > 15) ramHistory.shift(); 
}, 10000);

/* =========================
   Módulos de Telemetria
========================= */
function gb(v) { return (v / 1024 / 1024 / 1024).toFixed(2); }
function mb(v) { return (v / 1024 / 1024).toFixed(2); }
function percent(part, total) { return total ? ((part / total) * 100).toFixed(0) : "0"; }

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function getIPs() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const name in nets) {
    for (const net of nets[name]) {
      list.push({ interface: name, address: net.address, family: net.family, internal: net.internal });
    }
  }
  return list;
}

function getMainIP(ips) {
  const ip = ips.find(i => !i.internal && i.family === "IPv4");
  return ip ? ip.address : "N/A";
}

function getFilesDetailed() {
  try {
    return fs.readdirSync(".").slice(0, 10).map(file => {
      const stat = fs.statSync(path.join(".", file));
      return {
        name: file,
        type: stat.isDirectory() ? "Dir" : "Ficheiro",
        size: stat.isDirectory() ? "-" : `${(stat.size / 1024).toFixed(2)} KB`
      };
    });
  } catch {
    return [];
  }
}

function getDiskSpace() {
  try {
    const df = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    return { size: df[1], used: df[2], avail: df[3], percent: df[4] };
  } catch (e) {
    return { size: 'N/A', used: 'N/A', avail: 'N/A', percent: '0%' };
  }
}

function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD").toString().trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const msg = execSync("git log -1 --pretty=%B").toString().trim();
    return { hash, branch, msg };
  } catch (e) {
    return { hash: 'N/A', branch: 'N/A', msg: 'Sem repositório local' };
  }
}

function cpuStats() {
  return os.cpus().map((cpu, index) => {
    const t = cpu.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    const used = total - t.idle;
    return { core: index, usage: percent(used, total), model: cpu.model };
  });
}

function healthStatus(ramUsage, loadAvg, cores) {
  if (ramUsage > 85 || loadAvg > cores) return { label: "PERIGO CRÍTICO", color: "#ef4444", glow: "rgba(239, 68, 68, 0.6)" };
  if (ramUsage > 65 || loadAvg > cores * 0.7) return { label: "ALERTA AMARELO", color: "#eab308", glow: "rgba(234, 179, 8, 0.6)" };
  return { label: "SISTEMAS ESTÁVEIS", color: "#06b6d4", glow: "rgba(6, 182, 212, 0.6)" };
}

/* =========================
   Interface Orbital
========================= */
app.get("/", (req, res) => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const ramPercent = Number(percent(used, total));

  const cpus = cpuStats();
  const cpuCount = cpus.length;
  const avgCpu = (cpus.reduce((sum, c) => sum + Number(c.usage), 0) / cpuCount).toFixed(0);

  const load = os.loadavg();
  const ips = getIPs();
  const mainIP = getMainIP(ips);
  const files = getFilesDetailed();
  const disk = getDiskSpace();
  const git = getGitInfo();
  const user = os.userInfo();
  const uptime = os.uptime();
  const health = healthStatus(ramPercent, load[0], cpuCount);

  if (ramHistory.length === 0) {
    ramHistory.push({ time: new Date().toLocaleTimeString('pt-PT'), value: ramPercent });
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🌌 Centro de Comando</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

body { 
  font-family: 'Space Mono', monospace; 
  background-color: #020617; 
  background-image: radial-gradient(circle at top center, #1e1b4b 0%, #020617 100%);
  margin: 0; 
  padding: 20px; 
  color: #e2e8f0; 
  min-height: 100vh;
}

h1 { text-align: center; margin-bottom: 5px; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(56,189,248,0.5); }
h2 { color: #818cf8; border-bottom: 1px solid rgba(129,140,248,0.3); padding-bottom: 8px; margin-top: 0; font-size: 1.1em; font-family: 'Nunito', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
.subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 0.9em; }

.top-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin-bottom: 30px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }

.card { 
  background: rgba(15, 23, 42, 0.7); 
  border-radius: 8px; 
  padding: 20px; 
  border: 1px solid rgba(56, 189, 248, 0.2); 
  box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
  backdrop-filter: blur(5px);
  transition: all 0.3s ease; 
}
.card:hover { 
  transform: translateY(-2px); 
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); 
}

.terminal { background: #000; color: #4ade80; font-family: 'Space Mono', monospace; font-size: 13px; padding: 15px; border-radius: 4px; height: 180px; overflow-y: auto; border: 1px solid #333; line-height: 1.6; }

.kpi { text-align: center; background: rgba(30, 27, 75, 0.5); border: 1px solid #6366f1; }
.kpi h3 { color: #a5b4fc; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Nunito', sans-serif;}
.kpi .value { font-size: 24px; font-weight: bold; margin-top: 8px; color: #fff; text-shadow: 0 0 8px rgba(255,255,255,0.4); }

.bar { background: #1e293b; height: 12px; border-radius: 6px; overflow: hidden; margin-top: 5px; border: 1px solid #334155; }
.fill { background: linear-gradient(90deg, #3b82f6, #38bdf8); height: 100%; color: #000; text-align: center; line-height: 12px; font-size: 9px; font-weight: bold; box-shadow: 0 0 10px rgba(56,189,248,0.5); }

table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
th, td { padding: 8px; border-bottom: 1px solid #1e293b; text-align: left; }
th { color: #818cf8; font-family: 'Nunito', sans-serif; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;}

.badge { display: inline-block; padding: 6px 12px; border-radius: 4px; color: #fff; font-weight: bold; font-size: 12px; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.3); }
.code-inline { background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); }
p { margin: 8px 0; font-size: 14px; color: #cbd5e1; }
b { color: #f8fafc; font-family: 'Nunito', sans-serif;}
</style>
</head>

<body>

<h1>🚀 Centro de Comando Orbital 🚀</h1>
<div class="subtitle">Sincronização estelar concluída às: ${new Date().toLocaleTimeString('pt-PT')}</div>

<!-- KPIs -->
<div class="top-grid">
  <div class="card kpi"><h3>🌑 Matéria Escura (RAM)</h3><div class="value">${ramPercent}%</div></div>
  <div class="card kpi"><h3>☄️ Núcleo Propulsor</h3><div class="value">${avgCpu}%</div></div>
  <div class="card kpi"><h3>🛸 Sondas Intercetadas</h3><div class="value">${totalRequests}</div></div>
  <div class="card kpi"><h3>⏳ Tempo de Missão</h3><div class="value" style="font-size: 16px;">${formatUptime(process.uptime())}</div></div>
  <div class="card kpi" style="border-color: ${health.color}; box-shadow: 0 0 15px ${health.glow};">
    <h3 style="color: ${health.color};">Integridade do Casco</h3>
    <div class="value"><span class="badge" style="background:${health.color};">${health.label}</span></div>
  </div>
</div>

<div class="grid">

<!-- Bloco: Sistema -->
<div class="card">
  <h2>🛰️ Especificações da Nave</h2>
  <p><b>Modelo:</b> ${os.type()}</p>
  <p><b>Plataforma:</b> ${os.platform()}</p>
  <p><b>Kernel (OS):</b> ${os.release()}</p>
</div>

<!-- Bloco: Identificação -->
<div class="card">
  <h2>👨‍🚀 Credenciais de Piloto</h2>
  <p><b>Designação:</b> ${os.hostname()}</p>
  <p><b>Comandante:</b> ${user.username}</p>
  <p><b>Alojamentos:</b> ${os.homedir()}</p>
</div>

<!-- Bloco: CPU -->
<div class="card">
  <h2>⚙️ Reatores Principais (CPU)</h2>
  <p><b>Arquitetura:</b> <span class="code-inline">${os.arch()}</span></p>
  <p><b>Cilindros (Cores):</b> ${cpuCount}</p>
  <p><b>Motor:</b> ${cpus[0].model}</p>
</div>

<!-- Bloco: Carga -->
<div class="card">
  <h2>📈 Stress do Reator</h2>
  <p><b>Último parsec (1m):</b> ${load[0].toFixed(2)}</p>
  <p><b>Últimos 5m:</b> ${load[1].toFixed(2)}</p>
  <p><b>Últimos 15m:</b> ${load[2].toFixed(2)}</p>
</div>

<!-- Bloco: Memória Servidor -->
<div class="card">
  <h2>🌌 Reservas de Matéria (Servidor)</h2>
  <p><b>Capacidade Total:</b> ${gb(total)} GB</p>
  <p><b>Vácuo (Livre):</b> ${gb(free)} GB</p>
  <p><b>Massa (Em Uso):</b> ${gb(used)} GB</p>
</div>

<!-- Bloco: Memória Node -->
<div class="card">
  <h2>📦 Tanques de Suporte (Node)</h2>
  <p><b>Espaço Reservado (RSS):</b> ${mb(process.memoryUsage().rss)} MB</p>
  <p><b>Matéria Consumida (Heap):</b> ${mb(process.memoryUsage().heapUsed)} MB</p>
  <p><b>Limite de Pressão:</b> ${mb(process.memoryUsage().heapTotal)} MB</p>
</div>

<!-- Bloco: Tempo Servidor -->
<div class="card">
  <h2>⏱️ Lançamento da Estação</h2>
  <p><b>Em órbita há:</b></p>
  <p>${formatUptime(uptime)}</p>
</div>

<!-- Bloco: Tempo App -->
<div class="card">
  <h2>⏱️ Ignição dos Motores</h2>
  <p><b>Módulo ativo há:</b></p>
  <p>${formatUptime(process.uptime())}</p>
</div>

<!-- Bloco: Conectividade -->
<div class="card">
  <h2>📡 Comunicações de Rede</h2>
  <p><b>Frequência IP:</b> ${mainIP}</p>
  <p><b>Canais Abertos:</b> ${ips.length}</p>
</div>

<!-- Bloco: Node & Dir -->
<div class="card">
  <h2>🟩 Ambiente Espacial (Node)</h2>
  <p><b>Versão do Sistema:</b> ${process.version}</p>
  <p><b>Coordenadas:</b> <span class="code-inline">${__dirname}</span></p>
  <p><b>Atmosfera (ENV):</b> <span class="code-inline">${process.env.NODE_ENV || 'Padrão'}</span></p>
</div>

<!-- Bloco: Disco -->
<div class="card">
  <h2>💽 Baia de Carga (Disco)</h2>
  <p><b>Volume Total:</b> ${disk.size}</p>
  <p><b>Carga Ocupada:</b> ${disk.used} (${disk.percent})</p>
  <p><b>Espaço Livre:</b> ${disk.avail}</p>
</div>

<!-- Bloco: Git -->
<div class="card">
  <h2>🐙 Registo de Saltos (Git)</h2>
  <p><b>Rota (Branch):</b> ${git.branch}</p>
  <p><b>Salto (Commit):</b> <span class="code-inline">${git.hash}</span></p>
  <p><b>Transmissão:</b> <span style="color:#94a3b8;">"${git.msg}"</span></p>
</div>

<!-- Bloco: Arquivos Locais -->
<div class="card" style="grid-column: 1 / -1;">
  <h2>📂 Registos de Bordo (Raiz Top 10)</h2>
  <table>
    <tr><th>Nome do Ficheiro</th><th>Classificação</th><th>Tamanho</th></tr>
    ${files.map(f => `<tr><td>${f.name}</td><td>${f.type}</td><td>${f.size}</td></tr>`).join("")}
  </table>
</div>

<!-- Gráfico -->
<div class="card" style="grid-column: 1 / -1;">
  <h2>📊 Espectrógrafo de Matéria (RAM nos últimos 2.5 min)</h2>
  <div style="height: 200px; width: 100%;"><canvas id="ramChart"></canvas></div>
</div>

<!-- Terminal -->
<div class="card" style="grid-column: 1 / -1;">
  <h2>>_ Consola de Navegação (Logs)</h2>
  <div class="terminal">${logsArray.length > 0 ? logsArray.join("<br>") : "A aguardar transmissões intergalácticas..."}</div>
</div>

</div>

<div class="subtitle" style="margin-top: 40px; color: #475569;">Centro de Comando Orbital • Sincronização a cada 10s ☄️</div>

<script>
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Space Mono', monospace";
  
  const ctx = document.getElementById('ramChart').getContext('2d');
  const historico = ${JSON.stringify(ramHistory)};
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: historico.map(h => h.time),
      datasets: [{
        label: '% de Matéria em Uso',
        data: historico.map(h => h.value),
        borderColor: '#38bdf8', 
        backgroundColor: 'rgba(56, 189, 248, 0.15)', 
        borderWidth: 2, 
        pointRadius: 3, 
        pointBackgroundColor: '#818cf8',
        fill: true, 
        tension: 0.2
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
        legend: { labels: { color: '#e2e8f0' } }
      }
    }
  });
</script>

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log("Motores ligados na porta " + PORT);
  console.log("🚀 Prontos para a descolagem...");
});
