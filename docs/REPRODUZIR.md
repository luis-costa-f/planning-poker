# 🧭 Reproduzir o projeto (roteiro completo)

Lista de ponta a ponta para ter a **sua** cópia do Planning Poker no ar. Cada passo aponta para o
guia detalhado quando houver um.

## O que você vai usar

| Ferramenta | Para quê | Custo |
| --- | --- | --- |
| [Node.js](https://nodejs.org) 20+ | rodar e compilar o projeto | grátis |
| [Git](https://git-scm.com) | versionar e enviar o código | grátis |
| Conta no [GitHub](https://github.com) | repositório, GitHub Actions e GitHub Pages (hospedagem) | grátis (repositório público) |
| Servidor público do [PeerJS](https://peerjs.com) | apresentar os navegadores (WebRTC) | grátis, sem conta |
| Conta no [Supabase](https://supabase.com) (opcional) | estatísticas anônimas das rodadas | grátis |

Tecnologias do código: React 19, Vite 6, Tailwind CSS 4, PeerJS e Web Crypto. Detalhes no
[README](../README.md#stack).

## 1. Prepare o computador

```bash
node -v   # precisa ser v20 ou maior
git -v
```

Se algum comando não existir, instale pelo link da tabela acima e abra um terminal novo.
Na primeira vez com o Git, configure seu nome e e-mail:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "voce@exemplo.com"
```

## 2. Pegue o código

```bash
git clone https://github.com/luis-costa-f/planning-poker.git
cd planning-poker
npm install
```

> Também dá para usar o botão **Fork** no GitHub e clonar o seu fork. Nesse caso, pule o
> `git remote set-url` do passo 5.

## 3. Personalize

Três ajustes para a sua cópia não se misturar com a original:

1. **Prefixo do PeerJS:** em `src/lib/poker.js`, troque `PEER_PREFIX = 'ppoker-br-'` por algo seu,
   como `'ppoker-fulano-'`. Com o mesmo prefixo, as duas cópias dividem códigos de sala e o contador.
2. **Nome do repositório:** se não for `planning-poker`, ajuste o `base` em `vite.config.js`
   ([DEPLOY.md, passo 1](DEPLOY.md#passo-1--ajuste-o-base-no-viteconfigjs)).
3. **README:** troque o link `https://<seu-usuario>.github.io/planning-poker/` pelo seu.

## 4. Teste localmente

```bash
npm run dev
```

Abra `http://localhost:5173/planning-poker/`, crie uma sala e, numa janela anônima, entre com outro
nome. Votem e cliquem em **Revelar Cartas**. Pare o servidor com `Ctrl+C`.

## 5. Publique no GitHub Pages

1. Crie um repositório **público** vazio em <https://github.com/new> (sem README).
2. Aponte o projeto para ele e envie:

   ```bash
   git remote set-url origin https://github.com/<seu-usuario>/planning-poker.git
   git add .
   git commit -m "chore: personalizar minha cópia"
   git push -u origin main
   ```

3. **Settings → Pages → Source: GitHub Actions**.
4. Aba **Actions**: espere o workflow ficar verde.

📖 Detalhes e problemas comuns: [DEPLOY.md](DEPLOY.md)

## 6. Gere o seu link de admin

O `src/lib/adminKeys.js` que veio no clone tem as chaves do dono original. Gere as suas:

```bash
node scripts/gerar-chave-admin.mjs https://<seu-usuario>.github.io/planning-poker/ > .admin-link.txt
git add src/lib/adminKeys.js
git commit -m "chore: chaves do painel de admin"
git push
```

Depois do deploy, abra o link de `.admin-link.txt` e guarde-o num lugar seguro. Se ele vazar, rode o
script de novo.

## 7. Estatísticas (opcional)

Crie o projeto no Supabase, rode o `supabase/schema.sql` e cadastre `SUPABASE_URL` e
`SUPABASE_KEY` em **Settings → Secrets and variables → Actions → Variables**.

> ⚠️ Use só a chave **publishable** (`sb_publishable_...`) ou a `anon`. Nunca a `sb_secret_...`.

📖 Passo a passo: [SUPABASE.md](SUPABASE.md)

## 8. Confira tudo no site publicado

- [ ] O site abre em `https://<seu-usuario>.github.io/planning-poker/`.
- [ ] Duas pessoas (ou duas janelas) entram na mesma sala, votam e veem a revelação.
- [ ] O Lobby mostra o contador de salas abertas.
- [ ] O link de admin abre o painel e lista a sala aberta.
- [ ] Com o Supabase: depois de revelar, aparece uma linha em **Table Editor → rounds** e a aba
      **Estatísticas** mostra os números.

## Onde pedir ajuda

| Problema | Onde olhar |
| --- | --- |
| Página em branco, build ou deploy falhando | [DEPLOY.md → Problemas comuns](DEPLOY.md#problemas-comuns) |
| Estatísticas não aparecem | [SUPABASE.md](SUPABASE.md) e a tabela de problemas do DEPLOY.md |
| Entender como o jogo funciona por dentro | [README → Como funciona](../README.md#como-funciona) |
| Recriar o projeto do zero com uma IA | [prompt.md](../prompt.md) (especificação completa) |
