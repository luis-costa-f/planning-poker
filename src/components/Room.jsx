import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DECK, MAX_ROOM_NAME, THROW_EMOJIS, computeStats } from '../lib/poker'
import TeamCapacity from './TeamCapacity'

export default function Room({ poker }) {
  const { roomCode, isHost, myId, myVote, game, vote, reveal, newRound, leave, setRoomName } = poker
  const { setSpectating, throws, throwEmoji } = poker
  const { participants, revealed, roomName } = game
  const spectating = participants.find((p) => p.id === myId)?.spectator ?? false
  // Em quem a pessoa está mirando um emoji (abre o seletor em cima da carta)
  const [aimAt, setAimAt] = useState(null)
  const seatProps = { revealed, myId, aimAt, onAim: setAimAt, onThrow: throwEmoji }

  const votedCount = participants.filter((p) => p.hasVoted).length
  const stats = useMemo(() => (revealed ? computeStats(participants) : null), [revealed, participants])

  // Divide os participantes entre o lado de cima e o de baixo da mesa
  const half = Math.ceil(participants.length / 2)
  const top = participants.slice(0, half)
  const bottom = participants.slice(half)

  return (
    <div className="flex min-h-screen flex-col">
      <RoomHeader roomCode={roomCode} roomName={roomName} isHost={isHost} onRename={setRoomName} onLeave={leave} />

      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
            <SeatRow participants={top} {...seatProps} />

            <div className="flex h-30 w-full max-w-sm items-center justify-center rounded-3xl bg-slate-800/80 px-6 text-center">
              <TableCenter
                revealed={revealed}
                stats={stats}
                isHost={isHost}
                votedCount={votedCount}
                onReveal={reveal}
              />
            </div>

            <SeatRow participants={bottom} {...seatProps} />
          </main>

          <footer className="mx-auto w-full max-w-4xl px-4 pb-6">
            {revealed && stats ? (
              <Results stats={stats} isHost={isHost} onNewRound={newRound} />
            ) : spectating ? (
              <SpectatorNotice onVote={() => setSpectating(false)} />
            ) : (
              <>
                <Deck myVote={myVote} onVote={vote} />
                {isHost && (
                  <p className="mt-3 text-center">
                    <button
                      onClick={() => setSpectating(true)}
                      className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                    >
                      Não vou votar, só conduzir a sala
                    </button>
                  </p>
                )}
              </>
            )}
          </footer>
        </div>

        {/* Tabela de capacidade: no canto direito em telas largas, abaixo do baralho no celular */}
        <aside className="mx-auto w-full max-w-md px-4 pb-6 xl:mx-0 xl:w-80 xl:max-w-none xl:shrink-0 xl:pt-4 xl:pr-4 xl:pl-0">
          <div className="xl:sticky xl:top-4">
            <TeamCapacity poker={poker} />
          </div>
        </aside>
      </div>

      <EmojiThrows throws={throws} />
    </div>
  )
}

function RoomHeader({ roomCode, roomName, isHost, onRename, onLeave }) {
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
        <RoomName name={roomName} isHost={isHost} onRename={onRename} />
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

// Nome da sala: todos veem; só o Host edita (clique no nome ou no lápis)
function RoomName({ name, isHost, onRename }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelRef = useRef(false)

  if (editing) {
    const save = () => {
      setEditing(false)
      if (cancelRef.current) cancelRef.current = false
      else if (draft.trim() !== name) onRename(draft.trim())
    }
    return (
      <input
        autoFocus
        value={draft}
        maxLength={MAX_ROOM_NAME}
        placeholder="Nome da sala"
        aria-label="Nome da sala"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            cancelRef.current = true
            e.currentTarget.blur()
          }
        }}
        className="w-56 rounded-md border border-blue-400/40 bg-slate-900/80 px-2 py-1 text-sm text-white outline-none focus:border-blue-400"
      />
    )
  }

  if (!isHost) {
    return name ? (
      <span className="max-w-[16rem] truncate border-l border-white/10 pl-3 text-lg font-semibold text-white" title={name}>
        {name}
      </span>
    ) : null
  }

  return (
    <button
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title="Renomear sala"
      className="flex max-w-[16rem] items-center gap-1.5 border-l border-white/10 pl-3 text-lg font-semibold"
    >
      <span className={`truncate ${name ? 'text-white' : 'text-sm font-normal text-slate-500'}`}>
        {name || 'Dar nome à sala'}
      </span>
      <span className="text-sm text-slate-400">✎</span>
    </button>
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

function SeatRow({ participants, ...props }) {
  if (!participants.length) return <div className="h-24" />
  return (
    <div className="flex flex-wrap justify-center gap-x-14 gap-y-6">
      {participants.map((p) => (
        <Seat key={p.id} participant={p} {...props} />
      ))}
    </div>
  )
}

// Carta de cada participante na mesa, com animação de virar.
// Clicar na carta de outra pessoa abre os emojis para jogar nela.
function Seat({ participant, revealed, myId, aimAt, onAim, onThrow }) {
  const { id, name, hasVoted, vote, isHost, spectator } = participant
  const isMe = id === myId
  const flipped = revealed && hasVoted
  const aiming = aimAt === id

  const card = spectator ? (
    // Host que só conduz: sem carta
    <div
      data-seat-card={id}
      className="flex h-17 w-10 items-center justify-center rounded-lg border-2 border-dashed border-slate-600 text-lg"
    >
      👀
    </div>
  ) : (
    <div data-seat-card={id} className="card-scene h-17 w-10">
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
  )

  return (
    <div className="relative flex w-24 flex-col items-center gap-2">
      {isMe ? (
        card
      ) : (
        <button
          onClick={() => onAim(aiming ? null : id)}
          title={`Jogar um emoji em ${name}`}
          aria-label={`Jogar um emoji em ${name}`}
          aria-expanded={aiming}
          className="rounded-lg transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
        >
          {card}
        </button>
      )}
      {aiming && <EmojiPicker name={name} onPick={(emoji) => onThrow(id, emoji)} onClose={() => onAim(null)} />}
      <span className={`max-w-full truncate text-sm font-semibold ${isMe ? 'text-blue-300' : 'text-white'}`}>
        {isHost && '👑 '}
        {name}
      </span>
      {spectator ? (
        <span className="-mt-1.5 text-xs text-slate-500">Só conduzindo</span>
      ) : (
        !revealed && (
          <span className={`-mt-1.5 text-xs ${hasVoted ? 'text-blue-300' : 'animate-pulse text-slate-500'}`}>
            {hasVoted ? 'Votou!' : 'Votando...'}
          </span>
        )
      )}
    </div>
  )
}

// Seletor de emojis em cima da carta. Fica aberto para jogar vários seguidos; fecha com Esc ou clique fora.
function EmojiPicker({ name, onPick, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [full, setFull] = useState(false) // seletor com todos os emojis

  useEffect(() => {
    const onDown = (e) => {
      // Clique fora do assento (a própria carta já alterna o seletor)
      if (!ref.current?.parentElement?.contains(e.target)) closeRef.current()
    }
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref}>
      {full ? (
        <FullEmojiPicker name={name} anchor={ref} onPick={onPick} />
      ) : (
        <div
          role="menu"
          aria-label={`Emojis para jogar em ${name}`}
          className="absolute bottom-full left-1/2 z-30 mb-2 grid w-max -translate-x-1/2 grid-cols-4 gap-1 rounded-xl border border-white/10 bg-slate-800 p-1.5 shadow-xl"
        >
          {THROW_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              role="menuitem"
              onClick={() => onPick(emoji)}
              aria-label={`Jogar ${emoji}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() => setFull(true)}
            className="col-span-4 rounded-lg py-1 text-xs font-medium text-blue-300 hover:bg-white/10"
          >
            Mais emojis…
          </button>
        </div>
      )}
    </div>
  )
}

// Todos os emojis (emoji-mart), carregados só na primeira vez que alguém abre, para não pesar a página.
// Fica perto da carta, mas sempre dentro da tela.
function FullEmojiPicker({ name, anchor, onPick }) {
  const boxRef = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const [pos, setPos] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([import('emoji-mart'), import('@emoji-mart/data'), import('@emoji-mart/data/i18n/pt.json')])
      .then(([{ Picker }, data, i18n]) => {
        if (cancelled || !boxRef.current) return
        const picker = new Picker({
          data: data.default,
          i18n: i18n.default,
          locale: 'pt',
          theme: 'dark',
          autoFocus: true,
          previewPosition: 'none',
          skinTonePosition: 'search',
          maxFrequentRows: 2,
          onEmojiSelect: (e) => e?.native && pickRef.current(e.native),
        })
        boxRef.current.replaceChildren(picker)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  // Posição: acima da carta se couber, senão abaixo; sem sair das laterais
  useLayoutEffect(() => {
    const seat = anchor.current?.parentElement
    if (!seat) return
    const r = seat.getBoundingClientRect()
    const w = 352
    const h = 435
    const m = 8
    const left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), window.innerWidth - w - m)
    const above = r.top - h - m
    const top = above >= m ? above : Math.min(r.bottom + m, Math.max(m, window.innerHeight - h - m))
    setPos({ left, top })
  }, [anchor])

  return (
    <div
      role="dialog"
      aria-label={`Escolha um emoji para jogar em ${name}`}
      style={pos ?? { visibility: 'hidden' }}
      className="fixed z-40 min-h-24 min-w-60 overflow-hidden rounded-xl border border-white/10 bg-slate-800 shadow-2xl"
    >
      <div ref={boxRef}>
        <p className="p-4 text-sm text-slate-400">{failed ? 'Não foi possível carregar os emojis.' : 'Carregando emojis...'}</p>
      </div>
    </div>
  )
}

// Emojis jogados em alguém (todos na sala veem). São anônimos: chegam de um ponto qualquer da borda da tela.
function EmojiThrows({ throws }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {throws.map((t) => (
        <FlyingEmoji key={t.id} {...t} />
      ))}
    </div>
  )
}

// Ponto aleatório logo fora de uma das quatro bordas da tela
function randomEdgePoint() {
  const w = window.innerWidth
  const h = window.innerHeight
  const out = 40
  const r = Math.random()
  return [
    { x: r * w, y: -out },
    { x: w + out, y: r * h },
    { x: r * w, y: h + out },
    { x: -out, y: r * h },
  ][Math.floor(Math.random() * 4)]
}

function FlyingEmoji({ target, emoji }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    const targetNode = document.querySelector(`[data-seat-card="${CSS.escape(target)}"]`)
    if (!el || !targetNode) return
    const r = targetNode.getBoundingClientRect()
    const end = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const start = randomEdgePoint()
    el.style.left = `${start.x}px`
    el.style.top = `${start.y}px`
    el.style.opacity = '1'

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dx = end.x - start.x
    const dy = end.y - start.y
    const at = (x, y, extra = '') => `translate(-50%, -50%) translate(${x}px, ${y}px) ${extra}`
    const lift = Math.min(180, 70 + Math.hypot(dx, dy) / 3)

    // Trajetória em arco (parábola), girando no caminho
    const steps = 16
    const path = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const scale = 0.8 + 0.4 * Math.sin(Math.PI * t)
      return { transform: at(dx * t, dy * t - 4 * lift * t * (1 - t), `rotate(${t * 540}deg) scale(${scale})`) }
    })

    const fly = reduced
      ? el.animate([{ transform: at(dx, dy) }, { transform: at(dx, dy) }], { duration: 300, fill: 'forwards' })
      : el.animate(path, { duration: 750, easing: 'cubic-bezier(.3,.1,.5,1)', fill: 'forwards' })

    let pop
    fly.onfinish = () => {
      if (!reduced) {
        // A carta de quem recebeu balança
        targetNode.animate(
          [
            { transform: 'rotate(0)' },
            { transform: 'rotate(-12deg) translateX(-3px)' },
            { transform: 'rotate(10deg) translateX(3px)' },
            { transform: 'rotate(-6deg)' },
            { transform: 'rotate(0)' },
          ],
          { duration: 400, easing: 'ease-out' },
        )
      }
      pop = el.animate(
        [
          { transform: at(dx, dy, 'scale(1)'), opacity: 1 },
          { transform: at(dx, dy - 10, 'scale(1.8)'), opacity: 0 },
        ],
        { duration: 600, delay: 250, easing: 'ease-out', fill: 'forwards' },
      )
    }
    return () => {
      fly.cancel()
      pop?.cancel()
    }
  }, [target])

  return (
    <span ref={ref} className="absolute text-3xl opacity-0 drop-shadow-lg">
      {emoji}
    </span>
  )
}

// No lugar do baralho para o Host que escolheu só conduzir
function SpectatorNotice({ onVote }) {
  return (
    <section className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-slate-300">👀 Você está só conduzindo a sala e não vota nas rodadas.</p>
      <button
        onClick={onVote}
        className="rounded-md border border-blue-400/40 px-4 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-400/10"
      >
        Voltar a votar
      </button>
    </section>
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
