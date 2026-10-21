# Contexto
Atue como um Desenvolvedor Front-end Sênior especialista em React e WebRTC. Preciso criar um aplicativo web de **Planning Poker** focado em simplicidade, privacidade e tempo real.

# Requisitos Arquiteturais
- **Hospedagem:** O app será hospedado no **GitHub Pages** (deve ser 100% estático, sem backend Node.js, Python, etc).
- **Sem Banco de Dados:** Não quero salvar nenhuma informação de sessão, histórico ou usuários em bancos de dados. Tudo deve ser efêmero (em memória).
- **Conexão em Tempo Real:** Pessoas diferentes precisam entrar na mesma "sala" para votar.
- **Solução Técnica Exigida:** Como não teremos backend, utilize **WebRTC** (recomendo a biblioteca `peerjs`) para criar uma rede Peer-to-Peer. O usuário que cria a sala atua como o "Host" (gerenciando o estado do jogo) e os outros se conectam a ele via um ID de sala gerado pelo PeerJS.

# Requisitos Funcionais
O aplicativo deve ter as seguintes telas/fluxos:
1. **Tela Inicial (Lobby):**
   - Campo para o usuário digitar seu nome.
   - Botão para "Criar Nova Sala" (Gera um ID de Host no PeerJS e entra na sala).
   - Campo e Botão para "Entrar em uma Sala" (O usuário digita o ID do Host de um colega para se conectar via PeerJS).

2. **Dentro da Sala (Mesa de Votação):**
   - Exibir o "ID da Sala" de forma clara.
   - Mostrar a lista de participantes conectados (com status: "Votando..." ou "Votou!").
   - Um baralho de cartas de Planning Poker visível para todos escolherem.
   - As cartas escolhidas ficam **ocultas** até que o Host decida revelá-las.

3. **Controles do Host:**
   - Botão **"Revelar Cartas"**: Vira as cartas, calcula e exibe a média dos votos.
   - Botão **"Nova Rodada"**: Limpa os votos atuais e vira as cartas para baixo.

# Requisitos de Interface (UI/UX)
- Use **Tailwind CSS** para a estilização.
- Design limpo e responsivo com animações simples ao virar as cartas.

# Deploy no GitHub Pages (Muito Importante)
Eu preciso que você me explique **passo a passo** como hospedar esse projeto de graça no GitHub Pages. 
Certifique-se de incluir na sua resposta:
- Como configurar o `vite.config.js` (a propriedade `base`) corretamente para rodar no GitHub Pages.
- O passo a passo de como fazer o build e enviar (deploy) para o ar (pode sugerir o uso do pacote npm `gh-pages` ou uma Action do GitHub, o que for mais fácil para um iniciante).

# Entregáveis
1. O comando para iniciar o projeto (ex: `npm create vite@latest...`).
2. O código completo dos componentes (App, Room, Lobby).
3. A lógica de integração com o `peerjs`.
4. O tutorial completo e detalhado de deploy no GitHub Pages solicitado acima.