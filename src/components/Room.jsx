import { useMemo, useState } from 'react'
import { DECK, computeStats } from '../lib/poker'

export default function Room({ poker }) {
  const { roomCode, isHost, myId, myVote, game, vote, reveal, newRound, leave } = poker
  const { participants, revealed } = game

  const votedCount = participants.filter((p) => p.hasVoted).length
  const stats = useMemo(() => (revealed ? computeStats(participants) : null), [revealed, participants])

  // Divide os participantes entre o lado de cima e o de baixo da mesa
  const half = Math.ceil(participants.length / 2)
  const top = participants.slice(0, half)
  const bottom = participants.slice(half)

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader roomCode={roomCode} isHost={isHost} onLeave={leave} />

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <SeatRow participants={top} revealed={revealed} myId={myId} />

        <div className="flex h-30 w-full max-w-sm items-center justify-center rounded-3xl bg-slate-800/80 px-6 text-center">
          <TableCenter
            revealed={revealed}
            stats={stats}
            isHost={isHost}
            votedCount={votedCount}
            onReveal={reveal}
          />
        </div>

        <SeatRow participants={bottom} revealed={revealed} myId={myId} />
      </main>

      <footer className="mx-auto w-full max-w-4xl px-4 pb-6">
        {revealed && stats ? (
          <Results stats={stats} isHost={isHost} onNewRound={newRound} />
        ) : (
          <Deck myVote={myVote} onVote={vote} />
        )}
      </footer>
    </div>
  )
}

function RoomHeader({ roomCode, isHost, onLeave }) {
  const [copied, setCopied] = useState('')

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* clipboard bloqueado: o usuário pode copiar manualmente */
    }
  }

  const shareLink = `${window.location.origin}${window.location.pathname}?sala=${roomCode}`

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🃏</span>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">ID da Sala</p>
          <p className="font-mono text-xl font-bold tracking-[0.2em] text-white">{roomCode}</p>
        </div>
        {isHost && (
          <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-xs font-semibold text-blue-300">Host</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <HeaderButton onClick={() => copy(roomCode, 'code')}>
          {copied === 'code' ? 'Copiado!' : 'Copiar código'}
        </HeaderButton>
        <HeaderButton onClick={() => copy(shareLink, 'link')}>
          {copied === 'link' ? 'Copiado!' : 'Convidar'}
        </HeaderButton>
        <HeaderButton
          danger
          onClick={() => {
            if (!isHost || confirm('Sair vai encerrar a sala para todos. Continuar?')) onLeave()
          }}
        >
          Sair
        </HeaderButton>
      </div>
    </header>
  )
}

function HeaderButton({ danger, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        danger
          ? 'border-rose-400/30 text-rose-300 hover:bg-rose-500/10'
          : 'border-blue-400/40 text-blue-300 hover:bg-blue-400/10'
      }`}
    />
  )
}

function SeatRow({ participants, revealed, myId }) {
  if (!participants.length) return <div className="h-24" />
  return (
    <div className="flex flex-wrap justify-center gap-x-14 gap-y-6">
      {participants.map((p) => (
        <Seat key={p.id} participant={p} revealed={revealed} isMe={p.id === myId} />
      ))}
    </div>
  )
}

// Carta de cada participante na mesa, com animação de virar
function Seat({ participant, revealed, isMe }) {
  const { name, hasVoted, vote, isHost } = participant
  const flipped = revealed && hasVoted

  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <div className="card-scene h-17 w-10">
        <div className={`card-inner ${flipped ? 'is-flipped' : ''}`}>
          {/* Verso: vazio (ainda votando) ou preenchido (já votou) */}
          <div
            className={`card-face rounded-lg border-2 transition-colors duration-300 ${
              hasVoted ? 'card-back-pattern border-blue-400 bg-blue-400' : 'border-slate-600 bg-slate-800/60'
            }`}
          />
          {/* Frente: valor revelado */}
          <div className="card-face card-face-front flex items-center justify-center rounded-lg border-2 border-blue-400 text-lg font-bold text-blue-400">
            {vote ?? ''}
          </div>
        </div>
      </div>
      <span className={`max-w-full truncate text-sm font-semibold ${isMe ? 'text-blue-300' : 'text-white'}`}>
        {isHost && '👑 '}
        {name}
      </span>
      {!revealed && (
        <span className={`-mt-1.5 text-xs ${hasVoted ? 'text-blue-300' : 'animate-pulse text-slate-500'}`}>
          {hasVoted ? 'Votou!' : 'Votando...'}
        </span>
      )}
    </div>
  )
}

function TableCenter({ revealed, stats, isHost, votedCount, onReveal }) {
  if (revealed && stats) {
    return <span className="text-5xl font-bold text-white">{stats.mode ?? stats.average ?? '—'}</span>
  }
  if (isHost && votedCount > 0) {
    return (
      <button
        onClick={onReveal}
        className="rounded-lg bg-blue-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-blue-500/20 transition hover:bg-blue-300"
      >
        Revelar Cartas
      </button>
    )
  }
  return (
    <span className="text-slate-300">
      {votedCount === 0 ? 'Escolham suas cartas!' : 'Aguardando o Host revelar...'}
    </span>
  )
}

function Deck({ myVote, onVote }) {
  return (
    <section>
      <p className="mb-4 text-center text-sm text-slate-300">
        {myVote ? 'Clique de novo na carta para desmarcar' : 'Escolha sua carta 👇'}
      </p>
      <div className="flex gap-1.5 overflow-x-auto px-1 pt-3 pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
        {DECK.map((value) => {
          const selected = myVote === value
          return (
            <button
              key={value}
              onClick={() => onVote(value)}
              aria-pressed={selected}
              className={`flex h-18 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-blue-400 text-lg font-bold transition-all duration-200 ${
                selected
                  ? '-translate-y-2 bg-blue-400 text-slate-950'
                  : 'text-blue-400 hover:-translate-y-1 hover:bg-blue-400/10'
              }`}
            >
              {value}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Results({ stats, isHost, onNewRound }) {
  const max = Math.max(...stats.distribution.map(([, c]) => c), 1)
  const pct = Math.round(stats.agreement * 100)

  return (
    <section className="flex flex-col items-center">
      <div className="flex flex-wrap items-end justify-center gap-10 pb-4">
        {/* Gráfico de barras com a distribuição dos votos */}
        <div className="flex items-end gap-2">
          {stats.distribution.map(([value, count], i) => (
            <div key={value} className="flex w-10 flex-col items-center gap-1">
              <span className="text-sm text-slate-400">{count}</span>
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${i === 0 ? 'bg-blue-400' : 'bg-blue-100'}`}
                style={{ height: `${Math.max(14, (count / max) * 54)}px` }}
              />
              <span className="text-sm font-bold text-white">{value}</span>
            </div>
          ))}
        </div>

        <AgreementRing percent={pct} consensus={stats.consensus} />

        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-white">{stats.average ?? '—'}</span>
          <span className="text-sm font-semibold text-slate-200">Média</span>
        </div>
      </div>

      <div className="w-full border-t border-slate-700 pt-3 text-center">
        {isHost ? (
          <button
            onClick={onNewRound}
            className="inline-flex items-center gap-2 rounded-md bg-blue-400 px-10 py-2.5 font-semibold text-slate-950 transition hover:bg-blue-300"
          >
            <span className="text-lg leading-none">↻</span> Votar novamente
          </button>
        ) : (
          <p className="py-2 text-sm text-slate-400">Aguardando o Host iniciar uma nova rodada...</p>
        )}
      </div>
    </section>
  )
}

// Anel de concordância: % de pessoas que votaram no valor mais escolhido
function AgreementRing({ percent, consensus }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-12">
        <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-slate-700" />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-blue-400 transition-all duration-700"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {consensus ? '🎉' : `${percent}%`}
        </span>
      </div>
      <span className="text-sm font-semibold text-slate-200">Concordância</span>
    </div>
  )
}
