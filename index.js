const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Memória do Servidor (Variáveis Globais)
========================= */
let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-BR');
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
  const time = new Date().toLocaleTimeString('pt-BR');
  
  ramHistory.push({ time, value: percent });
  if (ramHistory.length > 15) ramHistory.shift(); 
}, 10000);

/* =========================
   Funções auxiliares
========================= */
function gb(v) { return (v / 1024 / 1024 / 1024).toFixed(2); }
function mb(v) { return (v / 1024 / 1024).toFixed(2); }
function percent(part, total) { return total ? ((part / total) * 100).toFixed(0) : "0"; }

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
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
        type: stat.isDirectory() ? "Dir" : "Arquivo",
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
  if (ramUsage > 85 || loadAvg > cores) return { label: "CRÍTICO", color: "#ef4444" };
  if (ramUsage > 65 || loadAvg > cores * 0.7) return { label: "ATENÇÃO", color: "#f59e0b" };
  return { label: "SAUDÁVEL", color: "#10b981" };
}

/* =========================
   Rota principal
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
    ramHistory.push({ time: new Date().toLocaleTimeString('pt-BR'), value: ramPercent });
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard Completo</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;600;700&display=swap');

body { font-family: 'Nunito', sans-serif; background: #faf5ff; margin: 0; padding: 20px; color: #3b2163; }
h1 { text-align: center; margin-bottom: 5px; color: #5b21b6; }
h2 { color: #5b21b6; border-bottom: 2px solid #f3e8ff; padding-bottom: 8px; margin-top: 0; font-size: 1.2em; font-family: 'Nunito', sans-serif; }
.subtitle { text-align: center; color: #7c3aed; margin-bottom: 25px; font-weight: bold; }

.top-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin-bottom: 25px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }

.card { background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #e9d5ff; box-shadow: 0 4px 6px rgba(109, 40, 217, 0.05); font-family: 'Kalam', cursive; font-size: 1.1em; transition: transform 0.2s; }
.card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(109, 40, 217, 0.15); }

.terminal { background: #1e1e1e; color: #4ade80; font-family: monospace; font-size: 14px; padding: 15px; border-radius: 8px; height: 180px; overflow-y: auto; border: 1px solid #333; line-height: 1.5; }

.kpi { text-align: center; font-family: 'Nunito', sans-serif; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; border: none; }
.kpi h3 { color: #ddd6fe; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
.kpi .value { font-size: 24px; font-weight: bold; margin-top: 8px; color: white; }

.bar { background: #f3e8ff; height: 16px; border-radius: 8px; overflow: hidden; margin-top: 5px; }
.fill { background: linear-gradient(90deg, #8b5cf6, #6d28d9); height: 100%; color: #fff; text-align: center; line-height: 16px; font-size: 10px; font-family: 'Nunito', sans-serif; font-weight: bold; }

table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; font-family: 'Nunito', sans-serif;}
th, td { padding: 6px; border-bottom: 1px dashed #d8b4fe; text-align: left; }
th { color: #5b21b6; }

.badge { display: inline-block; padding: 6px 12px; border-radius: 999px; color: #fff; font-weight: bold; font-size: 14px; font-family: 'Nunito', sans-serif; }
.code-inline { background: #f3e8ff; padding: 2px 6px; border-radius: 4px; font-family: 'Nunito', monospace; font-size: 0.85em; color: #6d28d9; }
p { margin: 6px 0; }
</style>
</head>

<body>

<h1>🖥️ Dashboard Completo</h1>
<div class="subtitle">Atualizado em: ${new Date().toLocaleTimeString('pt-BR')}</div>

<!-- KPIs -->
<div class="top-grid">
  <div class="card kpi"><h3>Uso de RAM</h3><div class="value">${ramPercent}%</div></div>
  <div class="card kpi"><h3>CPU Média</h3><div class="value">${avgCpu}%</div></div>
  <div class="card kpi"><h3>Tráfego</h3><div class="value">${totalRequests} reqs</div></div>
  <div class="card kpi"><h3>Uptime</h3><div class="value" style="font-size: 18px;">${formatUptime(uptime)}</div></div>
  <div class="card kpi" style="background: #fff; border: 2px solid ${health.color};"><h3 style="color: #666;">Status Geral</h3><div class="value"><span class="badge" style="background:${health.color}">${health.label}</span></div></div>
</div>

<div class="grid">

<!-- Bloco Cheio: Gráfico -->
<div class="card" style="grid-column: 1 / -1; font-family: 'Nunito', sans-serif;">
  <h2>📊 Consumo de RAM (Últimos 2.5 min)</h2>
  <div style="height: 200px; width: 100%;"><canvas id="ramChart"></canvas></div>
</div>

<!-- Bloco Cheio: Terminal -->
<div class="card" style="grid-column: 1 / -1; font-family: 'Nunito', sans-serif;">
  <h2>>_ Monitor de Logs (console.log)</h2>
  <div class="terminal">${logsArray.length > 0 ? logsArray.join("<br>") : "Nenhum log registrado ainda..."}</div>
</div>

<!-- Bloco: Sistema -->
<div class="card">
  <h2>📌 Sistema Operacional</h2>
  <p><b>Tipo:</b> ${os.type()}</p>
  <p><b>Plataforma:</b> ${os.platform()}</p>
  <p><b>Kernel:</b> ${os.release()}</p>
</div>

<!-- Bloco: Identificação -->
<div class="card">
  <h2>👤 Identificação</h2>
  <p><b>Hostname:</b> ${os.hostname()}</p>
  <p><b>Usuário Logado:</b> ${user.username}</p>
  <p><b>Diretório Home:</b> ${os.homedir()}</p>
</div>

<!-- Bloco: CPU -->
<div class="card">
  <h2>⚙️ Processador (CPU)</h2>
  <p><b>Arquitetura:</b> <span class="code-inline">${os.arch()}</span></p>
  <p><b>Núcleos:</b> ${cpuCount}</p>
  <p><b>Modelo:</b> ${cpus[0].model}</p>
</div>

<!-- Bloco: Carga -->
<div class="card">
  <h2>📈 Carga do Sistema</h2>
  <p><b>Último 1 min:</b> ${load[0].toFixed(2)}</p>
  <p><b>Últimos 5 min:</b> ${load[1].toFixed(2)}</p>
  <p><b>Últimos 15 min:</b> ${load[2].toFixed(2)}</p>
</div>

<!-- Bloco: Memória Servidor -->
<div class="card">
  <h2>🧠 Memória do Servidor</h2>
  <p><b>Total:</b> ${gb(total)} GB</p>
  <p><b>Livre:</b> ${gb(free)} GB</p>
  <p><b>Em Uso:</b> ${gb(used)} GB</p>
</div>

<!-- Bloco: Memória Node -->
<div class="card">
  <h2>📦 Memória do Node.js</h2>
  <p><b>Espaço Total (RSS):</b> ${mb(process.memoryUsage().rss)} MB</p>
  <p><b>Processos (Heap):</b> ${mb(process.memoryUsage().heapUsed)} MB</p>
  <p><b>Limite Heap:</b> ${mb(process.memoryUsage().heapTotal)} MB</p>
</div>

<!-- Bloco: Tempo Servidor -->
<div class="card">
  <h2>⏱️ Tempo do Servidor</h2>
  <p><b>Ligado há:</b></p>
  <p>${formatUptime(uptime)}</p>
</div>

<!-- Bloco: Tempo App -->
<div class="card">
  <h2>⏱️ Tempo da Aplicação</h2>
  <p><b>Rodando há:</b></p>
  <p>${formatUptime(process.uptime())}</p>
</div>

<!-- Bloco: Conectividade -->
<div class="card">
  <h2>🌍 Conectividade</h2>
  <p><b>IP Ativo:</b> ${mainIP}</p>
  <p><b>Total Interfaces:</b> ${ips.length}</p>
</div>

<!-- Bloco: Node & Dir -->
<div class="card">
  <h2>🟩 Ambiente Node</h2>
  <p><b>Versão:</b> ${process.version}</p>
  <p><b>Caminho:</b> <span class="code-inline">${__dirname}</span></p>
  <p><b>Variável ENV:</b> <span class="code-inline">${process.env.NODE_ENV || 'Padrão'}</span></p>
</div>

<!-- Bloco: Disco -->
<div class="card">
  <h2>💽 Armazenamento (Disco)</h2>
  <p><b>Total:</b> ${disk.size}</p>
  <p><b>Usado:</b> ${disk.used} (${disk.percent})</p>
  <p><b>Livre:</b> ${disk.avail}</p>
</div>

<!-- Bloco: Git -->
<div class="card">
  <h2>🐙 Versionamento (Git)</h2>
  <p><b>Branch:</b> ${git.branch}</p>
  <p><b>Commit:</b> <span class="code-inline">${git.hash}</span></p>
  <p><b>Última msg:</b> <span style="color:#6b7280;">"${git.msg}"</span></p>
</div>

<!-- Bloco: Arquivos Locais -->
<div class="card" style="grid-column: 1 / -1;">
  <h2>📂 Arquivos na Raiz (Top 10)</h2>
  <table>
    <tr><th>Nome</th><th>Tipo</th><th>Tamanho</th></tr>
    ${files.map(f => `<tr><td>${f.name}</td><td>${f.type}</td><td>${f.size}</td></tr>`).join("")}
  </table>
</div>

</div>

<div class="footer">Dashboard Completo • Atualizando a cada 10s</div>

<script>
  const ctx = document.getElementById('ramChart').getContext('2d');
  const historico = ${JSON.stringify(ramHistory)};
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: historico.map(h => h.time),
      datasets: [{
        label: '% de RAM em Uso',
        data: historico.map(h => h.value),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 3, pointRadius: 4, fill: true, tension: 0.3
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, max: 100 } } }
  });
</script>

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log("Servidor iniciado na porta " + PORT);
  console.log("Aguardando conexões...");
});
