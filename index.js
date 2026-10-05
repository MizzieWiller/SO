const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Funções auxiliares
========================= */
function gb(v) {
  return (v / 1024 / 1024 / 1024).toFixed(2);
}

function mb(v) {
  return (v / 1024 / 1024).toFixed(2);
}

function percent(part, total) {
  if (!total) return "0";
  return ((part / total) * 100).toFixed(0);
}

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
      list.push({
        interface: name,
        address: net.address,
        family: net.family,
        mac: net.mac,
        internal: net.internal
      });
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
    return fs.readdirSync(".").slice(0, 20).map(file => {
      const stat = fs.statSync(path.join(".", file));
      return {
        name: file,
        type: stat.isDirectory() ? "Dir" : "Arquivo",
        size: stat.isDirectory() ? "-" : `${(stat.size / 1024).toFixed(2)} KB`,
        modified: stat.mtime.toLocaleString()
      };
    });
  } catch {
    return [];
  }
}

function cpuStats() {
  return os.cpus().map((cpu, index) => {
    const t = cpu.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    const used = total - t.idle;
    return {
      core: index,
      model: cpu.model,
      speed: cpu.speed,
      usage: percent(used, total),
      idle: t.idle
    };
  });
}

function healthStatus(ramUsage, loadAvg, cores) {
  if (ramUsage > 85 || loadAvg > cores) {
    return { label: "CRÍTICO", color: "#ef4444" };
  }
  if (ramUsage > 65 || loadAvg > cores * 0.7) {
    return { label: "ATENÇÃO", color: "#f59e0b" };
  }
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
  const avgCpu = (
    cpus.reduce((sum, c) => sum + Number(c.usage), 0) / cpuCount
  ).toFixed(0);

  const load = os.loadavg();
  const ips = getIPs();
  const mainIP = getMainIP(ips);
  const files = getFilesDetailed();

  const user = os.userInfo();
  const uptime = os.uptime();
  const health = healthStatus(ramPercent, load[0], cpuCount);

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard Mesclado</title>

<style>
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;600;700&display=swap');

body {
  font-family: 'Nunito', sans-serif;
  background: #faf5ff;
  margin: 0;
  padding: 20px;
  color: #3b2163;
}

h1 { text-align: center; margin-bottom: 5px; color: #5b21b6; }
h2 { color: #5b21b6; border-bottom: 2px solid #f3e8ff; padding-bottom: 8px; margin-top: 0; font-size: 1.2em; font-family: 'Nunito', sans-serif; }

.subtitle { text-align: center; color: #7c3aed; margin-bottom: 25px; font-weight: bold; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
.top-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e9d5ff;
  box-shadow: 0 4px 6px rgba(109, 40, 217, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  font-family: 'Kalam', cursive;
  font-size: 1.1em;
}

.card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(109, 40, 217, 0.15); }

.kpi {
  text-align: center;
  font-family: 'Nunito', sans-serif;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  border: none;
}

.kpi h3 { color: #ddd6fe; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; border: none; }
.kpi .value { font-size: 26px; font-weight: bold; margin-top: 8px; color: white; }

.bar { background: #f3e8ff; height: 22px; border-radius: 10px; overflow: hidden; margin-top: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); }
.fill { background: linear-gradient(90deg, #8b5cf6, #6d28d9); height: 100%; color: #fff; text-align: center; line-height: 22px; font-size: 12px; font-family: 'Nunito', sans-serif; font-weight: bold; }

.small { color: #8b5cf6; font-size: 14px; margin-top: 10px; display: block; font-family: 'Nunito', sans-serif; }

table { width: 100%; border-collapse: collapse; font-size: 15px; margin-top: 10px; }
th, td { padding: 8px; border-bottom: 1px dashed #d8b4fe; text-align: left; }
th { font-family: 'Nunito', sans-serif; color: #5b21b6; }

.badge { display: inline-block; padding: 6px 12px; border-radius: 999px; color: #fff; font-weight: bold; font-size: 14px; font-family: 'Nunito', sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.core { margin-bottom: 12px; }
.footer { text-align: center; color: #8b5cf6; margin-top: 30px; font-size: 14px; font-family: 'Nunito', sans-serif; font-weight: bold; }
p { margin: 6px 0; }
</style>
</head>

<body>

<h1>🖥️ Dashboard do Servidor</h1>
<div class="subtitle">
Atualizado automaticamente em: ${new Date().toLocaleTimeString('pt-BR')}
</div>

<!-- KPIs (Agora com estilo da barra roxa) -->
<div class="top-grid">
  <div class="card kpi">
    <h3>Uso de RAM</h3>
    <div class="value">${ramPercent}%</div>
  </div>
  <div class="card kpi">
    <h3>CPU Média</h3>
    <div class="value">${avgCpu}%</div>
  </div>
  <div class="card kpi">
    <h3>Uptime</h3>
    <div class="value" style="font-size: 20px;">${formatUptime(uptime)}</div>
  </div>
  <div class="card kpi">
    <h3>IP Principal</h3>
    <div class="value" style="font-size: 20px;">${mainIP}</div>
  </div>
  <div class="card kpi" style="background: #fff; border: 2px solid ${health.color};">
    <h3 style="color: #666;">Status Geral</h3>
    <div class="value">
      <span class="badge" style="background:${health.color}">
        ${health.label}
      </span>
    </div>
  </div>
</div>

<div class="grid">

<!-- Sistema -->
<div class="card">
  <h2>📌 Sistema</h2>
  <p><b>Host:</b> ${os.hostname()}</p>
  <p><b>SO:</b> ${os.type()}</p>
  <p><b>Release:</b> ${os.release()}</p>
  <p><b>Plataforma:</b> ${os.platform()}</p>
  <p><b>Arquitetura:</b> ${os.arch()}</p>
  <span class="small">Hostname = Nome interno da máquina</span>
</div>

<!-- Usuário -->
<div class="card">
  <h2>👤 Identificação</h2>
  <p><b>Usuário:</b> ${user.username}</p>
  <p><b>Diretório Home:</b> ${os.homedir()}</p>
  <p><b>Node Version:</b> ${process.version}</p>
</div>

<!-- Memória -->
<div class="card">
  <h2>🧠 Memória RAM</h2>
  <p><b>Total:</b> ${gb(total)} GB</p>
  <p><b>Usada:</b> ${gb(used)} GB</p>
  <p><b>Livre:</b> ${gb(free)} GB</p>

  <div class="bar">
    <div class="fill" style="width:${ramPercent}%">
      ${ramPercent}% Em Uso
    </div>
  </div>
  <span class="small">Total de RAM da máquina virtual</span>
</div>

<!-- CPU -->
<div class="card">
  <h2>⚙️ Desempenho (CPU)</h2>
  <p><b>Modelo:</b> ${cpus[0].model}</p>
  <p><b>Load Avg:</b> ${load.map(v => v.toFixed(2)).join(" | ")}</p>
  <br>
  ${cpus.map(c => `
  <div class="core">
    <div style="font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: bold; color: #5b21b6;">Núcleo ${c.core + 1} -${c.usage}%</div>
    <div class="bar" style="height: 14px;">
      <div class="fill" style="width:${c.usage}%; line-height: 14px; font-size: 10px;"></div>
    </div>
  </div>
  `).join("")}
</div>

<!-- Rede -->
<div class="card">
  <h2>🌐 Conectividade</h2>
  <table>
    <tr>
      <th>Interface</th>
      <th>IP</th>
      <th>Família</th>
    </tr>
    ${ips.map(ip => `
    <tr>
      <td>${ip.interface}</td>
      <td>${ip.address}</td>
      <td>${ip.family}</td>
    </tr>
    `).join("")}
  </table>
</div>

<!-- Arquivos -->
<div class="card">
  <h2>📂 Arquivos da Raiz</h2>
  <table>
    <tr>
      <th>Nome</th>
      <th>Tipo</th>
      <th>Tamanho</th>
    </tr>
    ${files.map(f => `
    <tr>
      <td>${f.name}</td>
      <td>${f.type}</td>
      <td>${f.size}</td>
    </tr>
    `).join("")}
  </table>
</div>

<!-- Aplicação e Ambiente -->
<div class="card">
  <h2>☁️ Ambiente e Processo</h2>
  <p><b>Status:</b> ${process.env.RENDER || process.env.RENDER_SERVICE_ID ? "Nuvem (Render)" : "Local"}</p>
  <p><b>Porta:</b> ${PORT}</p>
  <p><b>PID Processo:</b> ${process.pid}</p>
  <p><b>Caminho:</b> ${process.cwd()}</p>
  <p><b>Memória do Node:</b> ${mb(process.memoryUsage().rss)} MB</p>
</div>

</div>

<div class="footer">
  Dashboard Mesclado • Atualizando a cada 10s
</div>

</body>
</html>
  `);
});

/* =========================
   Inicialização
========================= */
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
