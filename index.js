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
  // 1. Processamento e CPU
  const cpus = os.cpus();
  const modeloCPU = cpus[0].model;

  // 2. Memória
  const memTotal = Math.round(os.totalmem() / 1024 / 1024);
  const memLivre = Math.round(os.freemem() / 1024 / 1024);
  const memEmUso = memTotal - memLivre;
  const porcentagemUso = Math.round((memEmUso / memTotal) * 100);

  // 3. Tempos convertidos
  const tempoSO = formatarTempo(os.uptime());
  const tempoNode = formatarTempo(process.uptime());

  // 4. Rede
  const redes = os.networkInterfaces();
  let ips = [];
  for (const interfaceNome in redes) {
    redes[interfaceNome].forEach(rede => {
      if (!rede.internal && rede.family === 'IPv4') {
        ips.push(`${interfaceNome}: ${rede.address}`);
      }
    });
  }

  // 5. Arquivos do diretório
  let arquivos = [];
  try {
      arquivos = fs.readdirSync(__dirname).join(', ');
  } catch (err) {
      arquivos = "Erro ao ler arquivos";
  }

  const usuarioInfo = os.userInfo().username;

  // Renderização da interface com HTML e CSS
  res.send(`
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monitor de Sistemas</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* Importando fontes do Google para o texto e estilo "escrito à mão" dos post-its */
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Nunito:wght@400;700&display=swap');
        
        body { 
          font-family: 'Nunito', sans-serif; 
          background-color: #faf5ff; /* Fundo roxo muito claro */
          margin: 0; 
          padding: 30px; 
          color: #3b2163; 
        }
        
        /* BARRA SUPERIOR (RESUMO) */
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

        /* GRID PARA OS POST-ITS */
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          padding: 10px;
        }

        /* ESTILO DOS POST-ITS */
        .post-it {
          background-color: #f3e8ff; /* Cor do papel: roxo bem claro */
          padding: 25px;
          /* Borda arredondada com um leve defeito para imitar papel real */
          border-radius: 2px 15px 15px 15px;
          box-shadow: 3px 5px 15px rgba(109, 40, 217, 0.15);
          font-family: 'Kalam', cursive; /* Fonte imitando caneta */
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        /* Efeito visual da ponta dobrada do post-it */
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

        /* Rotação alternada para dar um aspecto desorganizado na parede */
        .post-it:nth-child(odd) { transform: rotate(-1.5deg); }
        .post-it:nth-child(even) { transform: rotate(1.5deg); }
        
        /* Efeito ao passar o mouse */
        .post-it:hover { 
          transform: scale(1.05) rotate(0deg); 
          z-index: 10; 
          box-shadow: 5px 8px 20px rgba(109, 40, 217, 0.3);
        }

        .post-it h3 { 
          color: #5b21b6; 
          border-bottom: 2px dashed #d8b4fe; 
          padding-bottom: 5px; 
          margin-top: 0; 
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
        }
        .post-it p { margin: 8px 0; font-size: 1.1em; color: #2e1065; }
      </style>
    </head>
    <body>
      
      <!-- Barra Superior -->
      <div class="summary-bar">
        <div class="summary-item">
          <span>Status</span>
          <strong>Online 🚀</strong>
        </div>
        <div class="summary-item">
          <span>Uso de RAM</span>
          <strong>${porcentagemUso}%</strong>
        </div>
        <div class="summary-item">
          <span>Uptime Máquina</span>
          <strong>${tempoSO}</strong>
        </div>
        <div class="summary-item">
          <span>Provedor</span>
          <strong>${process.env.RENDER_SERVICE_ID ? 'Render' : 'Local'}</strong>
        </div>
      </div>

      <!-- Área dos Post-its -->
      <div class="grid-container">
        
        <div class="post-it">
          <h3>💻 Sistema e Hardware</h3>
          <p><strong>Hostname:</strong> ${os.hostname()}</p>
          <p><strong>Plataforma:</strong> ${os.platform()}</p>
          <p><strong>Arquitetura:</strong> ${os.arch()}</p>
          <p><strong>Usuário:</strong> ${usuarioInfo}</p>
        </div>

        <div class="post-it">
          <h3>🧠 Memória RAM</h3>
          <p><strong>Total:</strong> ${memTotal} MB</p>
          <p><strong>Livre:</strong> ${memLivre} MB</p>
          <p><strong>Em Uso:</strong> ${memEmUso} MB</p>
        </div>

        <div class="post-it">
          <h3>⚙️ Processamento</h3>
          <p><strong>Total de CPUs:</strong> ${cpus.length}</p>
          <p><strong>Modelo:</strong> ${modeloCPU}</p>
        </div>

        <div class="post-it">
          <h3>⏱️ Tempo Ativo</h3>
          <p><strong>Servidor (SO):</strong><br> ${tempoSO}</p>
          <p><strong>Aplicação (Node):</strong><br> ${tempoNode}</p>
        </div>

        <div class="post-it">
          <h3>🌍 Rede e Ambiente</h3>
          <p><strong>Versão Node:</strong> ${process.version}</p>
          <p><strong>Node Env:</strong> ${process.env.NODE_ENV || 'Não definido'}</p>
          <p><strong>IP Ativo:</strong> ${ips.length > 0 ? ips.join(' | ') : 'Nenhum'}</p>
        </div>

        <div class="post-it">
          <h3>📂 Arquivos (Raiz)</h3>
          <p><strong>Caminho:</strong> ${__dirname}</p>
          <p><strong>Arquivos:</strong> ${arquivos}</p>
        </div>

      </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
