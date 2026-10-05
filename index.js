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
let totalRequests = 0; // Contador de tráfego
const logsArray = [];  // Histórico do Mini-Terminal
const ramHistory = []; // Histórico para o Gráfico

// Intercepta os console.logs para enviar para a nossa tela
const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-BR');
  const msg = `[${time}] ${args.join(" ")}`;
  logsArray.unshift(msg); // Adiciona no início
  if (logsArray.length > 20) logsArray.pop(); // Mantém apenas os últimos 20
  originalLog.apply(console, args);
};

// Middleware para contar todo o tráfego que chega na aplicação
app.use((req, res, next) => {
  totalRequests++;
  next();
});

// Atualiza o histórico de RAM a cada 10 segundos, mesmo sem ninguém ver a página
setInterval(() => {
  const total = os.totalmem();
  const free = os.freemem();
  const percent = (((total - free) / total) * 100).toFixed(0);
  const time = new Date().toLocaleTimeString('pt-BR');
  
  ramHistory.push({ time, value: percent });
  if (ramHistory.length > 15) ramHistory.shift(); // Mantém os últimos 15 pontos no gráfico
}, 10000);

/* =========================
   Funções auxiliares
========================= */
function gb(v) { return (v / 1024 / 1024 / 1024).toFixed(2); }
function mb(v) { return (v / 1024 / 1024).toFixed(2); }
function percent(part, total) { return total ? ((part / total) * 100).toFixed(0) : "0"; }

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function getDiskSpace() {
  try {
    // Comando Linux para ver o disco raiz '/' (funciona no Render)
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
    return { hash: 'N/A', branch: 'N/A', msg: 'Repositório não encontrado localmente' };
  }
}

function cpuStats() {
  return os.cpus().map((cpu, index) => {
    const t = cpu.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    const used = total - t.idle;
    return { core: index, usage: percent(used, total) };
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

  const disk = getDiskSpace();
  const git = getGitInfo();
  const health = healthStatus(ramPercent, os.loadavg()[0], cpuCount);

  // Inicializa o primeiro ponto do gráfico caso esteja vazio
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
<title>Dashboard Pro</title>

<!-- Importação do Chart.js para o Gráfico -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;600;700&display=swap');

body { font-family: 'Nunito', sans-serif; background: #faf5ff; margin: 0; padding: 20px; color: #3b2163; }
h1 { text-align: center; margin-bottom: 5px; color: #5b21b6; }
h2 { color: #5b21b6; border-bottom: 2px solid #f3e8ff; padding-bottom: 8px; margin-top: 0; font-size: 1.2em; font-family: 'Nunito', sans-serif; }
.subtitle { text-align: center; color: #7c3aed; margin-bottom: 25px; font-weight: bold; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
.top-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }

.card { background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #e9d5ff; box-shadow: 0 4px 6px rgba(109, 40, 217, 0.05); font-family: 'Kalam', cursive; font-size: 1.1em; transition: transform 0.2s; }
.card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(109, 40, 217, 0.15); }

/* Bloco Terminal */
.terminal { background: #1e1e1e; color: #4ade80; font-family: monospace; font-size: 14px; padding: 15px; border-radius: 8px; height: 180px; overflow-y: auto; border: 1px solid #333; line-height: 1.5; }

.kpi { text-align: center; font-family: 'Nunito', sans-serif; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; border: none; }
.kpi h3 { color: #ddd6fe; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
.kpi .value { font-size: 26px; font-weight: bold; margin-top: 8px; color: white; }
.badge { display: inline-block; padding: 6px 12px; border-radius: 999px; color: #fff; font-weight: bold; font-size: 14px; font-family: 'Nunito', sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.small { color: #8b5cf6; font-size: 14px; margin-top: 10px; display: block; font-family: 'Nunito', sans-serif; }
.footer { text-align: center; color: #8b5cf6; margin-top: 30px; font-size: 14px; font-family: 'Nunito', sans-serif; font-weight: bold; }
p { margin: 6px 0; }
</style>
</head>

<body>

<h1>🖥️ Dashboard do Servidor</h1>
<div class="subtitle">Atualizado em: ${new Date().toLocaleTimeString('pt-BR')}</div>

<div class="top-grid">
  <div class="card kpi">
    <h3>Uso de RAM</h3>
    <div class="value">${ramPercent}%</div>
  </div>
  <div class="card kpi">
    <h3>Uptime</h3>
    <div class="value" style="font-size: 20px;">${formatUptime(os.uptime())}</div>
  </div>
  <div class="card kpi">
    <h3>Tráfego Web</h3>
    <div class="value">${totalRequests} reqs</div>
  </div>
  <div class="card kpi" style="background: #fff; border: 2px solid ${health.color};">
    <h3 style="color: #666;">Status Geral</h3>
    <div class="value"><span class="badge" style="background:${health.color}">${health.label}</span></div>
  </div>
</div>

<div class="grid">

<!-- Novo: Gráfico Chart.js -->
<div class="card" style="grid-column: 1 / -1; font-family: 'Nunito', sans-serif;">
  <h2>📊 Consumo de RAM (Tempo Real)</h2>
  <div style="height: 250px; width: 100%;">
    <canvas id="ramChart"></canvas>
  </div>
</div>

<!-- Novo: Mini-Terminal de Logs -->
<div class="card" style="grid-column: 1 / -1; font-family: 'Nunito', sans-serif;">
  <h2>>_ Terminal (console.log)</h2>
  <div class="terminal">
    ${logsArray.length > 0 ? logsArray.join("<br>") : "Nenhum log registrado ainda..."}
  </div>
</div>

<!-- Novo: Git -->
<div class="card">
  <h2>🐙 Controle de Versão (Git)</h2>
  <p><b>Branch:</b> ${git.branch}</p>
  <p><b>Commit:</b> ${git.hash}</p>
  <p><b>Última msg:</b> <br><span style="font-size:0.9em; color:#6b7280;">"${git.msg}"</span></p>
</div>

<!-- Novo: Disco (Storage) -->
<div class="card">
  <h2>💽 Armazenamento (Disco /)</h2>
  <p><b>Total:</b> ${disk.size}</p>
  <p><b>Usado:</b> ${disk.used} (${disk.percent})</p>
  <p><b>Livre:</b> ${disk.avail}</p>
</div>

<!-- Sistema e Node -->
<div class="card">
  <h2>📌 Máquina & Node</h2>
  <p><b>SO:</b> ${os.platform()} ${os.arch()}</p>
  <p><b>Processos (PID):</b> ${process.pid}</p>
  <p><b>Tráfego Total:</b> ${totalRequests} requisições processadas</p>
  <p><b>Memória Interna (V8):</b> ${mb(process.memoryUsage().rss)} MB</p>
</div>

</div>

<div class="footer">Dashboard Pro • Atualizando a cada 10s</div>

<script>
  // Script para renderizar o Gráfico de Linha do Chart.js
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
        borderWidth: 3,
        pointRadius: 4,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Desativado para não piscar a cada F5 do HTML
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
</script>

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log("Servidor iniciado e monitorando métricas!");
});
