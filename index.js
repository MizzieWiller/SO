const express = require('express');
const os = require('os');
const fs = require('fs'); // Módulo adicionado para ler os arquivos

const app = express();

app.get('/', (req, res) => {
  // 1. Processamento (CPU)
  const cpus = os.cpus();
  const modeloCPU = cpus[0].model;

  // 2. Rede (Filtrando apenas os IPs IPv4 que não são internos)
  const redes = os.networkInterfaces();
  let ips = [];
  for (const interfaceNome in redes) {
    redes[interfaceNome].forEach(rede => {
      if (!rede.internal && rede.family === 'IPv4') {
        ips.push(`${interfaceNome}: ${rede.address}`);
      }
    });
  }

  // 3. Arquivos (Lista os arquivos na pasta atual do servidor)
  let arquivos = [];
  try {
      arquivos = fs.readdirSync(__dirname).join(', ');
  } catch (err) {
      arquivos = "Erro ao ler arquivos";
  }

  // 4. Dados do Usuário do Sistema
  const usuarioInfo = os.userInfo().username;

  res.send(`
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monitor de Sistemas</title>
      <style>
        body { font-family: sans-serif; margin: 40px; color: #333; line-height: 1.6; }
        h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        h3 { color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; }
        p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <h1>Monitor de Sistemas Operacionais</h1>
      
      <h3>Sistema e Hardware</h3>
      <p><strong>Hostname:</strong> ${os.hostname()}</p>
      <p><strong>Plataforma:</strong> ${os.platform()}</p>
      <p><strong>Arquitetura:</strong> ${os.arch()}</p>
      <p><strong>Usuário Logado no SO:</strong> ${usuarioInfo}</p>
      
      <h3>Memória RAM</h3>
      <p><strong>Total:</strong> ${Math.round(os.totalmem() / 1024 / 1024)} MB</p>
      <p><strong>Livre:</strong> ${Math.round(os.freemem() / 1024 / 1024)} MB</p>
      <p><strong>Em Uso:</strong> ${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB</p>

      <h3>Processamento</h3>
      <p><strong>Total de CPUs:</strong> ${cpus.length}</p>
      <p><strong>Modelo da CPU:</strong> ${modeloCPU}</p>

      <h3>Tempo Ativo (Uptime)</h3>
      <p><strong>Uptime do Servidor (SO):</strong> ${Math.round(os.uptime() / 60)} minutos</p>
      <p><strong>Uptime da Aplicação Node:</strong> ${Math.round(process.uptime())} segundos</p>

      <h3>Ambiente</h3>
      <p><strong>Versão do Node.js:</strong> ${process.version}</p>
      <p><strong>Ambiente (NODE_ENV):</strong> ${process.env.NODE_ENV || 'Não definido'}</p>
      <p><strong>Serviço Render ID:</strong> ${process.env.RENDER_SERVICE_ID || 'Rodando Local'}</p>

      <h3>Rede</h3>
      <p><strong>Interfaces Ativas:</strong> ${ips.length > 0 ? ips.join(' | ') : 'Nenhuma externa detectada'}</p>

      <h3>Arquivos do Diretório Atual</h3>
      <p><strong>Lista:</strong> ${arquivos}</p>
      <p><strong>Caminho Atual:</strong> ${__dirname}</p>

    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
