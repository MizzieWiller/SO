const express = require('express');
const os = require('os');
const fs = require('fs');

const app = express();

function formatarTempo(segundosIniciais) {
  const d = Math.floor(segundosIniciais / (3600 * 24));
  const h = Math.floor((segundosIniciais % (3600 * 24)) / 3600);
  const m = Math.floor((segundosIniciais % 3600) / 60);
  
  let resultado = '';
  if (d > 0) resultado += `${d} dias, `;
  if (h > 0 || d > 0) resultado += `${h} horas e `;
  resultado += `${m} minutos`;
  
  return resultado;
}

app.get('/', (req, res) => {
  const cpus = os.cpus();
  const modeloCPU = cpus.length > 0 ? cpus[0].model : 'Desconhecido';
  const loadAvg = os.loadavg(); 

  const memTotal = Math.round(os.totalmem() / 1024 / 1024);
  const memLivre = Math.round(os.freemem() / 1024 / 1024);
  const memEmUso = memTotal - memLivre;
  const porcentagemUso = Math.round((memEmUso / memTotal) * 100);
  const nodeRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);

  let statusGeral = "🟢 Saudável";
  let corStatus = "#10b981"; 
  if (porcentagemUso > 90) {
    statusGeral = "🔴 Crítico";
    corStatus = "#ef4444"; 
  } else if (porcentagemUso > 75) {
    statusGeral = "🟡 Atenção";
    corStatus = "#f59e0b"; 
  }

  const redes = os.networkInterfaces();
  let ips = [];
  let ipPrincipal = "Desconhecido";
  for (const interfaceNome in redes) {
    redes[interfaceNome].forEach(rede => {
      if (!rede.internal && rede.family === 'IPv4') {
        ips.push(`${interfaceNome}: ${rede.address}`);
        if (ipPrincipal === "Desconhecido") ipPrincipal = rede.address;
      }
    });
  }

  const kernel = os.release();
  let arquivos = [];
  try {
      arquivos = fs.readdirSync(__dirname).join(', ');
  } catch (err) {
      arquivos = "Erro ao ler arquivos";
  }

  const tempoSO = formatarTempo(os.uptime());
  const tempoNode = formatarTempo(process.uptime());

  res.send(`
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dashboard do Servidor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* Importando o Nunito (títulos) e o Kalam (textos dos blocos) */
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;600;700&display=swap');
        
        body { 
          font-family: 'Nunito', sans-serif; 
          background-color: #faf5ff; 
          margin: 0; 
          padding: 30px; 
          color: #3b2163; 
        }
        
        /* BARRA SUPERIOR */
        .summary-bar {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          color: white;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 40px;
          box-shadow: 0 4px 15px rgba(109, 40, 217, 0.2);
          flex-wrap: wrap;
          gap: 15px;
        }
        .summary-item { text-align: center; }
        .summary-item span {
          display: block;
          font-size: 0.85em;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        .summary-item strong { font-size: 1.5em; }
        .status-badge { color: ${corStatus}; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }

        /* GRID DE BLOCOS */
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 25px;
          padding: 10px 0;
        }

        /* ESTILO DOS BLOCOS (CARDS) */
        .bloco {
          background-color: #ffffff; 
          padding: 25px;
          border-radius: 12px;
          border: 1px solid #e9d5ff;
          box-shadow: 0 4px 6px rgba(109, 40, 217, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          font-family: 'Kalam', cursive; /* Fonte restaurada para os textos */
        }
        
        .bloco:hover { 
          transform: translateY(-5px); 
          box-shadow: 0 8px 20px rgba(109, 40, 217, 0.15); 
        }

        .bloco h3 { 
          color: #5b21b6; 
          border-bottom: 2px solid #f3e8ff; 
          padding-bottom: 10px; 
          margin-top: 0; 
          font-family: 'Nunito', sans-serif; /* Títulos seguem limpos */
          font-weight: 700;
        }
        .bloco p { margin: 10px 0; font-size: 1.1em; color: #4c1d95; }
        .code-inline { background: #f3e8ff; padding: 3px 8px; border-radius: 6px; font-family: 'Nunito', monospace; font-size: 0.85em; color: #6d28d9; }
      </style>
    </head>
    <body>
      
      <div class="summary-bar">
        <div class="summary-item">
          <span>Status Geral</span>
          <strong class="status-badge">${statusGeral}</strong>
        </div>
        <div class="summary-item">
          <span>IP Principal</span>
          <strong>${ipPrincipal}</strong>
        </div>
        <div class="summary-item">
          <span>Uso de RAM</span>
          <strong>${porcentagemUso}%</strong>
        </div>
        <div class="summary-item">
          <span>Provedor</span>
          <strong>${process.env.RENDER_SERVICE_ID ? 'Render Nuvem' : 'Máquina Local'}</strong>
        </div>
      </div>

      <div class="grid-container">
        
        <div class="bloco">
          <h3>💻 Sistema e Kernel</h3>
          <p><strong>Plataforma:</strong> ${os.platform()} <span class="code-inline">${os.arch()}</span></p>
          <p><strong>Versão do Kernel:</strong> ${kernel}</p>
          <p><strong>Hostname:</strong> ${os.hostname()}</p>
          <p><strong>Usuário Logado:</strong> ${os.userInfo().username}</p>
        </div>

        <div class="bloco">
          <h3>🚀 Desempenho (CPU)</h3>
          <p><strong>Carga (1m, 5m, 15m):</strong><br> ${loadAvg[0].toFixed(2)} | ${loadAvg[1].toFixed(2)} | ${loadAvg[2].toFixed(2)}</p>
          <p><strong>Total de Núcleos:</strong> ${cpus.length}</p>
          <p><strong>Modelo:</strong> ${modeloCPU}</p>
        </div>

        <div class="bloco">
          <h3>🧠 Memória RAM</h3>
          <p><strong>Total:</strong> ${memTotal} MB</p>
          <p><strong>Livre:</strong> ${memLivre} MB</p>
          <p><strong>App Node Atual:</strong> Consumindo ~${nodeRAM} MB</p>
        </div>

        <div class="bloco">
          <h3>⏱️ Uptime do Servidor</h3>
          <p><strong>Máquina Virtual:</strong><br> ${tempoSO}</p>
          <p><strong>Aplicação Node.js:</strong><br> ${tempoNode}</p>
        </div>

        <div class="bloco">
          <h3>🌍 Rede</h3>
          <p><strong>IP Principal:</strong> ${ipPrincipal}</p>
          <p><strong>Todas Interfaces:</strong><br> ${ips.length > 0 ? ips.join('<br>') : 'Nenhuma'}</p>
        </div>

        <div class="bloco">
          <h3>📂 Ambiente e Arquivos</h3>
          <p><strong>Node Version:</strong> ${process.version}</p>
          <p><strong>Diretório:</strong> <span class="code-inline">${__dirname}</span></p>
          <p><strong>Arquivos Raiz:</strong><br> ${arquivos}</p>
        </div>

      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
