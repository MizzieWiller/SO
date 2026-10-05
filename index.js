const express = require('express');
const os = require('os');
const fs = require('fs');

const app = express();

// Função para formatar segundos em dias, horas e minutos
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
  // 1. Processamento e Desempenho
  const cpus = os.cpus();
  const modeloCPU = cpus.length > 0 ? cpus[0].model : 'Desconhecido';
  const loadAvg = os.loadavg(); // Média de carga: [1 min, 5 min, 15 min]

  // 2. Memória RAM
  const memTotal = Math.round(os.totalmem() / 1024 / 1024);
  const memLivre = Math.round(os.freemem() / 1024 / 1024);
  const memEmUso = memTotal - memLivre;
  const porcentagemUso = Math.round((memEmUso / memTotal) * 100);
  
  // Memória usada apenas pelo processo Node.js
  const nodeRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);

  // 3. Status Geral Lógico
  let statusGeral = "🟢 Saudável";
  let corStatus = "#10b981"; // Verde
  if (porcentagemUso > 90) {
    statusGeral = "🔴 Crítico";
    corStatus = "#ef4444"; // Vermelho
  } else if (porcentagemUso > 75) {
    statusGeral = "🟡 Atenção";
    corStatus = "#f59e0b"; // Amarelo
  }

  // 4. Rede e IP Principal
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

  // 5. Sistema e Arquivos
  const kernel = os.release();
  let arquivos = [];
  try {
      arquivos = fs.readdirSync(__dirname).join(', ');
  } catch (err) {
      arquivos = "Erro ao ler arquivos";
  }

  // Tempos
  const tempoSO = formatarTempo(os.uptime());
  const tempoNode = formatarTempo(process.uptime());

  res.send(`
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dashboard do Servidor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;700&display=swap');
        
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
        
        /* Cor dinâmica para o Status */
        .status-badge { color: ${corStatus}; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }

        /* GRID POST-ITS */
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 30px;
          padding: 10px;
        }

        .post-it {
          background-color: #f3e8ff; 
          padding: 25px;
          border-radius: 2px 15px 15px 15px;
          box-shadow: 3px 5px 15px rgba(109, 40, 217, 0.15);
          font-family: 'Kalam', cursive; 
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .post-it::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          border-width: 0 0 20px 20px;
          border-style: solid;
          border-color: transparent transparent #e9d5ff transparent;
          box-shadow: 2px 2px 2px rgba(0,0,0,0.05);
        }

        .post-it:nth-child(odd) { transform: rotate(-1.5deg); }
        .post-it:nth-child(even) { transform: rotate(1.5deg); }
        .post-it:hover { transform: scale(1.05) rotate(0deg); z-index: 10; box-shadow: 5px 8px 20px rgba(109, 40, 217, 0.3); }

        .post-it h3 { 
          color: #5b21b6; 
          border-bottom: 2px dashed #d8b4fe; 
          padding-bottom: 5px; 
          margin-top: 0; 
          font-family: 'Nunito', sans-serif;
        }
        .post-it p { margin: 8px 0; font-size: 1.1em; color: #2e1065; }
        .code-inline { background: #e9d5ff; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
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
        
        <div class="post-it">
          <h3>💻 Sistema e Kernel</h3>
          <p><strong>Plataforma:</strong> ${os.platform()} <span class="code-inline">${os.arch()}</span></p>
          <p><strong>Versão do Kernel:</strong> ${kernel}</p>
          <p><strong>Hostname:</strong> ${os.hostname()}</p>
          <p><strong>Usuário Logado:</strong> ${os.userInfo().username}</p>
        </div>

        <div class="post-it">
          <h3>🚀 Desempenho (CPU)</h3>
          <p><strong>Carga (1m, 5m, 15m):</strong><br> ${loadAvg[0].toFixed(2)} | ${loadAvg[1].toFixed(2)} | ${loadAvg[2].toFixed(2)}</p>
          <p><strong>Total de Núcleos:</strong> ${cpus.length}</p>
          <p><strong>Modelo:</strong> ${modeloCPU}</p>
        </div>

        <div class="post-it">
          <h3>🧠 Memória RAM</h3>
          <p><strong>Total:</strong> ${memTotal} MB</p>
          <p><strong>Livre:</strong> ${memLivre} MB</p>
          <p><strong>App Node Atual:</strong> Consumindo ~${nodeRAM} MB</p>
        </div>

        <div class="post-it">
          <h3>⏱️ Uptime do Servidor</h3>
          <p><strong>Máquina Virtual:</strong><br> ${tempoSO}</p>
          <p><strong>Aplicação Node.js:</strong><br> ${tempoNode}</p>
        </div>

        <div class="post-it">
          <h3>🌍 Rede</h3>
          <p><strong>IP Principal:</strong> ${ipPrincipal}</p>
          <p><strong>Todas Interfaces:</strong><br> ${ips.length > 0 ? ips.join('<br>') : 'Nenhuma'}</p>
        </div>

        <div class="post-it">
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
