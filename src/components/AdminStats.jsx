import { useCallback, useEffect, useState } from 'react'
import { DECK } from '../lib/poker'
import { fetchStats, statsEnabled } from '../lib/stats'

const NUMERIC = new Set(DECK.filter((c) => c !== '?' && c !== '☕'))

// Aba "Estatísticas" do painel do admin: dados gravados no Supabase a cada revelação
export default function AdminStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetchStats()
      .then(setStats, (err) => setError(`Não foi possível carregar as estatísticas. ${err.message}`))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (statsEnabled) load()
  }, [load])

  if (!statsEnabled) {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-6 text-slate-300">
        Estatísticas desligadas: o build não tem <code className="text-blue-300">VITE_SUPABASE_URL</code> e{' '}
        <code className="text-blue-300">VITE_SUPABASE_KEY</code>. Veja <code className="text-blue-300">docs/SUPABASE.md</code>.
      </p>
    )
  }

  if (error) return <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-300">{error}</p>

  if (!stats) {
    return (
      <p className="flex items-center gap-2 text-slate-300">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        Carregando estatísticas...
      </p>
    )
  }

  const { overall, rooms } = stats
  const overallAbst = abstentions(overall)
  const overallCards = extremes(overall.distribution)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-8">
          <Stat label="Salas" value={overall.rooms} />
          <Stat label="Rodadas reveladas" value={overall.rounds} />
          <Stat label="Média geral" value={overall.average ?? '—'} />
          <Stat label={`Abstenções (${pct(overallAbst.rate)})`} value={overallAbst.total} />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-blue-400/40 px-3 py-1.5 text-sm text-blue-300 transition hover:bg-blue-400/10 disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : '↻ Atualizar'}
        </button>
      </div>

      {overall.rounds === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-10 text-center text-slate-400">
          Nenhuma rodada revelada ainda.
        </p>
      ) : (
        <>
          <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-sm text-slate-300">
              Mais votada: <Cards values={overallCards.top} /> · Menos votada: <Cards values={overallCards.bottom} />
            </p>
            <p className="mt-1 text-xs text-slate-400">{abstentionDetail(overall)}</p>
            <Distribution distribution={overall.distribution} />
          </section>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Por sala (100 mais recentes)</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 font-medium">Aberta em</th>
                  <th className="px-4 py-3 font-medium">Rodadas</th>
                  <th className="px-4 py-3 font-medium">Média</th>
                  <th className="px-4 py-3 font-medium">Mais votada</th>
                  <th className="px-4 py-3 font-medium">Menos votada</th>
                  <th className="px-4 py-3 font-medium">Abstenções</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, i) => {
                  const cards = extremes(room.distribution)
                  const abst = abstentions(room)
                  return (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-slate-200">{formatDate(room.first_at)}</td>
                      <td className="px-4 py-3 text-slate-200">{room.rounds}</td>
                      <td className="px-4 py-3 font-semibold text-white">{room.average ?? '—'}</td>
                      <td className="px-4 py-3"><Cards values={cards.top} /></td>
                      <td className="px-4 py-3"><Cards values={cards.bottom} /></td>
                      <td className="px-4 py-3 text-slate-200" title={abstentionDetail(room)}>
                        {abst.total} <span className="text-slate-400">({pct(abst.rate)})</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-slate-500">
        Uma linha por rodada revelada, sem nomes nem código da sala. Abstenção = não votou, “?” ou “☕”.
      </p>
    </>
  )
}

function Distribution({ distribution }) {
  const counts = Object.fromEntries(distribution)
  const max = Math.max(1, ...distribution.map(([, n]) => n))
  return (
    <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-1">
      {DECK.map((card) => {
        const n = counts[card] || 0
        return (
          <div key={card} className="flex w-9 shrink-0 flex-col items-center gap-1">
            <span className="text-xs text-slate-300">{n}</span>
            <div className="w-full rounded-t bg-blue-400/80" style={{ height: `${Math.max(2, (n / max) * 96)}px`, opacity: n ? 1 : 0.2 }} />
            <span className="text-sm font-semibold text-blue-300">{card}</span>
          </div>
        )
      })}
    </div>
  )
}

function Cards({ values }) {
  if (!values.length) return <span className="text-slate-500">—</span>
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {values.map((v) => (
        <span key={v} className="rounded border border-blue-400/50 px-1.5 text-sm font-semibold text-blue-300">
          {v}
        </span>
      ))}
    </span>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}

// Cartas numéricas mais e menos escolhidas (empates aparecem juntos). Com um só valor usado, não há "menos".
function extremes(distribution) {
  const nums = distribution.filter(([v]) => NUMERIC.has(v))
  if (!nums.length) return { top: [], bottom: [] }
  const counts = nums.map(([, n]) => n)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const pick = (target) => nums.filter(([, n]) => n === target).map(([v]) => v)
  return { top: pick(max), bottom: nums.length > 1 && min !== max ? pick(min) : [] }
}

// seats = soma das pessoas presentes em cada rodada revelada
function abstentions({ no_vote, question, coffee, seats }) {
  const total = no_vote + question + coffee
  return { total, rate: seats ? total / seats : 0 }
}

function abstentionDetail({ no_vote, question, coffee }) {
  return `${no_vote} não votaram · ${question} “?” · ${coffee} “☕”`
}

const pct = (rate) => `${Math.round(rate * 100)}%`

const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
