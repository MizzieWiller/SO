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
  logsArray.unshift(`[${time}]${args.join(" ")}`); 
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
  return `${d}d${h}h ${m}m${s}s`;
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
  .kpi-box strong { font-size: 1.6em; color: #f1f5
