const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Plugin Anti-Hibernação 
========================= */
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com"; 
const INTERVALO_PING = 600000; 

setInterval(async () => {
  try {
    const response = await fetch(URL_DO_SEU_SITE);
    if (response.ok) console.log(`[SYS] Ping de manutenção enviado. Conexão mantida.`);
  } catch (error) {
    console.log(`[ERR] Falha no ping de manutenção: ${error.message}`);
  }
}, INTERVALO_PING);

/* =========================
   Memória do Servidor
========================= */
let totalRequests = 0; 
const logsArray = [];  
const ramHistory = []; 

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString('pt-BR');
  const msg = `[${time}] ${args.join(" ")}`;
  logsArray.unshift(msg); 
  if (logsArray.length > 25) logsArray.pop(); 
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
  if (ramHistory.length > 20) ramHistory.shift(); 
}, 10000);

/* =========================
   Funções Auxiliares
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
  return ip ? ip.address : "Offline";
}

function getFilesDetailed() {
  try {
    return fs.readdirSync(".").slice(0, 8).map(file => {
      const stat = fs.statSync(path.join(".", file));
      return {
        name: file,
        type: stat.isDirectory() ? "DIR" : "FILE",
        size: stat.isDirectory() ? "-" : `${(stat.size / 1024).toFixed(1)}K`
      };
    });
  } catch { return []; }
}

function getDiskSpace() {
  try {
    const df = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    return { size: df[1], used: df[2], avail: df[3], percent: df[4] };
  } catch (e) { return { size: 'N/A', used: 'N/A', avail: 'N/A', percent: '0%' }; }
}

function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD").toString().trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const msg = execSync("git log -1 --pretty=%B").toString().trim();
    return { hash, branch, msg };
  } catch (e) { return { hash: 'N/A', branch: 'N/A', msg: 'N/A' }; }
}

function cpuStats() {
  return os.cpus().map((cpu, index) => {
    const t = cpu.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    const used = total - t.idle;
    return { core: index, usage: percent(used, total), model: cpu.model };
  });
}

/* =========================
   Rota Principal
========================= */
app.get("/", (req, res) => {
