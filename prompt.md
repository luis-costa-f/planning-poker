# Contexto
Atue como um Desenvolvedor Front-end Sênior especialista em React e WebRTC. Preciso criar um aplicativo web de **Planning Poker** focado em simplicidade, privacidade e tempo real. Todo o texto da interface, comentários e documentação devem estar em **português do Brasil**.

# Requisitos Arquiteturais
- **Hospedagem:** GitHub Pages (100% estático, sem backend Node.js, Python etc.).
- **Sem Banco de Dados para o jogo:** nada de sessão, histórico, nomes ou usuários salvo em banco. O jogo é efêmero, em memória. **Não usar `localStorage`, cookies nem `sessionStorage`** (nem para lembrar o nome do usuário).
- **Única exceção:** estatísticas **anônimas** das rodadas no Supabase (opcional, ver seção própria), sem nomes e sem código de sala.
- **Conexão em Tempo Real:** pessoas diferentes entram na mesma "sala" para votar.
- **Solução técnica:** WebRTC com a biblioteca `peerjs`, usando o servidor de sinalização público e gratuito do PeerJS (`new Peer()` sem configuração extra). Topologia em **estrela**: quem cria a sala é o **Host** e é a única fonte da verdade do estado do jogo; os convidados se conectam a ele.

# Stack e versões
- Vite 6 + React 19 (JavaScript/JSX, sem TypeScript).
- Tailwind CSS 4 via plugin `@tailwindcss/vite` (sem `tailwind.config.js`; o CSS começa com `@import "tailwindcss";`).
- `peerjs` ^1.5.
- Supabase só via `fetch` na API REST (sem instalar `@supabase/supabase-js`).
- Comando de criação: `npm create vite@latest planning-poker -- --template react` e depois `npm install peerjs tailwindcss @tailwindcss/vite`.
- Nome do repositório no GitHub: `planning-poker` (usuário `luis-costa-f`). URL final: `https://luis-costa-f.github.io/planning-poker/`.

# Estrutura de arquivos
```
.github/workflows/deploy.yml    # deploy automático no GitHub Pages
docs/DEPLOY.md                  # tutorial de deploy passo a passo
src/
├── main.jsx
├── App.jsx                     # Lobby/Room conforme a conexão, ou AdminPanel se a URL tiver #admin=
├── index.css                   # Tailwind + CSS da animação 3D de virar carta
├── components/
│   ├── Lobby.jsx               # inclui o contador de salas abertas
│   ├── Room.jsx                # mesa, cartas, resultados, controles do Host
│   ├── AdminPanel.jsx          # painel do link mágico (abas Salas abertas / Estatísticas)
│   └── AdminStats.jsx          # aba de estatísticas (lê o Supabase)
├── hooks/
│   ├── usePlanningPoker.js     # toda a lógica PeerJS (Host e convidado) + fechamento automático
│   └── useRoomCounter.js       # total de salas para o Lobby
└── lib/
    ├── poker.js                # baralho, geração de código, estatísticas (funções puras)
    ├── registry.js             # contador de salas P2P, eleição, repasse para o admin
    ├── stats.js                # grava rodadas e lê estatísticas no Supabase
    ├── adminCrypto.js          # assinatura/criptografia do admin
    └── adminKeys.js            # chaves públicas do admin (gerado pelo script)
scripts/gerar-chave-admin.mjs   # gera chaves e link mágico
supabase/schema.sql             # tabela rounds, permissões (RLS) e função get_stats()
docs/SUPABASE.md                # tutorial de configuração do Supabase
.env.example                    # VITE_SUPABASE_URL e VITE_SUPABASE_KEY
index.html                      # lang="pt-BR", favicon 🃏 em SVG inline, título "Planning Poker P2P"
vite.config.js                  # base: '/planning-poker/'
.gitignore                      # node_modules, dist, *.local, .DS_Store, .admin-link.txt
README.md
```

# Lógica de rede (`usePlanningPoker`)
- **Código da sala:** 6 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem 0/O/1/I), gerado com `crypto.getRandomValues`. O ID real no PeerJS é `ppoker-br-<CÓDIGO>` (prefixo para evitar colisão com outros apps no servidor público). O usuário só vê e digita o código curto; a entrada é normalizada (maiúsculas, sem espaços/símbolos).
- **Host:** cria `new Peer(PREFIX + código)`. Se der erro `unavailable-id`, tenta outro código (até 3 vezes). Guarda o estado em `useRef`: `{ revealed, round, participants: Map<peerId, { name, vote, isHost }> }`. Em `disconnected` do servidor de sinalização, chama `peer.reconnect()` (as conexões P2P já abertas continuam).
- **Convidado:** cria `new Peer()` (ID aleatório), conecta em `PREFIX + código` com `{ reliable: true }`, envia `join` ao abrir. Timeout de 12 s para conectar.
- **Protocolo de mensagens:**
  - Convidado → Host: `{ type: 'join', name }` e `{ type: 'vote', value }` (`value: null` desmarca).
  - Host → todos: `{ type: 'state', state }`.
- **Privacidade dos votos:** o Host envia um **estado público** em que cada participante tem `{ id, name, isHost, hasVoted, vote }`, e `vote` só vem preenchido quando `revealed === true`. Ou seja, os valores nunca trafegam na rede antes da revelação (ninguém espia pelo DevTools).
- Host ignora votos depois de revelar. Nome limitado a 30 caracteres; valor do voto a 4.
- Quando a conexão de um convidado fecha, o Host o remove e retransmite o estado.
- Se a conexão com o Host cair, o convidado volta ao Lobby com a mensagem "O Host encerrou a sala ou a conexão caiu."
- Mensagens de erro amigáveis: `peer-unavailable` → "Sala não encontrada. Confira o código ou peça um novo ao Host."; erros de rede/servidor → falha de rede; `browser-incompatible` → navegador sem WebRTC.
- O hook expõe: `status` (`idle | connecting | connected`), `error`, `roomCode`, `isHost`, `myId`, `myVote`, `game`, `createRoom(name)`, `joinRoom(name, code)`, `vote(value)`, `reveal()`, `newRound()`, `leave()`.
- Criar os peers nos handlers (não em `useEffect`) para funcionar bem com `StrictMode`; destruir tudo no unmount.

# Contador de salas abertas (`lib/registry.js` + `hooks/useRoomCounter.js`)
Sem servidor próprio. Um dos Hosts vira o **contador**: o primeiro que conseguir registrar o ID fixo `ppoker-br-registry-v1` no PeerJS (num segundo objeto `Peer`, separado do da sala).
- `startRoomReporter({ getInfo, onAdminCommand })` roda em todo Host. Tenta `new Peer(REGISTRY_ID)`; se der `unavailable-id`, entra como membro (`new Peer()` + `connect(REGISTRY_ID)`) e envia `{ type: 'room', participants, blob }` ao conectar, a cada mudança e a cada 25 s (heartbeat). Se a conexão com o contador cair, espera 0,3–1,8 s aleatórios e tenta virar o contador de novo (**eleição automática**; o servidor do PeerJS garante um só vencedor). Se o contador perder o servidor de sinalização (erros `network`, `server-error`, `socket-error`, `socket-closed`), larga o posto.
- O contador guarda `Map<peerId | 'self', { participants, blob, conn, lastSeen }>`, remove na hora quando a conexão fecha e, a cada 30 s, descarta entradas sem sinal há mais de 150 s (folga porque abas em segundo plano limitam timers a ~1x/min).
- `watchRegistry({ admin, onCount, onRooms })` é usado pelo Lobby e pelo painel admin: conecta ao contador e envia `{ type: 'watch' }` ou `{ type: 'admin-watch' }`; recebe `{ type: 'count', rooms, participants }` ou `{ type: 'admin-rooms', rooms: [{ key, blob }] }`. Se der `peer-unavailable`, não há sala aberta (mostra 0 e tenta de novo em 10 s). Se a conexão fechar, reconecta (novo contador). Para no `pagehide`. Retorna `{ stop, send }`.
- Em claro trafegam **só números**; nunca códigos de sala nem nomes.
- O Lobby mostra uma pílula abaixo do subtítulo: bolinha verde pulsando + "N salas abertas · M pessoas" (singular/plural certos), "Nenhuma sala aberta agora" (bolinha cinza) ou "Contando salas...".

# Fechamento automático das salas
- Host e convidado escutam `pagehide` e destroem os peers na hora (libera o ID no PeerJS e avisa os outros sem esperar timeout).
- O Host registra `lastActivity` a cada `broadcast` (entrada, saída, voto, revelação, nova rodada) e, checando a cada 60 s, encerra a sala após **60 min sem atividade** com a mensagem "A sala foi encerrada automaticamente após 60 minutos sem atividade.".

# Painel do admin (link mágico)
Link secreto só para o dono do site: `https://luis-costa-f.github.io/planning-poker/#admin=<dAssinatura>.<dCifra>`. Como o site é estático, usar **criptografia de chave pública** (Web Crypto, P-256), nunca senha no código.
- `scripts/gerar-chave-admin.mjs [url]` (Node, webcrypto de `node:crypto`): gera um par ECDSA e um par ECDH, grava as chaves **públicas** (`x`, `y`) em `src/lib/adminKeys.js` (`ADMIN_SIGN_PUBLIC`, `ADMIN_ENC_PUBLIC`) e imprime o link com os `d` privados. Uso: `node scripts/gerar-chave-admin.mjs > .admin-link.txt` (`.admin-link.txt` está no `.gitignore`). Rodar de novo invalida o link anterior.
- `lib/adminCrypto.js`:
  - `encryptForAdmin(data)` (Host): chave ECDH efêmera + chave pública do admin → AES-GCM 256; retorna `{ epk, iv, ct }` em base64url.
  - `verifyAdminCommand(cmd, sig, roomCode)` (Host): verifica ECDSA/SHA-256 com a chave pública; aceita só se `code` for o da própria sala e `ts` tiver menos de 2 min.
  - `loadAdminKeys(secret)`, `decryptAsAdmin(keys, blob)`, `signAdminCommand(keys, command)` (admin). `loadAdminKeys` faz uma prova real (assina/verifica e cifra/decifra) para detectar link inválido ou de chave antiga.
- O Host envia ao contador um `blob` cifrado com `{ code, createdAt, lastActivity, round, revealed, names, voted }`; só recifra quando algo muda. Sem Web Crypto, segue só com a contagem.
- Comando: o admin envia `{ type: 'admin-cmd', key, cmd, sig }` ao contador, que só repassa ao Host dono de `key` (ou trata localmente se `key === 'self'`). O Host verifica a assinatura e, se `action === 'close'`, volta ao Lobby com "A sala foi encerrada pelo administrador do site." (os convidados caem junto).
- `App.jsx`: se `location.hash` começar com `#admin=`, renderiza `AdminPanel` em vez do jogo.
- `AdminPanel.jsx`:
  - Cabeçalho "🛡️ Painel do admin" + botão "Ir para o app".
  - Números grandes "Salas abertas" e "Pessoas" e botão "Encerrar todas" (com confirmação).
  - Um card por sala (ordenado pela criação) com o código em fonte mono, "Aberta há X · última atividade há Y · rodada N · a/b votaram" (ou "cartas reveladas"), chips com os nomes (👑 no Host) e os botões "Entrar" (abre `?sala=CÓDIGO` em nova aba) e "Encerrar" (vira "Encerrando...").
  - Estados: "Validando link...", "Procurando salas...", "Nenhuma sala aberta agora." e erro de link inválido.
  - Rodapé: "Os dados das salas chegam criptografados e só este link consegue lê-los. Não compartilhe esta URL."
  - Tempos atualizados a cada 15 s.

# Estatísticas das rodadas (Supabase, opcional)
O GitHub Pages é estático, então não dá para gravar `.txt` nem banco no próprio site (e gravar no repositório exigiria expor um token). Usar o **Supabase** (Postgres grátis) chamado direto do navegador com a chave **pública** (publishable `sb_publishable_...` ou `anon` antiga; nunca a `service_role`).
- **Configuração:** variáveis de build `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` (local: `.env.local`; GitHub Actions: repository **Variables** `SUPABASE_URL` e `SUPABASE_KEY`, passadas no passo `npm run build` do `deploy.yml`). Sem elas, `statsEnabled = false` e nada é enviado.
- **Trava no build (`vite.config.js`):** como tudo que começa com `VITE_` vai para o JavaScript público, o build (e o `npm run dev`) falha com mensagem clara se `VITE_SUPABASE_KEY` for uma chave secreta (`sb_secret_...` ou JWT com `role: service_role`). Lido com `loadEnv`, que também pega as variáveis passadas pelo GitHub Actions.
- **`supabase/schema.sql`** (idempotente, colado no SQL Editor):
  - Tabela `rounds`: `id` identity, `room_id uuid`, `round`, `participants` (1..100), `votes text[]` (só cartas do baralho), `no_vote`, `created_at default now()`. Checks: pelo menos 1 voto, `cardinality(votes) + no_vote = participants`; `unique (room_id, round)`.
  - RLS ligado; `revoke all` de `anon`/`authenticated`; `anon` só tem `insert` nas colunas `room_id, round, participants, votes, no_vote` (não consegue forjar `created_at`) e uma policy de insert. Ninguém lê a tabela com a chave pública.
  - Função `get_stats()` (`security definer`, `search_path = ''`, executável por `anon`) que devolve JSON `{ overall: { rooms, rounds, seats, no_vote, average, question, coffee, distribution }, rooms: [{ first_at, last_at, rounds, seats, no_vote, question, coffee, average, distribution }] }` com as 100 salas mais recentes. `distribution` = pares `[carta, quantidade]` (desc). Média só com cartas numéricas (`½` = 0.5), arredondada a 1 casa. Não devolve `room_id`.
- **`lib/stats.js`** (`fetch` na REST API, header `apikey`; `Authorization: Bearer` só se a chave for JWT `eyJ...`):
  - `newRoomId()`: `crypto.randomUUID()` com fallback via `getRandomValues` (fora de https).
  - `recordRound({ roomId, round, participants })`: filtra votos que estão no `DECK`, ignora rodada sem votos, `POST /rest/v1/rounds` com `Prefer: return=minimal` e `keepalive`; erros são ignorados (o jogo nunca depende disso).
  - `fetchStats()`: `POST /rest/v1/rpc/get_stats`.
- **Privacidade:** nunca gravar nomes nem o código da sala (como `get_stats` é público, o código permitiria entrar em salas abertas). Cada sala ganha um `roomId` UUID em `roomInfoRef` ao ser criada.
- **Gravação:** no `reveal()` do Host (que agora ignora se já estiver revelado), depois do `broadcast()`, uma linha por rodada revelada com todos os participantes (Host incluso).
- **Abstenção** = não votou + `?` + `☕` (gravados separados: `no_vote`, e contagem de `?`/`☕` em `votes`). Taxa = abstenções ÷ `seats` (soma das pessoas presentes em cada rodada revelada).
- **Painel do admin:** abas "Salas abertas" / "Estatísticas" (`AdminStats.jsx`), visíveis depois de validar o link. A aba mostra: números grandes "Salas", "Rodadas reveladas", "Média geral", "Abstenções (N%)" e botão "↻ Atualizar"; card com "Mais votada" / "Menos votada" (só numéricas; empates juntos; sem "menos" se só um valor foi usado), detalhe "x não votaram · y “?” · z “☕”" e gráfico de barras com todas as cartas do baralho; tabela "Por sala (100 mais recentes)" com Aberta em, Rodadas, Média, Mais votada, Menos votada, Abstenções (com o detalhe no `title`). Estados: "Carregando estatísticas...", "Nenhuma rodada revelada ainda.", erro, e "Estatísticas desligadas" se faltarem as variáveis.
- O Lobby passa a dizer "Peer-to-peer e sem cadastro. Tudo some quando a sala fecha; só ficam estatísticas anônimas das cartas."

# Regras do jogo (`lib/poker.js`)
- Baralho: `0, ½, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕`.
- Clicar de novo na carta escolhida desmarca o voto.
- `computeStats(participants)` retorna:
  - `average`: média dos votos numéricos (`½` = 0.5; `?` e `☕` não entram), arredondada a 1 casa;
  - `distribution`: pares `[valor, quantidade]` ordenados pela quantidade (desc);
  - `mode`: valor mais votado (null se houver empate no topo);
  - `agreement`: fração dos votos no valor mais votado (0..1);
  - `consensus`: todos votaram igual (com mais de 1 voto).
- "Nova Rodada" / "Votar novamente": zera votos, `revealed = false`, `round += 1`.

# Interface (UI/UX)
Referência visual: `image.png` (estilo do planningpokeronline.com). Tema escuro azul-marinho, destaque em azul claro.
- **Cores:** fundo `#030617` (também no `<body>`), mesa `bg-slate-800/80`, destaque `blue-400` (hover `blue-300`), textos brancos/`slate`.
- **Lobby:** centralizado (máx. `max-w-md`), emoji 🃏, título "Planning Poker", subtítulo "Peer-to-peer e sem cadastro. Tudo some quando a sala fecha; só ficam estatísticas anônimas das cartas.". Card com: campo "Seu nome" (obrigatório, máx. 30), botão "Criar Nova Sala", separador "ou", campo "Código da sala" + botão "Entrar". Se a URL tiver `?sala=CÓDIGO`, o campo de código já vem preenchido. Spinner "Conectando..." e caixa de erro em vermelho.
- **Cabeçalho da sala:** "ID DA SALA" + código grande em fonte mono com espaçamento largo, selo "Host" para o Host; botões com contorno azul "Copiar código", "Convidar" (copia o link `origem + caminho + ?sala=CÓDIGO`; mostra "Copiado!" por 1,5 s) e "Sair" (vermelho; para o Host pede confirmação porque encerra a sala para todos).
- **Mesa:** participantes divididos em duas fileiras, metade **acima** e metade **abaixo** de uma mesa central retangular arredondada (`max-w-sm`, `rounded-3xl`).
  - Carta de cada participante: pequena (40×68 px), com o nome em negrito embaixo (👑 antes do nome do Host; o próprio usuário em azul). Antes da revelação, mostra embaixo "Votando..." (cinza, pulsando) ou "Votou!" (azul).
  - Verso da carta: vazia com borda cinza se ainda não votou; **preenchida de azul com listras diagonais** se já votou.
  - Ao revelar, a carta **vira em 3D** (perspective + `rotateY(180deg)` + `backface-visibility: hidden`, transição 0,6 s) mostrando o valor em azul com contorno azul.
  - Centro da mesa: antes de revelar, para o Host aparece o botão "Revelar Cartas" (quando há pelo menos um voto); senão o texto "Escolham suas cartas!" / "Aguardando o Host revelar...". Depois de revelar, mostra o **valor mais votado** em fonte grande (ou a média, se houver empate).
- **Rodapé antes da revelação (baralho):** texto "Escolha sua carta 👇" (ou "Clique de novo na carta para desmarcar"), cartas 44×72 px com contorno azul e número azul numa única linha; a selecionada fica preenchida de azul e levantada; hover levanta um pouco. No celular a linha rola na horizontal.
- **Rodapé depois da revelação (resultados):** em linha, centralizados:
  - gráfico de barras da distribuição (quantidade em cima, valor embaixo; a barra mais votada em `blue-400`, as outras em `blue-100`);
  - anel SVG de **Concordância** com a % (🎉 se houver consenso);
  - **Média** em número grande.
  - Abaixo, uma linha divisória e o botão "↻ Votar novamente" (só o Host); convidados veem "Aguardando o Host iniciar uma nova rodada...".
- Responsivo, com rodapé limitado a `max-w-4xl`.

# Deploy no GitHub Pages
- `vite.config.js` com `base: '/planning-poker/'` e comentário explicando que precisa ser `/<nome-do-repositorio>/`.
- Deploy via **GitHub Actions** (`.github/workflows/deploy.yml`): dispara em push na `main` e manualmente (`workflow_dispatch`); permissões `contents: read`, `pages: write`, `id-token: write`; job `build` (checkout@v4, setup-node@v4 com Node 22 e cache npm, `npm ci`, `npm run build`, upload-pages-artifact@v3 da pasta `dist`) e job `deploy` (deploy-pages@v4, environment `github-pages`).
- No GitHub: **Settings → Pages → Source: GitHub Actions** (sem isso o job `deploy` falha, mesmo com o build ok).
- O `package-lock.json` precisa estar commitado (o `npm ci` depende dele).

# Entregáveis
1. Comando para iniciar o projeto.
2. Código completo de todos os arquivos listados na estrutura.
3. **`README.md`** voltado ao repositório: descrição, link do site, funcionalidades, como funciona (diagrama da estrela), stack, como rodar localmente (tabela de scripts), estrutura, resumo do deploy apontando para `docs/DEPLOY.md`, seção de privacidade e o aviso de que a sala acaba se o Host fechar a aba.
4. **`docs/SUPABASE.md`**: tutorial para iniciantes: criar o projeto (região São Paulo), rodar `supabase/schema.sql` no SQL Editor, pegar Project URL e publishable/anon key (alerta para nunca usar a `service_role`), cadastrar as Variables no GitHub e rodar o deploy de novo, `.env.local`, como testar (Table Editor, aba Estatísticas, `curl` no `rpc/get_stats`), definições de média/abstenção, consultas úteis e avisos (projeto pausado após 1 semana parado; dados falsos possíveis com chave pública).
5. **`docs/DEPLOY.md`**: tutorial detalhado para iniciantes: explicação do `base` (com tabela de exemplos, incluindo o caso `usuario.github.io` → `'/'`), criação do repositório público, comandos git, ativação do Pages com Actions, acompanhamento na aba Actions, explicação do workflow, alternativa com o pacote `gh-pages` (`"deploy": "vite build && gh-pages -d dist"`) e tabela de problemas comuns (página em branco/404, falha no `npm ci`, falha no deploy por permissão, sala não encontrada, redes corporativas bloqueando WebRTC/TURN).
6. Sugestão de mensagem de commit (Conventional Commits, em português).

# Validação
Fazer `npm run build` e testar de verdade com vários navegadores (ex.: Playwright com o Chrome instalado, em modo headless, contra `npm run preview`): 1 Host + 4 convidados entram pelo link `?sala=`, votam, conferem que o voto do Host não aparece para os convidados antes da revelação, o Host revela, tira screenshot comparando com `image.png` e inicia nova rodada.

Testar também:
- O Lobby mostra "Nenhuma sala aberta agora".
- Com 3 Hosts (um deles com 2 convidados), o Lobby mostra "3 salas abertas · 5 pessoas" e o painel admin lista os 3 códigos.
- Ao fechar a aba do primeiro Host (o contador), os números caem para 2/4 depois da eleição.
- "Encerrar" no painel derruba o Host e os convidados.
- O link `#admin=abc.def` é rejeitado.
- Um comando assinado por outra chave, alterado, destinado a outra sala ou com mais de 2 min é recusado.
- O `supabase/schema.sql` roda duas vezes seguidas sem erro (ex.: PGlite com papéis `anon`/`authenticated` criados à mão) e, como `anon`: insere rodadas válidas; é recusado ao ler a tabela, com carta fora do baralho, soma errada, rodada sem votos, rodada repetida e `created_at` forjado; `get_stats()` devolve médias e contagens que batem com a conta manual.
