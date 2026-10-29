# 🖥️ Dashboard de Sistemas Operacionais (SO)

**📍 Acesso em tempo real:** https://so-co8a.onrender.com/

Aplicação **Node.js + Express** que monitora, em tempo real, as métricas do servidor onde está rodando: CPU, memória, disco, rede, Git e arquivos do projeto. Foi desenvolvida como projeto integrador na Disciplina Sistemas Operacionais do curso de **Análise e Desenvolvimento de Sistemas** da **Fatec Itapetininga**, para estudar como uma aplicação web interage diretamente com o hardware da máquina host.

A interface tem o visual de um toca-discos: o arco ao redor do vinil mostra o uso de RAM e o disco gira enquanto a música toca. O painel se atualiza sozinho a cada **10 segundos**, sem recarregar a página, e é útil para analisar e depurar ambientes de hospedagem na nuvem, como o **Render**.

---

## 📑 Sumário

- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do repositório](#-estrutura-do-repositório)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#️-configuração)
- [Execução](#️-execução)
- [Rotas / API](#-rotas--api)
- [Como as métricas são coletadas](#-como-as-métricas-são-coletadas)
- [Banco de dados](#️-banco-de-dados)
- [Testes](#-testes)
- [Deploy](#-deploy)
- [Limitações conhecidas](#️-limitações-conhecidas)
- [Solução de problemas](#-solução-de-problemas)
- [Autor](#-autor)

---

## ✨ Funcionalidades

O painel tem cinco abas de navegação (também acessíveis por `#home`, `#hardware`, `#rede`, `#ficheiros` e `#painel`):

| Aba | O que mostra |
|---|---|
| **Home** | Hostname, tempo online, uso de RAM, CPU e disco, total de visitas e estado geral |
| **Hardware** | Modelo do processador, vCPUs, arquitetura, RAM total/livre, memória do Node (RSS), disco total/usado/livre |
| **Rede** | Hostname, IP, sistema operacional e kernel, versão do Node, porta, branch e commit do Git |
| **Ficheiros** | Primeiros 7 itens da pasta onde o servidor está rodando |
| **Painel** | Gráfico do histórico de RAM (últimas 25 leituras) e último commit |

Recursos adicionais:

- **Estado do servidor** calculado pelo uso de RAM: `estável` (até 65%), `sobrecarga` (acima de 65%) e `crítico` (acima de 85%).
- **Log de eventos** na própria interface, com as últimas 15 mensagens do servidor.
- **Player de música**: toca arquivos da pasta `musicas/` ou, se ela estiver vazia, um lo-fi gerado no próprio navegador.
- **Efeitos sonoros** nas interações e alertas quando o estado piora. O botão "som" liga e desliga (a preferência fica salva no `localStorage`).
- **Anti-hibernação**: o servidor faz um ping periódico para evitar que o Render o coloque para dormir (veja [Configuração](#️-configuração)).

## 🧰 Tecnologias

- [Node.js](https://nodejs.org/) (o deploy atual roda na v24)
- [Express](https://expressjs.com/) `^5.2.1`
- Módulos nativos do Node: `os`, `fs`, `path` e `child_process`
- [Chart.js](https://www.chartjs.org/) (carregado via CDN no navegador)
- Google Fonts: Lexend e Quicksand (via CDN)
- Hospedagem: [Render](https://render.com/)

> O `package.json` também lista o pacote `cors`, mas o `index.js` atual não o utiliza.

## 📁 Estrutura do repositório

```
SO/
├── index.js            # Servidor Express: coleta as métricas e gera a página HTML
├── package.json        # Dependências do projeto
├── package-lock.json   # Versões travadas das dependências
├── musicas/            # (opcional) músicas do player; criada automaticamente ao iniciar
└── README.md
```

Todo o front-end (HTML, CSS e JavaScript do navegador) está dentro do `index.js`, em uma única *template string*. Não há pasta `public/` nem arquivos de front-end separados.

## 📋 Pré-requisitos

| Ferramenta | Versão | Por quê | Verificar com |
|---|---|---|---|
| [Node.js](https://nodejs.org/) | **18 ou superior** | Express 5 exige Node 18+, e o projeto usa o `fetch` nativo | `node -v` |
| npm | Vem com o Node | Instalar as dependências | `npm -v` |
| [Git](https://git-scm.com/) | Qualquer versão recente | Clonar o projeto e exibir branch/commit no painel | `git --version` |

**Sistema operacional:** o painel foi pensado para **Linux ou macOS**. O uso de disco é lido com o comando `df -h / | tail -1`, que não existe no Windows. Lá o painel funciona, mas o disco aparece como `N/A`. Para rodar no Windows com tudo funcionando, use o [WSL](https://learn.microsoft.com/windows/wsl/).

**Navegador:** precisa de acesso à internet para carregar o Chart.js e as fontes pelos CDNs (jsDelivr e Google Fonts).

## 📦 Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/MizzieWiller/SO.git

# 2. Entre na pasta
cd SO

# 3. Instale as dependências
npm install
```

## ⚙️ Configuração

### Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `PORT` | Não | `3000` | Porta em que o servidor escuta. No Render é definida automaticamente (em produção o painel mostra a porta `10000`) |

Não há chaves de API, senhas ou segredos, então **não é preciso criar um arquivo `.env`**.

```bash
# Linux / macOS
PORT=4000 node index.js

# Windows (PowerShell)
$env:PORT=4000; node index.js
```

### URL do anti-hibernação

No topo do `index.js` há uma constante usada para o ping periódico (a cada 10 minutos):

```js
const URL_DO_SEU_SITE = "https://seu-projeto.onrender.com";
```

Se for publicar o projeto, **troque esse valor pela URL do seu deploy** (no deploy original, `https://so-co8a.onrender.com`). Com o valor de exemplo, o ping vai para um endereço que não é o do seu serviço e não impede a hibernação. Para rodar só localmente, pode deixar como está (o ping apenas registra uma falha no log).

### Músicas (opcional)

Coloque arquivos `.mp3`, `.ogg`, `.wav`, `.m4a` ou `.webm` na pasta `musicas/`. Eles aparecem automaticamente no player e ficam disponíveis em `/musicas/<arquivo>`. Se a pasta estiver vazia, o player toca uma trilha lo-fi sintetizada no navegador. O botão de próxima música só aparece com 2 ou mais faixas.

> Atenção a direitos autorais: use somente músicas que você tem permissão para distribuir, já que a pasta é pública.

## ▶️ Execução

```bash
node index.js
```

O terminal deve mostrar `painel pronto na porta 3000` (ou a porta definida em `PORT`). Depois, acesse:

```
http://localhost:3000
```

## 🔌 Rotas / API

O projeto **não tem uma API JSON**. O servidor expõe apenas duas rotas:

| Método | Rota | Descrição | Resposta |
|---|---|---|---|
| `GET` | `/` | Página completa do painel, renderizada no servidor com as métricas do momento | `text/html` |
| `GET` | `/musicas/<arquivo>` | Arquivos de áudio da pasta `musicas/` (servidos como estáticos) | Áudio |

**Como a atualização automática funciona:** a cada 10 segundos o navegador faz um novo `GET /`, extrai do HTML recebido os blocos atualizados (`.user`, `.arc`, `.vinyl-label`, `.center`, `.side` e `.logs`) e os substitui na página. O vinil e os controles do player são mantidos, por isso a música e a rotação não reiniciam. O estado (`estável`, `sobrecarga`, `crítico`) e o histórico de RAM são lidos de variáveis embutidas no HTML.

```bash
# Ver o HTML gerado
curl http://localhost:3000/

# Listar o que aparece na pasta de músicas
curl -I http://localhost:3000/musicas/minha-musica.mp3
```

## 📊 Como as métricas são coletadas

| Métrica | Origem |
|---|---|
| RAM total / livre / % | `os.totalmem()` e `os.freemem()` |
| CPU (%) | Média, entre os núcleos, de `os.cpus()[].times` |
| Modelo, vCPUs, arquitetura | `os.cpus()` e `os.arch()` |
| Disco | `df -h /` via `child_process.execSync` |
| Git (branch, commit, mensagem) | `git rev-parse` e `git log -1` via `execSync` |
| IP | Primeira interface IPv4 não interna de `os.networkInterfaces()` |
| Uptime | `process.uptime()` |
| Memória do Node | `process.memoryUsage().rss` |
| Visitas | Contador em memória, incrementado a cada requisição |
| Histórico de RAM | Amostra a cada 10 s, guardando as últimas 25 |

## 🗄️ Banco de dados

**Não se aplica.** O projeto não usa banco de dados. O contador de visitas, o histórico de RAM e o log de eventos ficam **em memória** e são zerados sempre que o servidor reinicia (ou hiberna, no Render).

## 🧪 Testes

Ainda não há testes automatizados (não existe framework de testes nem script `test` no `package.json`). A verificação é manual:

1. Suba o servidor com `node index.js` e confirme a mensagem `painel pronto na porta ...`.
2. Abra `http://localhost:3000` e navegue pelas cinco abas.
3. Aguarde 10 segundos e veja se os valores e o gráfico de RAM se atualizam sem recarregar a página.
4. Compare RAM e CPU com o monitor do sistema (`htop`, `top` ou Gerenciador de Tarefas).
5. Clique em ▶ e verifique se o vinil gira e se a música toca. Teste também o botão "som".
6. Confira o `curl http://localhost:3000/` retornando HTML com status `200`.
7. Em tela pequena (ou no modo responsivo do navegador), confira se o layout se reorganiza em coluna única.

## 🚀 Deploy

O projeto está publicado no **Render** como *Web Service*: https://so-co8a.onrender.com/

Para publicar sua própria cópia:

1. Faça um fork do repositório (ou suba o código em um repositório seu no GitHub).
2. No [Render](https://dashboard.render.com/), clique em **New → Web Service** e conecte o repositório.
3. Preencha:

   | Campo | Valor |
   |---|---|
   | Runtime / Language | `Node` |
   | Branch | `main` |
   | Build Command | `npm install` |
   | Start Command | `node index.js` |

4. Não é preciso configurar variáveis de ambiente: o Render define `PORT` automaticamente.
5. Edite `URL_DO_SEU_SITE` no `index.js` com a URL que o Render gerar para o seu serviço e faça um novo `git push`.
6. A cada `git push` na `main`, o Render refaz o deploy (se o *auto-deploy* estiver ativo).

> ℹ️ No plano gratuito o Render hiberna serviços sem acessos por um tempo. Por isso o projeto tem o ping automático, que só funciona se a URL estiver correta. Depois de uma hibernação, o primeiro acesso demora alguns segundos, e o contador de visitas e o uptime voltam a zero.

> ℹ️ No Render, as métricas de RAM, CPU e disco são do **servidor físico/host** (por exemplo, 8 vCPUs e ~30 GB de RAM), e não somente da cota do seu serviço.

## ⚠️ Limitações conhecidas

- **CPU não é em tempo real:** o valor é a média acumulada desde que a máquina ligou (usa os contadores de `os.cpus()`), então varia pouco.
- **"Visitas" conta requisições, não pessoas:** cada atualização automática de 10 s, cada acesso a `/musicas/...` e o próprio ping contam no total.
- **Compatibilidade:** disco e Git dependem dos comandos `df`, `tail` e `git`. Sem eles, os campos aparecem como `N/A`.
- **Dependência sem uso:** o `cors` está no `package.json`, mas não é utilizado.
- **`node_modules/` versionada:** veja abaixo.

## 🩹 Solução de problemas

| Problema | Causa provável | Solução |
|---|---|---|
| `Cannot find module 'express'` | Dependências não instaladas | Rode `npm install` |
| `EADDRINUSE` | Porta já em uso | Use outra: `PORT=4000 node index.js` |
| `fetch is not defined` ou erro de sintaxe | Node antigo | Atualize para Node 18+ |
| Disco aparece como `N/A` | Rodando no Windows (sem `df`) | Use WSL, Linux ou macOS |
| Branch/commit aparecem como `N/A` | Pasta sem repositório Git ou Git não instalado | Rode dentro do clone do repo e instale o Git |
| Gráfico e fontes não carregam | Sem acesso aos CDNs | Verifique a conexão com a internet |
| Log mostra `falha no ping` | `URL_DO_SEU_SITE` com a URL de exemplo ou fora do ar | Ajuste a URL (veja [Configuração](#️-configuração)) |
| Sem som ao abrir a página | O navegador bloqueia áudio antes de uma interação | Clique em qualquer lugar ou no ▶ |
| Repositório pesado | `node_modules/` está no Git | Veja abaixo |

**Recomendação:** remova `node_modules/` do Git. Quem clonar o projeto e o Render reinstalam tudo com `npm install`.

```bash
echo "node_modules/" >> .gitignore
git rm -r --cached node_modules
git add .gitignore
git commit -m "Remove node_modules do versionamento"
git push
```

## 👤 Autor

Desenvolvido por **MizzieWiller** como projeto integrador da **Fatec Itapetininga**, curso de Análise e Desenvolvimento de Sistemas.
