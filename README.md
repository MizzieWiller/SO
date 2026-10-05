# 🖥️ Dashboard de Sistemas Operacionais (SO)

**📍 Acesso em Tempo Real:** [https://so-co8a.onrender.com/]

## 🚀 O que ele faz

Este repositório contém uma aplicação Node.js com Express concebida para monitorizar as métricas e o desempenho de servidores em tempo real. Desenvolvido como projeto prático para o curso de Análise e Desenvolvimento de Sistemas na Fatec Itapetininga, este sistema explora a interação direta entre a camada aplicacional e o hardware da máquina host.

A interface web apresenta um painel de controlo dinâmico que atualiza automaticamente a cada 10 segundos, convertendo dados brutos do sistema operativo (como memória, carga de CPU e rede) em visualizações acessíveis, ideal para analisar e depurar ambientes de alojamento na nuvem como o Render.

## 💭 Para que serve

- **Projeto acadêmico:** foi feito como trabalho prático do curso de Análise e Desenvolvimento de Sistemas da **Fatec Itapetininga**. Serve para estudar como uma aplicação web conversa diretamente com o hardware da máquina onde roda.
- **Monitoramento:** permite acompanhar o desempenho do servidor, como uso de RAM e CPU.
- **Depuração na nuvem:** é útil para analisar e depurar ambientes de hospedagem como o **Render**, onde o painel está publicado.

## Estrutura do repositório

| Arquivo | Função |
| --- | --- |
| `index.js` | Servidor Express que coleta as métricas e gera a página |
| `package.json` / `package-lock.json` | Dependências e configuração do projeto |
| `README.md` | Descrição do projeto |
| `node_modules/` | Dependências instaladas (está versionada no repositório) |
