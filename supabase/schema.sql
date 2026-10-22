-- Estatísticas anônimas das rodadas do Planning Poker.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo quantas vezes quiser (não apaga os dados já gravados).
--
-- Segurança:
-- - A chave pública do site (anon/publishable) só consegue INSERIR rodadas, nunca ler a tabela.
-- - A leitura é só pela função get_stats(), que devolve números agregados (sem IDs de sala).
-- - Não gravamos nomes nem o código da sala: cada sala recebe um UUID aleatório só para estatística.

create table if not exists public.rounds (
  id           bigint generated always as identity primary key,
  room_id      uuid   not null,
  round        int    not null check (round between 1 and 100000),
  participants int    not null check (participants between 1 and 100),
  votes        text[] not null check (votes <@ array['0','½','1','2','3','5','8','13','21','34','55','89','?','☕']),
  no_vote      int    not null check (no_vote >= 0),
  created_at   timestamptz not null default now(),
  -- votos + quem não votou = pessoas na sala; pelo menos um voto por rodada
  check (cardinality(votes) between 1 and participants and cardinality(votes) + no_vote = participants),
  unique (room_id, round)
);

alter table public.rounds enable row level security;

-- O site só pode inserir estas colunas (created_at vem do servidor, não dá para falsificar a data)
revoke all on public.rounds from anon, authenticated;
grant insert (room_id, round, participants, votes, no_vote) on public.rounds to anon;

drop policy if exists "site grava rodadas" on public.rounds;
create policy "site grava rodadas" on public.rounds for insert to anon with check (true);

-- Estatísticas gerais e das 100 salas mais recentes, prontas para o painel do admin
create or replace function public.get_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select r.room_id, t.vote,
           case t.vote when '½' then 0.5 when '?' then null when '☕' then null else t.vote::numeric end as num
    from public.rounds r, unnest(r.votes) as t(vote)
  ),
  room_rounds as (
    select room_id, count(*) as rounds, sum(participants) as seats, sum(no_vote) as no_vote,
           min(created_at) as first_at, max(created_at) as last_at
    from public.rounds
    group by room_id
  ),
  room_votes as (
    select room_id, round(avg(num), 1) as average,
           count(*) filter (where vote = '?') as question,
           count(*) filter (where vote = '☕') as coffee
    from v
    group by room_id
  ),
  room_dist as (
    select room_id, json_agg(json_build_array(vote, n) order by n desc, vote) as distribution
    from (select room_id, vote, count(*) as n from v group by room_id, vote) d
    group by room_id
  ),
  recent as (
    select rr.*, rv.average, rv.question, rv.coffee, rd.distribution
    from room_rounds rr
    join room_votes rv using (room_id)
    join room_dist rd using (room_id)
    order by rr.last_at desc
    limit 100
  )
  select json_build_object(
    'overall', json_build_object(
      'rooms',    (select count(*) from room_rounds),
      'rounds',   (select coalesce(sum(rounds), 0) from room_rounds),
      'seats',    (select coalesce(sum(seats), 0) from room_rounds),
      'no_vote',  (select coalesce(sum(no_vote), 0) from room_rounds),
      'average',  (select round(avg(num), 1) from v),
      'question', (select count(*) from v where vote = '?'),
      'coffee',   (select count(*) from v where vote = '☕'),
      'distribution', (
        select coalesce(json_agg(json_build_array(vote, n) order by n desc, vote), '[]'::json)
        from (select vote, count(*) as n from v group by vote) d
      )
    ),
    'rooms', (
      select coalesce(json_agg(json_build_object(
        'first_at', first_at, 'last_at', last_at, 'rounds', rounds, 'seats', seats,
        'no_vote', no_vote, 'question', question, 'coffee', coffee,
        'average', average, 'distribution', distribution
      ) order by last_at desc), '[]'::json)
      from recent
    )
  )
$$;

revoke execute on function public.get_stats() from public;
grant execute on function public.get_stats() to anon, authenticated;
