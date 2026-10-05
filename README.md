# 🖥️ Dashboard de Sistemas Operacionais (SO)

Este repositório contém uma aplicação Node.js com Express concebida para monitorizar as métricas e o desempenho de servidores em tempo real. Desenvolvido como projeto prático para o curso de Análise e Desenvolvimento de Sistemas na Fatec Itapetininga, este sistema explora a interação direta entre a camada aplicacional e o hardware da máquina host.

A interface web apresenta um painel de controlo dinâmico que atualiza automaticamente a cada 10 segundos, convertendo dados brutos do sistema operativo (como memória, carga de CPU e rede) em visualizações acessíveis, ideal para analisar e depurar ambientes de alojamento na nuvem como o Render.

## 🚀 O que este projeto faz

*   **Monitorização de Hardware e Desempenho:** Regista o consumo de RAM, a carga de processamento (*Load Average* do Linux) e os dados dos núcleos da CPU.
*   **Métricas de Rede e Sistema:** Identifica o IP principal, interfaces de rede ativas, versão do Kernel e calcula de forma independente o *uptime* da máquina virtual e da aplicação Node.js.
*   **Gráficos Animados em Tempo Real:** Utiliza a biblioteca Chart.js para desenhar uma linha temporal histórica do consumo de memória a cada atualização.
*   **Mini-Terminal de Logs:** Interceta o fluxo nativo do `console.log` e exibe o histórico de eventos e erros diretamente na página web, facilitando a depuração sem necessidade de acesso remoto via terminal.
*   **Leitura de Disco e Ficheiros:** Lista dinamicamente os ficheiros na raiz do projeto e consulta o armazenamento disponível na partição principal do servidor.
*   **Integração Contínua (Git):** Lê os dados locais do repositório para exibir no ecrã a *branch*, o *hash* e a mensagem do último *commit* que está atualmente em produção.

---
**📍 Acesso em Tempo Real:** [https://so-co8a.onrender.com/]
