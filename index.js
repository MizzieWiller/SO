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
    if (res.ok) console.log("ping enviado, servidor acordado");
  } catch (err) {
    console.log("falha no ping: " + err.message);
  }
}, 600000);

let totalRequests = 0;
const logsArray = [];
const ramHistory = [];

const originalLog = console.log;
console.log = function (...args) {
  const time = new Date().toLocaleTimeString("pt-PT");
  logsArray.unshift(`[${time}] ${args.join(" ")}`);
  if (logsArray.length > 15) logsArray.pop();
  originalLog.apply(console, args);
};

app.use((req, res, next) => { totalRequests++; next(); });

/* =========================
   Músicas (coloca ficheiros mp3/ogg/wav/m4a na pasta "musicas")
========================= */
const MUSIC_DIR = path.join(__dirname, "musicas");
try { fs.mkdirSync(MUSIC_DIR, { recursive: true }); } catch (e) {}
app.use("/musicas", express.static(MUSIC_DIR));

function listTracks() {
  try {
    return fs.readdirSync(MUSIC_DIR)
      .filter((f) => /\.(mp3|ogg|wav|m4a|webm)$/i.test(f))
      .sort()
      .map((f) => ({ name: f.replace(/\.[^.]+$/, ""), url: "/musicas/" + encodeURIComponent(f) }));
  } catch (e) { return []; }
}

setInterval(() => {
  const percent = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
  ramHistory.push({ time: new Date().toLocaleTimeString("pt-PT"), value: percent });
  if (ramHistory.length > 25) ramHistory.shift();
}, 10000);

/* =========================
   Extração de Dados
========================= */
const toGB = (v) => (v / 1024 / 1024 / 1024).toFixed(2);
const toMB = (v) => (v / 1024 / 1024).toFixed(0);
const calcPercent = (p, t) => (t ? ((p / t) * 100).toFixed(0) : "0");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const kv = (rows) =>
  '<ul class="kv">' + rows.map(([k, v]) => '<li><span>' + esc(k) + '</span><b>' + esc(v) + '</b></li>').join("") + "</ul>";

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function getSystemData() {
  const cpus = os.cpus();
  const avgCpu = (
    cpus.reduce((s, c) => {
      const busy = c.times.user + c.times.nice + c.times.sys + c.times.irq;
      return s + Number(calcPercent(busy, busy + c.times.idle));
    }, 0) / cpus.length
  ).toFixed(0);

  let disk = { size: "N/A", used: "N/A", avail: "N/A", percent: "0%" };
  try {
    const df = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    disk = { size: df[1], used: df[2], avail: df[3], percent: df[4] };
  } catch (e) {}

  let git = { hash: "N/A", branch: "N/A", msg: "sem dados" };
  try {
    git.hash = execSync("git rev-parse --short HEAD").toString().trim();
    git.branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    git.msg = execSync("git log -1 --pretty=%B").toString().trim();
  } catch (e) {}

  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => !i.internal && i.family === "IPv4");
  const mainIP = ips.length ? ips[0].address : "N/A";

  let files = [];
  try { files = fs.readdirSync(".").slice(0, 7); } catch (e) {}

  const ramUsage = Number(calcPercent(os.totalmem() - os.freemem(), os.totalmem()));
  const status =
    ramUsage > 85 ? { text: "crítico", msg: "a memória está quase cheia. reinicia ou liberta recursos." }
    : ramUsage > 65 ? { text: "sobrecarga", msg: "a memória está a subir. vale a pena vigiar." }
    : { text: "estável", msg: "tudo a funcionar sem problemas." };

  return { cpus, avgCpu, disk, git, mainIP, files, ramUsage, status };
}

/* =========================
   Interface
========================= */
app.get("/", (req, res) => {
  const data = getSystemData();
  const tracks = listTracks();
  if (ramHistory.length === 0) ramHistory.push({ time: new Date().toLocaleTimeString("pt-PT"), value: data.ramUsage });

  // arco de progresso à volta do vinil
  const R = 330;
  const C = 2 * Math.PI * R;
  const arcLen = C * 0.62; // o arco ocupa 62% da circunferência quando RAM = 100%
  const arcFill = (arcLen * data.ramUsage) / 100;

  const cards = [
    { k: data.avgCpu + "%", t: "processador", s: `${data.cpus.length} vcpus · ${os.arch()}` },
    { k: data.disk.percent, t: "disco", s: `${data.disk.used} de ${data.disk.size} · livre ${data.disk.avail}` },
    { k: "▶", t: "estado: " + data.status.text, s: `online há ${formatUptime(process.uptime())}`, active: true },
    { k: String(totalRequests), t: "visitas ao site", s: `${toMB(process.memoryUsage().rss)} MB usados pelo node` },
    { k: "git", t: data.git.branch, s: `commit ${data.git.hash}` },
  ];

  res.send(`<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(os.hostname())} · painel</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;800&family=Quicksand:wght@500;600;700&display=swap');

  :root {
    --page: #e9ebee;
    --card: #ffffff;
    --blue: #8fb0c1;
    --blue-soft: #b4cde0;
    --blue-pale: #d6e4ee;
    --blue-ink: #6f95a9;
    --gray: #eeeeef;
    --gray-line: #dcdcde;
    --text: #8a8a8e;
    --text-strong: #5d6770;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    font-family: 'Quicksand', sans-serif;
    font-weight: 600;
    letter-spacing: .06em;
    color: var(--text);
    background-color: var(--page);
    background-image: radial-gradient(rgba(0,0,0,.07) 1.2px, transparent 1.3px);
    background-size: 22px 22px;
  }

  .tag { position: fixed; top: 14px; right: 24px; color: var(--blue-ink); font-weight: 700; font-size: 14px; }

  .player {
    position: relative;
    width: min(1180px, 100%);
    min-height: 860px;
    background: var(--card);
    border-radius: 56px;
    box-shadow: 0 12px 40px rgba(60, 80, 100, .18);
    overflow: hidden;
    display: grid;
    grid-template-columns: 420px 1fr 340px;
    grid-template-rows: 110px 1fr 170px;
    column-gap: 28px;
    padding: 0 48px 0 0;
  }

  /* navegação */
  nav { grid-column: 2 / 3; grid-row: 1; display: flex; gap: 22px; align-items: flex-start; padding-top: 42px; font-size: 15px; }
  nav a { color: inherit; text-decoration: none; position: relative; cursor: pointer; transition: color .15s; border-radius: 6px; }
  nav a:hover { color: var(--blue-ink); }
  nav a:focus-visible { outline: 2px solid var(--blue); outline-offset: 4px; }
  nav a.on { color: var(--text-strong); }
  nav a.on::after { content: ""; position: absolute; left: 50%; bottom: -14px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: var(--blue); }

  .user { grid-column: 3 / 4; grid-row: 1; display: flex; justify-content: flex-end; align-items: center; gap: 14px; padding-top: 28px; text-align: right; font-size: 13px; color: var(--blue); }
  .user b { display: block; color: var(--text); font-weight: 600; font-size: 14px; }
  .avatar {
    width: 74px; height: 74px; border-radius: 50%;
    border: 5px solid var(--blue); background: #1b1d21; color: #fff;
    display: grid; place-items: center; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 18px;
    letter-spacing: 0;
  }

  /* vinil */
  .stage { grid-column: 1 / 2; grid-row: 1 / 4; position: relative; }
  .arc { position: absolute; left: -260px; top: 81px; width: 700px; height: 700px; overflow: visible; }
  .arc circle { fill: none; stroke-linecap: round; transform-origin: 350px 350px; transform: rotate(-135deg); }
  .vinyl {
    position: absolute; left: -235px; top: 106px; width: 650px; height: 650px; border-radius: 50%;
    background:
      radial-gradient(circle, #fff 0 9%, #0b0c0e 9.2% 100%),
      repeating-radial-gradient(circle, #101114 0 2px, #1d1f23 3px 4px);
    background-blend-mode: normal;
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
    animation: spin 14s linear infinite;
    animation-play-state: paused; /* só gira enquanto a música toca */
  }
  .vinyl::before { /* brilho */
    content: ""; position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(from 20deg, transparent 0 10%, rgba(255,255,255,.28) 16%, transparent 24% 60%, rgba(255,255,255,.22) 68%, transparent 76%);
  }
  .vinyl::after { /* furo */
    content: ""; position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px; border-radius: 50%; background: #0b0c0e;
  }
  .vinyl-label {
    position: absolute; left: -235px; top: 106px; width: 650px; height: 650px; display: grid; place-items: center; pointer-events: none;
  }
  .vinyl-label span {
    position: relative; z-index: 2; width: 125px; height: 125px; border-radius: 50%; background: #fff;
    display: grid; place-items: center; font-family: 'Lexend', sans-serif; font-weight: 800; font-size: 30px; color: var(--blue-ink); letter-spacing: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .ctrl {
    border: 0; cursor: pointer; font-family: inherit; transition: transform .12s, background .15s;
    position: absolute; width: 56px; height: 56px; border-radius: 18px; background: var(--blue-soft);
    display: grid; place-items: center; color: #fff; font-size: 18px;
  }
  .vinyl.playing { animation-play-state: running; }
  .nowp { position: absolute; left: 92px; bottom: 305px; z-index: 3; max-width: 300px; color: #fff; font-size: 13px; font-style: italic; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
  .ctrl.next { left: 256px; bottom: 185px; }
  .ctrl:hover { background: var(--blue); }
  .ctrl:active { transform: scale(.92); }
  .ctrl.play { left: 170px; bottom: 215px; width: 72px; height: 72px; border-radius: 24px; }
  .ctrl.pause { left: 92px; bottom: 185px; }

  /* centro */
  .center { grid-column: 2 / 3; grid-row: 2; position: relative; padding: 36px 0 0; }
  .blob { position: absolute; border-radius: 50%; background: #f0f0f1; z-index: 0; }
  .blob.a { width: 56px; height: 56px; left: -40px; top: -4px; }
  .blob.b { width: 300px; height: 300px; left: -80px; top: 60px; }
  .blob.c { width: 70px; height: 70px; right: 10px; top: 20px; }
  .center > *:not(.blob) { position: relative; z-index: 1; }

  h1, h2 { font-family: 'Lexend', sans-serif; margin: 0; letter-spacing: 0; }
  .big { font-size: 52px; overflow-wrap: anywhere; font-weight: 800; line-height: 1; color: var(--blue-soft); margin-top: 40px; }
  .sub { font-style: italic; font-size: 17px; margin: 14px 0 28px; color: var(--text); }
  .desc { max-width: 330px; font-size: 16px; line-height: 1.25; margin: 0 0 18px; }
  .more { font-style: italic; color: var(--blue-soft); font-size: 16px; }

  .bubble {
    position: relative; margin-top: 34px; width: 250px; background: #fff; border-radius: 22px; padding: 18px 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,.14); margin-left: 4px; font-family: 'Lexend', sans-serif; font-size: 13px; line-height: 1.3; color: var(--blue); letter-spacing: 0;
  }
  .bubble::before { content: ""; position: absolute; left: 0; top: -10px; width: 22px; height: 22px; background: #fff; border-radius: 0 100% 0 100%; transform: rotate(-90deg); }

  .pane { display: none; }
  .pane.on { display: block; }
  .kv { list-style: none; margin: 0 0 18px; padding: 0; max-width: 330px; }
  .kv li { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; padding: 7px 0; border-bottom: 1px dashed var(--gray-line); }
  .kv li b { color: var(--text-strong); font-weight: 700; text-align: right; overflow-wrap: anywhere; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; max-width: 330px; margin-bottom: 18px; }
  .pills span { background: var(--gray); border-radius: 14px; padding: 8px 14px; font-size: 13px; color: var(--text-strong); }
  .chart-box { margin-top: 22px; height: 130px; max-width: 420px; }

  /* lista (direita) */
  .side { grid-column: 3 / 4; grid-row: 2; padding-top: 24px; }
  .side h2 { font-size: 40px; font-weight: 800; color: var(--blue-soft); margin-bottom: 26px; }
  .item {
    display: flex; align-items: center; gap: 16px; background: var(--gray); border-radius: 26px; padding: 14px 18px; margin-bottom: 14px;
    border: 4px solid transparent;
  }
  .item.active { border-color: var(--blue-soft); background: #fff; box-shadow: 0 0 0 3px var(--blue-pale) inset; padding: 14px 18px; }
  .thumb {
    flex: none; width: 62px; height: 62px; border-radius: 18px; background: linear-gradient(145deg, #2a2d33, #0f1013);
    color: #fff; display: grid; place-items: center; font-family: 'Lexend', sans-serif; font-weight: 600; font-size: 17px; letter-spacing: 0;
  }
  .item.active .thumb { background: var(--blue-soft); }
  .item .t { color: var(--text-strong); font-size: 15px; }
  .item .s { color: var(--blue); font-size: 12px; margin-top: 2px; }
  .foot { font-style: italic; font-size: 13px; line-height: 1.15; margin-top: 20px; }

  /* registos (barra azul tipo pesquisa) */
  .logs {
    grid-column: 1 / 3; grid-row: 3; align-self: center; justify-self: start;
    position: relative; margin-left: 130px; width: 580px; height: 130px; z-index: 5;
    background: var(--blue); border-radius: 36px; padding: 16px 24px 16px 84px; box-shadow: 0 6px 20px rgba(60,80,100,.25);
  }
  .logs .mag {
    position: absolute; left: 30px; top: 22px; width: 30px; height: 30px; border: 4px solid #fff; border-radius: 50%;
  }
  .logs .mag::after { content: ""; position: absolute; width: 4px; height: 14px; background: #fff; right: -7px; bottom: -11px; transform: rotate(-45deg); border-radius: 2px; }
  .logs .lines {
    height: 100%; overflow-y: auto; background: #fff; border-radius: 24px; padding: 10px 18px; font-size: 12px; font-style: italic; line-height: 1.5; color: var(--text);
  }
  .logs .lines div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .logs .close {
    position: absolute; right: -34px; top: -20px; width: 64px; height: 64px; border-radius: 50%; background: #f1f1f2; color: var(--text);
    display: grid; place-items: center; font-family: 'Lexend', sans-serif; font-weight: 800; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.12);
  }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: var(--blue-soft); border-radius: 4px; }

  /* ecrãs largos: tudo um pouco maior */
  @media (min-width: 1450px) { .player { zoom: 1.15; } }
  @media (min-width: 1800px) { .player { zoom: 1.3; } }

  /* botão de som */
  .snd {
    position: fixed; top: 14px; left: 24px; z-index: 20; border: 0; cursor: pointer; border-radius: 18px;
    padding: 9px 16px; background: var(--blue-soft); color: #fff; font: 700 13px 'Quicksand', sans-serif; letter-spacing: .06em;
  }
  .snd:hover { background: var(--blue); }
  .snd:focus-visible, .ctrl:focus-visible { outline: 3px solid var(--blue-ink); outline-offset: 3px; }
  .snd.off { background: var(--gray-line); color: var(--text); }

  /* mobile / ecrãs pequenos */
  @media (max-width: 1000px) {
    body { padding: 12px; place-items: start center; }
    .player { height: auto; grid-template-columns: 1fr; grid-template-rows: auto; padding: 0 22px 24px; border-radius: 36px; min-height: 0; }
    nav, .user, .stage, .center, .side { grid-column: 1; grid-row: auto; }
    .center { padding-bottom: 20px; }
    nav { flex-wrap: wrap; padding-top: 28px; }
    .user { justify-content: flex-start; padding-top: 18px; text-align: left; }
    .stage { height: 300px; margin: 10px -22px 0; overflow: hidden; }
    .vinyl, .vinyl-label { left: -265px; top: -60px; }
    .arc { left: -290px; top: -85px; }
    .ctrl.pause { left: 40px; bottom: 28px; }
    .ctrl.play { left: 120px; bottom: 22px; }
    .ctrl.next { left: 210px; bottom: 28px; }
    .nowp { left: 24px; bottom: 110px; }
    .big { margin-top: 20px; font-size: 44px; }
    .side { padding-top: 10px; }
    .item.active { margin: 14px 0; }
    .logs { grid-column: 1; grid-row: auto; margin: 24px 0 0; width: 100%; justify-self: stretch; }
    .logs .close { display: none; }
    .tag { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .vinyl { animation: none; } }
</style>
</head>
<body>
  <audio id="bgm" preload="none"></audio>
  <button class="snd" id="snd" type="button" aria-pressed="true">som: ligado</button>
  <div class="tag">@${esc(os.hostname())}</div>

  <main class="player">
    <nav>
      <a href="#home" data-tab="home">home</a><a href="#hardware" data-tab="hardware">hardware</a><a href="#rede" data-tab="rede">rede</a><a href="#ficheiros" data-tab="ficheiros">ficheiros</a><a href="#painel" data-tab="painel" class="on">painel</a>
    </nav>

    <div class="user">
      <div>
        <b>@${esc(os.hostname())}</b>
        ${esc(data.mainIP)} · node ${esc(process.version)}
      </div>
      <div class="avatar">${data.avgCpu}%</div>
    </div>

    <!-- vinil: o arco mostra o uso de RAM -->
    <div class="stage">
      <svg class="arc" viewBox="0 0 700 700" aria-hidden="true">
        <circle cx="350" cy="350" r="${R}" stroke="#dedede" stroke-width="14" stroke-dasharray="${arcLen} ${C}"/>
        <circle cx="350" cy="350" r="${R}" stroke="var(--blue)" stroke-width="14" stroke-dasharray="${arcFill} ${C}"/>
      </svg>
      <div class="vinyl"></div>
      <div class="vinyl-label"><span>${data.ramUsage}%</span></div>
      <button class="ctrl pause" id="btnPause" aria-label="pausar música">❚❚</button>
      <button class="ctrl play" id="btnPlay" aria-label="tocar música">▶</button>
      ${tracks.length > 1 ? '<button class="ctrl next" id="btnNext" aria-label="próxima música">❭❭</button>' : ""}
      <div class="nowp" id="nowp" aria-live="polite">música parada</div>
    </div>

    <section class="center">
      <i class="blob a"></i><i class="blob b"></i><i class="blob c"></i>
      <div class="pane" id="pane-home">
        <h1 class="big">Home</h1>
        <div class="sub">${esc(os.hostname())} · online há ${formatUptime(process.uptime())}</div>
        ${kv([
          ["memória ram", data.ramUsage + "%"],
          ["processador", data.avgCpu + "%"],
          ["disco", data.disk.percent],
          ["visitas ao site", String(totalRequests)],
          ["estado", data.status.text],
        ])}
        <div class="bubble">${esc(data.status.msg)}</div>
      </div>

      <div class="pane" id="pane-hardware">
        <h1 class="big">Hardware</h1>
        <div class="sub">${esc(data.cpus[0].model.trim())}</div>
        ${kv([
          ["vcpus", String(data.cpus.length)],
          ["arquitetura", os.arch()],
          ["ram total", toGB(os.totalmem()) + " GB"],
          ["ram livre", toGB(os.freemem()) + " GB"],
          ["node (rss)", toMB(process.memoryUsage().rss) + " MB"],
          ["disco total", data.disk.size],
          ["disco usado", data.disk.used + " (" + data.disk.percent + ")"],
          ["disco livre", data.disk.avail],
        ])}
      </div>

      <div class="pane" id="pane-rede">
        <h1 class="big">Rede</h1>
        <div class="sub">ambiente e ligação</div>
        ${kv([
          ["hostname", os.hostname()],
          ["ip", data.mainIP],
          ["sistema", os.type() + " " + os.release()],
          ["node", process.version],
          ["porta", String(PORT)],
          ["branch", data.git.branch],
          ["commit", data.git.hash],
        ])}
        <p class="desc">${esc(data.git.msg.split("\n")[0])}</p>
      </div>

      <div class="pane" id="pane-ficheiros">
        <h1 class="big">Ficheiros</h1>
        <div class="sub">pasta raiz do projeto</div>
        <div class="pills">${data.files.map((f) => "<span>" + esc(f) + "</span>").join("") || "<span>vazio</span>"}</div>
        <p class="desc">a mostrar os primeiros ${data.files.length} itens da pasta onde o servidor está a correr.</p>
      </div>

      <div class="pane on" id="pane-painel">
        <h1 class="big">Memória</h1>
        <div class="sub">uso de ram · ${toGB(os.totalmem())} gb no total</div>
        <p class="desc">Último commit na branch ${esc(data.git.branch)}: ${esc(data.git.msg.split("\n")[0])}.</p>
        <div class="bubble">${esc(data.status.msg)}</div>
        <div class="chart-box"><canvas id="ramChart"></canvas></div>
      </div>
    </section>

    <aside class="side">
      <h2>Sistema</h2>
      ${cards.map((c) => `
      <div class="item ${c.active ? "active" : ""}">
        <div class="thumb">${esc(c.k)}</div>
        <div><div class="t">${esc(c.t)}</div><div class="s">${esc(c.s)}</div></div>
      </div>`).join("")}
      <div class="foot">atualiza sozinho a cada 10 segundos.<br>se algo falhar, vê os registos abaixo.</div>
    </aside>

    <div class="logs">
      <i class="mag"></i>
      <div class="lines">
        ${logsArray.length ? logsArray.map((l) => `<div>${esc(l)}</div>`).join("") : "<div>a aguardar eventos...</div>"}
      </div>
      <div class="close">×</div>
    </div>
  </main>

  <script>
    Chart.defaults.color = '#8a8a8e';
    Chart.defaults.font.family = "'Quicksand', sans-serif";
    /* ---------- gráfico ---------- */
    let ramChart = null;
    function buildChart(hist) {
      const canvas = document.getElementById('ramChart');
      if (!canvas) return;
      if (ramChart) ramChart.destroy();
      ramChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: hist.map(h => h.time),
          datasets: [{
            data: hist.map(h => h.value),
            borderColor: '#8fb0c1',
            backgroundColor: 'rgba(180, 205, 224, 0.35)',
            borderWidth: 3, tension: 0.35, fill: true, pointRadius: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, ticks: { stepSize: 50 } },
            x: { grid: { display: false }, ticks: { display: false }, border: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    /* ---------- sons (gerados no navegador, sem ficheiros) ---------- */
    let soundOn = true;
    try { soundOn = localStorage.getItem('sound') !== 'off'; } catch (e) {}
    let unlocked = false, audio = null;
    ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { unlocked = true; }, { once: true }));

    function tone(freq, dur = 0.12, type = 'sine', vol = 0.08, delay = 0) {
      if (!soundOn || !unlocked) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        const t = audio.currentTime + delay;
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (e) {}
    }
    const sfx = {
      tab:   () => { tone(660, .09); tone(880, .13, 'sine', .07, .07); },
      hover: () => tone(540, .04, 'triangle', .02),
      play:  () => { tone(523, .1); tone(659, .1, 'sine', .08, .09); tone(784, .18, 'sine', .08, .18); },
      pause: () => { tone(784, .1); tone(523, .18, 'sine', .08, .09); },
      on:    () => { tone(600, .08); tone(900, .12, 'sine', .07, .08); },
      warn:  () => { tone(440, .16, 'triangle', .07); tone(440, .16, 'triangle', .07, .22); },
      crit:  () => { tone(330, .2, 'square', .05); tone(247, .3, 'square', .05, .24); }
    };

    const sndBtn = document.getElementById('snd');
    function paintSnd() {
      sndBtn.textContent = soundOn ? 'som: ligado' : 'som: desligado';
      sndBtn.classList.toggle('off', !soundOn);
      sndBtn.setAttribute('aria-pressed', String(soundOn));
    }
    sndBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      try { localStorage.setItem('sound', soundOn ? 'on' : 'off'); } catch (e) {}
      paintSnd();
      if (soundOn) sfx.on(); else pauseMusic();
    });
    paintSnd();

    /* ---------- abas ---------- */
    const tabs = [...document.querySelectorAll('nav a')];
    let currentTab = location.hash.slice(1) || 'painel';
    function showTab(name) {
      if (!document.getElementById('pane-' + name)) name = 'painel';
      currentTab = name;
      tabs.forEach(a => a.classList.toggle('on', a.dataset.tab === name));
      document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + name));
      if (ramChart) ramChart.resize();
    }
    tabs.forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.history.replaceState(null, '', '#' + a.dataset.tab);
        showTab(a.dataset.tab);
        sfx.tab();
      });
      a.addEventListener('mouseenter', () => sfx.hover());
    });

    /* ---------- música ---------- */
    const TRACKS = ${JSON.stringify(tracks).replace(/</g, "\\u003c")};
    const vinyl = document.querySelector('.vinyl');
    const bgm = document.getElementById('bgm');
    const nowp = document.getElementById('nowp');
    let playing = false, idx = 0;

    function ac() {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      return audio;
    }

    // lo-fi original gerado no navegador (usado quando a pasta "musicas" está vazia)
    const CHORDS = [
      { bass: 110.00, pad: [220.00, 261.63, 329.63], arp: [261.63, 329.63, 392.00, 523.25] }, // Am7
      { bass:  87.31, pad: [174.61, 261.63, 329.63], arp: [220.00, 261.63, 329.63, 440.00] }, // Fmaj7
      { bass: 130.81, pad: [196.00, 246.94, 329.63], arp: [261.63, 329.63, 392.00, 493.88] }, // Cmaj7
      { bass:  98.00, pad: [196.00, 246.94, 293.66], arp: [246.94, 293.66, 329.63, 392.00] }  // G6
    ];
    const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
    const STEP = 60 / 72 / 2; // colcheias a 72 bpm
    const synth = { bus: null, noise: null, timer: null, next: 0, step: 0 };

    function synthSetup(a) {
      if (synth.bus) return;
      const bus = a.createGain();
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const delay = a.createDelay(); delay.delayTime.value = STEP * 3;
      const fb = a.createGain(); fb.gain.value = 0.3;
      const wet = a.createGain(); wet.gain.value = 0.35;
      bus.connect(lp); lp.connect(a.destination);
      lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(a.destination);
      const buf = a.createBuffer(1, a.sampleRate * 0.1, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
      synth.bus = bus; synth.noise = buf;
    }
    function note(f, t, dur, type, vol, att = 0.01) {
      const a = audio, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(synth.bus);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function kick(t) {
      const a = audio, o = a.createOscillator(), g = a.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(synth.bus); o.start(t); o.stop(t + 0.22);
    }
    function hat(t, vol) {
      const a = audio, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = synth.noise; f.type = 'highpass'; f.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(synth.bus); src.start(t); src.stop(t + 0.06);
    }
    function scheduleStep(i, t) {
      const c = CHORDS[Math.floor(i / 8) % 4], st = i % 8;
      if (st === 0) { c.pad.forEach(f => note(f, t, 3.3, 'sine', 0.022, 0.6)); note(c.bass, t, 1.6, 'sine', 0.09, 0.02); }
      if (st === 4) note(c.bass, t, 1.2, 'sine', 0.07);
      if (st === 0 || st === 5) kick(t);
      hat(t, st % 2 ? 0.014 : 0.007);
      note(c.arp[ARP[st]], t, 0.55, 'triangle', 0.035);
    }
    function startSynth() {
      const a = ac(); synthSetup(a);
      synth.bus.gain.cancelScheduledValues(a.currentTime);
      synth.bus.gain.setTargetAtTime(1, a.currentTime, 0.05);
      synth.next = a.currentTime + 0.1;
      clearInterval(synth.timer);
      synth.timer = setInterval(() => {
        while (synth.next < a.currentTime + 0.3) {
          scheduleStep(synth.step, synth.next + (synth.step % 2 ? 0.03 : 0));
          synth.next += STEP; synth.step++;
        }
      }, 100);
    }
    function stopSynth() {
      clearInterval(synth.timer);
      if (audio && synth.bus) synth.bus.gain.setTargetAtTime(0, audio.currentTime, 0.12);
    }

    function trackName() { return TRACKS.length ? TRACKS[idx].name : 'lo-fi orbital · gerada no navegador'; }
    function setNow() { nowp.textContent = playing ? '♪ ' + trackName() : 'música parada'; }
    function loadTrack() { bgm.src = TRACKS[idx].url; bgm.play().catch(() => {}); }

    function playMusic() {
      unlocked = true;
      if (!soundOn) { soundOn = true; try { localStorage.setItem('sound', 'on'); } catch (e) {} paintSnd(); }
      playing = true;
      vinyl.classList.add('playing');
      if (TRACKS.length) { if (!bgm.src) loadTrack(); else bgm.play().catch(() => {}); }
      else startSynth();
      setNow();
    }
    function pauseMusic() {
      playing = false;
      vinyl.classList.remove('playing');
      if (TRACKS.length) bgm.pause(); else stopSynth();
      setNow();
    }
    function nextTrack() {
      if (TRACKS.length < 2) return;
      idx = (idx + 1) % TRACKS.length;
      if (playing) loadTrack();
      setNow();
    }
    bgm.addEventListener('ended', nextTrack);
    document.getElementById('btnPlay').addEventListener('click', () => { playMusic(); });
    document.getElementById('btnPause').addEventListener('click', () => { pauseMusic(); sfx.pause(); });
    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.addEventListener('click', () => { nextTrack(); sfx.tab(); });
    setNow();

    // som suave ao passar o rato nos cartões da lista
    document.addEventListener('mouseover', e => {
      const it = e.target.closest && e.target.closest('.item');
      if (it && !it.contains(e.relatedTarget)) sfx.hover();
    });

    /* ---------- atualização sem recarregar a página ---------- */
    const rank = { 'estável': 0, 'sobrecarga': 1, 'crítico': 2 };
    let lastStatus = ${JSON.stringify(data.status.text)};

    async function refresh() {
      try {
        const html = await (await fetch(location.pathname, { cache: 'no-store' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // o vinil e os botões ficam; só o conteúdo muda (a rotação não reinicia)
        ['.user', '.arc', '.vinyl-label', '.center', '.side', '.logs'].forEach(sel => {
          const novo = doc.querySelector(sel), atual = document.querySelector(sel);
          if (novo && atual) atual.replaceWith(novo);
        });
        const h = html.match(new RegExp('const ' + 'histData = (\\[.*?\\]);'));
        showTab(currentTab);
        buildChart(h ? JSON.parse(h[1]) : []);
        const st = html.match(new RegExp('const ' + 'statusNow = "(.*?)";'));
        if (st && st[1] !== lastStatus) {
          if ((rank[st[1]] || 0) > (rank[lastStatus] || 0)) (st[1] === 'crítico' ? sfx.crit : sfx.warn)();
          lastStatus = st[1];
        }
      } catch (e) { /* mantém a vista atual e tenta de novo */ }
    }
    setInterval(refresh, 10000);

    const histData = ${JSON.stringify(ramHistory)};
    const statusNow = ${JSON.stringify(data.status.text)};
    buildChart(histData);
    showTab(currentTab);
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("painel pronto na porta " + PORT));
