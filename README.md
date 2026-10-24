# 🃏 Planning Poker P2P

Planning Poker em tempo real, direto no navegador. **Sem cadastro e sem backend.**
Os participantes se conectam peer-to-peer via WebRTC; quando a sala fecha, tudo some.

**▶️ Acesse:** https://&lt;seu-usuario&gt;.github.io/planning-poker/

## Funcionalidades

- **Criar sala** com um código curto (ex.: `HW83P2`) ou **entrar** pelo código / link de convite
- Lista de participantes com status **Votando...** / **Votou!**
- Baralho Fibonacci: `0 ½ 1 2 3 5 8 13 21 34 55 89 ? ☕`
- Votos **ocultos** até o Host revelar (inclusive na rede: os valores só são enviados após a revelação)
- Animação de virar as cartas, valor mais votado, gráfico de distribuição, % de concordância e média
- Controles do Host: **Revelar Cartas** e **Votar novamente**
- Layout responsivo (desktop e celular)
- **Contador de salas abertas** no Lobby (sem servidor: ver abaixo)
- Salas se fecham sozinhas: ao fechar a aba do Host ou após **60 min sem atividade**
- **Painel do admin** por link mágico: ver todas as salas abertas e encerrá-las
- **Estatísticas anônimas** (opcional, via Supabase): média, cartas mais/menos votadas e abstenções, por sala e no geral

## Como funciona

```
Convidado A ─┐
Convidado B ─┼──► HOST (estado do jogo só em memória)
Convidado C ─┘
```

Quem cria a sala vira o **Host** e registra o ID `ppoker-br-<CÓDIGO>` no servidor de sinalização
público e gratuito do [PeerJS](https://peerjs.com). Esse servidor apenas apresenta os navegadores; os
dados da votação trafegam direto entre eles. O Host é a fonte da verdade: recebe os votos e envia a
todos o estado atualizado.

> ⚠️ Se o Host fechar ou recarregar a aba, a sala é encerrada para todos.

### Contador de salas (sem servidor)

O primeiro Host a abrir uma sala também ocupa um ID fixo no PeerJS e vira o **contador**. Os outros
Hosts informam a ele quantas pessoas têm; o Lobby lê o total dele. Se a aba do contador fechar, os
Hosts restantes disputam o ID e um deles assume (o servidor do PeerJS garante que só um vence).
Sem nenhuma sala aberta, o ID não existe e o Lobby mostra "Nenhuma sala aberta agora".

### Fechamento das salas

Nada fica ocupando espaço: a sala só existe na memória da aba do Host.

- Ao fechar a aba (`pagehide`), o Host destrói as conexões na hora: o ID é liberado e os convidados voltam ao Lobby.
- Sem nenhuma atividade (entrada, voto, revelação...) por 60 minutos, a sala se encerra sozinha.
- O contador descarta salas que pararem de dar sinal de vida por 2,5 minutos.
- O admin pode encerrar qualquer sala pelo painel.

## Painel do admin (link mágico)

Um link secreto só para o dono do site, para ver todas as salas abertas (código, participantes,
rodada, tempo aberta, última atividade) e encerrar uma ou todas.

Como o site é estático, não dá para esconder uma senha no código. Por isso o link usa **criptografia
de chave pública** (Web Crypto, curva P-256):

- As chaves **públicas** ficam no código (`src/lib/adminKeys.js`); as **privadas** ficam só no link,
  depois do `#` (o fragmento nunca é enviado ao GitHub nem a nenhum servidor).
- Cada Host **criptografa** os dados da sala para o admin (ECDH + AES-GCM). O contador só repassa e
  não consegue ler.
- Comandos de encerrar vão **assinados** (ECDSA); antes de obedecer, cada Host confere a assinatura,
  se o comando é para a sua sala e se tem menos de 2 minutos.

**Gerar (ou trocar) o link:**

```bash
node scripts/gerar-chave-admin.mjs https://<seu-usuario>.github.io/<nome-do-repositorio>/ > .admin-link.txt
```

O script atualiza `src/lib/adminKeys.js` e grava o link mágico (`.../planning-poker/#admin=...`) em
`.admin-link.txt`, que está no `.gitignore`. Sem a URL, ele usa `https://luis-costa-f.github.io/planning-poker/`
(o site original): numa cópia, passe sempre a sua. Faça commit e push do `adminKeys.js` e guarde o link nos
favoritos. Se o link vazar, rode o script de novo: o antigo para de funcionar quando o deploy terminar.

## Estatísticas (Supabase, opcional)

Ao revelar as cartas, o Host grava uma linha no [Supabase](https://supabase.com) com os valores das
cartas e quantas pessoas não votaram. Sem nomes e sem o código da sala. A chave pública só consegue
inserir; a leitura é pela função `get_stats()`, que devolve só números agregados. O painel do admin
ganha a aba **Estatísticas**: média, carta mais/menos votada e abstenções (não votou, `?` ou `☕`),
por sala e no geral.

Sem as variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` no build, nada é gravado.

📖 Configuração passo a passo: [docs/SUPABASE.md](docs/SUPABASE.md) (SQL pronto em `supabase/schema.sql`).

## Stack

[React 19](https://react.dev) · [Vite 6](https://vite.dev) · [Tailwind CSS 4](https://tailwindcss.com) · [PeerJS](https://peerjs.com) · GitHub Pages · [Supabase](https://supabase.com) (opcional)

## Quer a sua própria cópia?

📖 Roteiro completo, do zero ao site publicado: [docs/REPRODUZIR.md](docs/REPRODUZIR.md)

## Rodando localmente

Requer [Node.js](https://nodejs.org) 20+ (confira com `node -v`) e [Git](https://git-scm.com).

```bash
npm install
npm run dev
```

Abra `http://localhost:5173/planning-poker/`. Para testar sozinho, abra uma segunda janela anônima
e entre na sala com outro nome.

| Comando           | Descrição                         |
| ----------------- | --------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento       |
| `npm run build`   | Build de produção em `dist/`      |
| `npm run preview` | Serve o build localmente          |

## Estrutura

```
src/
├── App.jsx                     # Lobby/Room, ou AdminPanel se a URL tiver #admin=
├── components/
│   ├── Lobby.jsx               # nome, criar sala, entrar em sala, contador de salas
│   ├── Room.jsx                # mesa, cartas, resultados, controles do Host
│   ├── AdminPanel.jsx          # painel do link mágico (abas Salas abertas / Estatísticas)
│   └── AdminStats.jsx          # aba de estatísticas (lê o Supabase)
├── hooks/
│   ├── usePlanningPoker.js     # lógica PeerJS (Host e convidado), fechamento automático
│   └── useRoomCounter.js       # total de salas para o Lobby
├── lib/
│   ├── poker.js                # baralho, códigos de sala, estatísticas da rodada
│   ├── stats.js                # grava rodadas e lê estatísticas no Supabase
│   ├── registry.js             # contador de salas P2P (eleição, repasse para o admin)
│   ├── adminCrypto.js          # assinatura e criptografia do admin
│   └── adminKeys.js            # chaves públicas do admin (gerado pelo script)
└── index.css                   # Tailwind + animação 3D das cartas
scripts/gerar-chave-admin.mjs   # gera as chaves e o link mágico
supabase/schema.sql             # tabela, permissões e função get_stats()
```

## Deploy

Todo push na `main` publica automaticamente no GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Se o nome do repositório não for `planning-poker`, ajuste o
`base` em `vite.config.js`.

📖 Passo a passo completo para iniciantes: [docs/DEPLOY.md](docs/DEPLOY.md)

## Privacidade

- Nomes, códigos de sala e votos identificáveis nunca são gravados em servidor, cookie ou `localStorage`.
- Com o Supabase ligado, ficam só estatísticas anônimas por rodada (cartas jogadas e quantos não votaram).
- O servidor de sinalização do PeerJS vê apenas IDs de conexão, nunca nomes ou votos.
- O contador de salas recebe em claro só números (salas e pessoas); os detalhes vão criptografados para o admin.
- Redes corporativas muito restritas podem bloquear WebRTC (seria necessário um servidor TURN).
