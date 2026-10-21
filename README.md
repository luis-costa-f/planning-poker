# 🃏 Planning Poker P2P

Planning Poker em tempo real, direto no navegador. **Sem cadastro, sem backend, sem banco de dados.**
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

## Stack

[React 19](https://react.dev) · [Vite 6](https://vite.dev) · [Tailwind CSS 4](https://tailwindcss.com) · [PeerJS](https://peerjs.com) · GitHub Pages

## Rodando localmente

Requer Node.js 20+.

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
├── App.jsx                     # alterna entre Lobby e Room
├── components/
│   ├── Lobby.jsx               # nome, criar sala, entrar em sala
│   └── Room.jsx                # mesa, cartas, resultados, controles do Host
├── hooks/usePlanningPoker.js   # lógica PeerJS (Host e convidado)
├── lib/poker.js                # baralho, códigos de sala, estatísticas
└── index.css                   # Tailwind + animação 3D das cartas
```

## Deploy

Todo push na `main` publica automaticamente no GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Se o nome do repositório não for `planning-poker`, ajuste o
`base` em `vite.config.js`.

📖 Passo a passo completo para iniciantes: [docs/DEPLOY.md](docs/DEPLOY.md)

## Privacidade

- Nenhum dado é gravado em servidor, banco, cookie ou `localStorage`.
- O servidor de sinalização do PeerJS vê apenas IDs de conexão, nunca nomes ou votos.
- Redes corporativas muito restritas podem bloquear WebRTC (seria necessário um servidor TURN).
