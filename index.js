const express = require('express');
const os = require('os');

const app = express();

app.get('/', (req, res) => {
  res.send(`
    <h1>Monitor de Sistemas Operacionais</h1>
    <p><strong>Hostname:</strong> ${os.hostname()}</p>
    <p><strong>Plataforma:</strong> ${os.platform()}</p>
    <p><strong>Arquitetura:</strong> ${os.arch()}</p>
    <p><strong>Memória Total:</strong> ${Math.round(os.totalmem()/1024/1024)} MB</p>
    <p><strong>Memória Livre:</strong> ${Math.round(os.freemem()/1024/1024)} MB</p>
    <p><strong>CPUs:</strong> ${os.cpus().length}</p>
    <p><strong>Uptime:</strong> ${Math.round(os.uptime()/60)} minutos</p>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando"));