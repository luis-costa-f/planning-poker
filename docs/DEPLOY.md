# 🚀 Deploy no GitHub Pages (passo a passo)

Vamos usar uma **GitHub Action**: você só dá `git push` e o GitHub faz o build e publica sozinho.
O arquivo já está pronto em `.github/workflows/deploy.yml`.

## Passo 1 — Ajuste o `base` no `vite.config.js`

O GitHub Pages publica o site em uma **subpasta** com o nome do repositório:

```
https://<seu-usuario>.github.io/<nome-do-repositorio>/
```

Por padrão, o Vite gera os links dos arquivos como `/assets/index.js` (raiz do domínio), e o navegador
procuraria em `https://<seu-usuario>.github.io/assets/...` → **página em branco** e erro 404 no console.
A propriedade `base` diz ao Vite qual é essa subpasta:

```js
// vite.config.js
export default defineConfig({
  base: '/planning-poker/', // ← EXATAMENTE o nome do repositório, com barra no início e no fim
  plugins: [react(), tailwindcss()],
})
```

| Nome do repositório           | URL final                                  | `base`             |
| ----------------------------- | ------------------------------------------ | ------------------ |
| `planning-poker`              | `https://fulano.github.io/planning-poker/` | `'/planning-poker/'` |
| `poker-time`                  | `https://fulano.github.io/poker-time/`     | `'/poker-time/'`   |
| `fulano.github.io` (especial) | `https://fulano.github.io/`                | `'/'`              |

> O nome é sensível a maiúsculas/minúsculas: `Planning-Poker` ≠ `planning-poker`.

## Passo 2 — Crie o repositório no GitHub

1. Entre em <https://github.com/new>.
2. **Repository name:** `planning-poker` (o mesmo do `base`).
3. Deixe **Public** (GitHub Pages grátis exige repositório público em contas gratuitas).
4. **Não** marque "Add a README" (o projeto já tem um). Clique em **Create repository**.

## Passo 3 — Envie o código

No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Planning Poker P2P"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/planning-poker.git
git push -u origin main
```

> Confira se a pasta `.github/workflows/deploy.yml` foi junto (pastas que começam com ponto
> às vezes ficam ocultas no explorador de arquivos, mas o `git add .` inclui).

## Passo 4 — Ative o GitHub Pages com Actions

1. No repositório, vá em **Settings** → **Pages** (menu lateral).
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.

Pronto, não precisa escolher branch.

## Passo 5 — Acompanhe o deploy

1. Abra a aba **Actions** do repositório.
2. Você verá o workflow **"Deploy no GitHub Pages"** rodando (se ele rodou antes do Passo 4 e falhou,
   clique nele → **Re-run all jobs**).
3. Quando ficar verde ✅ (1–2 minutos), a URL aparece no job `deploy` e em **Settings → Pages**:
   `https://<seu-usuario>.github.io/planning-poker/`

A partir daqui, **todo `git push` na `main` publica automaticamente** a nova versão.

## Passo 6 (opcional) — Estatísticas

Para o painel do admin mostrar estatísticas das rodadas, crie um projeto no Supabase e cadastre as
variáveis `SUPABASE_URL` e `SUPABASE_KEY` em **Settings → Secrets and variables → Actions → Variables**.
Passo a passo: [SUPABASE.md](SUPABASE.md).

## O que o workflow faz

```yaml
on:
  push:
    branches: [main]      # roda a cada push na main
  workflow_dispatch:       # e também permite rodar manualmente pela aba Actions
jobs:
  build:                   # instala dependências (npm ci), roda npm run build
                           # e empacota a pasta dist/
  deploy:                  # publica o pacote no GitHub Pages
```

## Alternativa: pacote `gh-pages` (deploy manual pelo terminal)

Se preferir não usar Actions:

```bash
npm install --save-dev gh-pages
```

Adicione ao `package.json`, em `"scripts"`:

```json
"deploy": "vite build && gh-pages -d dist"
```

Depois rode `npm run deploy`. Isso cria/atualiza a branch `gh-pages`. Em **Settings → Pages**,
escolha **Source: Deploy from a branch**, branch `gh-pages`, pasta `/ (root)`.
(Nesse caso, apague o arquivo `.github/workflows/deploy.yml` para não ter dois deploys.)

## Problemas comuns

| Sintoma | Causa / solução |
| --- | --- |
| Página em branco, 404 em `/assets/...` | `base` errado no `vite.config.js`. Deve ser `'/<nome-do-repo>/'`. |
| Action falha em `npm ci` | Falta o `package-lock.json` no repositório. Rode `npm install` localmente e faça commit dele. |
| Action falha em "deploy" com erro de permissão/ambiente | **Settings → Pages → Source** não está em **GitHub Actions**. |
| Aba Estatísticas diz "Estatísticas desligadas" | Faltam as variáveis `SUPABASE_URL` / `SUPABASE_KEY` (aba **Variables**, não Secrets) ou o deploy não rodou depois de criá-las. |
| Estatísticas com erro 401/404 | Chave errada (use a publishable/anon) ou o `supabase/schema.sql` não foi executado. Projeto pausado também falha: reative no dashboard. |
| "Sala não encontrada" | Código errado, ou o Host fechou/recarregou a aba. |
| Fica em "Conectando..." em algumas redes corporativas | Firewalls que bloqueiam WebRTC. O PeerJS usa servidores STUN públicos; redes muito restritas precisariam de um servidor TURN (não incluso). |
