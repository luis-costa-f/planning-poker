# 📊 Estatísticas no Supabase (passo a passo)

O GitHub Pages só serve arquivos estáticos: o site não consegue gravar nada no próprio servidor.
Para guardar as estatísticas usamos o [Supabase](https://supabase.com) (Postgres gratuito), chamado
direto do navegador.

**O que é gravado:** uma linha por rodada revelada, com os valores das cartas e quantas pessoas não
votaram. **Sem nomes e sem o código da sala** (cada sala recebe um ID aleatório só para isso).

**Quem pode o quê com a chave pública do site:**

| Ação | Permitido? |
| --- | --- |
| Inserir uma rodada (só cartas do baralho, contas batendo) | ✅ |
| Ler, alterar ou apagar a tabela | ❌ |
| Chamar `get_stats()` (só números agregados, para o painel do admin) | ✅ |

> Sem configurar nada disso o app funciona normalmente; só não grava estatísticas.

## Passo 1 — Crie o projeto

1. Entre em <https://supabase.com/dashboard> (dá para logar com o GitHub).
2. **New project**:
   - **Name:** `planning-poker`
   - **Database Password:** gere uma e guarde (não vai para o site; só serve para acessar o banco direto).
   - **Region:** `South America (São Paulo)`.
3. **Create new project** e espere 1–2 minutos até ele ficar pronto.

## Passo 2 — Crie a tabela e a função

1. No menu lateral, abra **SQL Editor** → **New query**.
2. Copie **todo** o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql), cole e clique em **Run**.
3. Se aparecer um aviso de "destructive operation" (por causa do `revoke`/`drop policy`), confirme.
   O script não apaga dados e pode ser rodado de novo sem problema.
4. Confira em **Table Editor** que a tabela `rounds` existe (vazia) e com o selo **RLS enabled**.

## Passo 3 — Pegue a URL e a chave pública

1. Clique em **Connect** (topo da página) ou vá em **Project Settings → API Keys**.
2. Anote:
   - **Project URL:** `https://<id-do-projeto>.supabase.co`
   - **Publishable key** (`sb_publishable_...`). Se o seu projeto só mostrar as chaves antigas,
     use a **`anon` `public`** (começa com `eyJ...`). O código aceita as duas.

> ⚠️ **Nunca** use a `secret` / `service_role`: ela ignora todas as permissões e ficaria
> visível para qualquer um no JavaScript do site.

## Passo 4 — Configure no GitHub (site publicado)

1. No repositório: **Settings → Secrets and variables → Actions → aba Variables → New repository variable**.
2. Crie duas variáveis:

   | Nome | Valor |
   | --- | --- |
   | `SUPABASE_URL` | a Project URL |
   | `SUPABASE_KEY` | a publishable (ou anon) key |

   (São **Variables**, não Secrets: a chave pública vai mesmo no JavaScript do site, então não há o que esconder.)
3. Rode o deploy de novo: aba **Actions → Deploy no GitHub Pages → Run workflow** (ou faça um push).

## Passo 5 — Configure no seu computador (opcional)

Copie `.env.example` para `.env.local` (já ignorado pelo git) e preencha:

```bash
VITE_SUPABASE_URL=https://<id-do-projeto>.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
```

Reinicie o `npm run dev`.

## Passo 6 — Teste

1. Abra o site, crie uma sala, vote e clique em **Revelar Cartas**.
2. No Supabase, **Table Editor → rounds**: deve aparecer uma linha.
3. Abra o link mágico do admin → aba **Estatísticas**.

Também dá para testar a função pelo terminal:

```bash
curl -X POST "https://<id-do-projeto>.supabase.co/rest/v1/rpc/get_stats" \
  -H "apikey: <sua-chave-publica>" -H "Content-Type: application/json" -d "{}"
```

## O que o painel mostra

- **Geral:** salas, rodadas reveladas, média geral, abstenções (com %), carta mais e menos votada e o gráfico de todas as cartas.
- **Por sala** (100 mais recentes): quando abriu, rodadas, média, carta mais/menos votada e abstenções.

Definições:
- **Média:** só cartas numéricas (`½` = 0,5; `?` e `☕` ficam de fora).
- **Abstenção:** quem estava na sala e não votou + quem jogou `?` + quem jogou `☕`. A % é sobre o
  total de "lugares" (soma das pessoas presentes em cada rodada revelada).
- **Mais/menos votada:** só cartas numéricas; empates aparecem juntos. Rodadas reveladas sem nenhum voto não são gravadas.

## Consultas úteis no SQL Editor

No SQL Editor você é o dono do banco, então pode ler a tabela à vontade:

```sql
-- Últimas rodadas
select * from rounds order by created_at desc limit 50;

-- Rodadas por dia
select created_at::date as dia, count(*) from rounds group by 1 order by 1 desc;

-- Apagar tudo e recomeçar
truncate rounds;
```

## Avisos

- **Projeto pausado:** no plano grátis o Supabase pausa projetos parados por uma semana. Enquanto
  estiver pausado, as rodadas simplesmente não são gravadas (o jogo não é afetado). Reative pelo
  dashboard em **Restore project**.
- **Dados falsos:** como a chave é pública, alguém poderia inserir rodadas inventadas chamando a
  API na mão. As regras do banco recusam cartas inválidas, contas que não batem, rodadas repetidas
  e datas forjadas, mas não dá para provar que a rodada aconteceu de verdade. Para um projeto
  pessoal, é aceitável.
