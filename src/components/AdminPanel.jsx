import { useEffect, useRef, useState } from 'react'
import { watchRegistry } from '../lib/registry'
import { decryptAsAdmin, loadAdminKeys, signAdminCommand } from '../lib/adminCrypto'

// Painel do dono do site, aberto pelo link mágico (#admin=...)
export default function AdminPanel({ secret }) {
  const [keys, setKeys] = useState(null)
  const [keyError, setKeyError] = useState('')
  const [rooms, setRooms] = useState(null) // null = conectando
  const [closing, setClosing] = useState({}) // code -> true
  const [now, setNow] = useState(Date.now())
  const watcherRef = useRef(null)

  useEffect(() => {
    loadAdminKeys(secret).then(setKeys, () =>
      setKeyError('Link de admin inválido ou de uma chave antiga. Gere um novo com scripts/gerar-chave-admin.mjs.'),
    )
  }, [secret])

  useEffect(() => {
    if (!keys) return
    let latest = 0
    const watcher = watchRegistry({
      admin: true,
      onRooms: async (list) => {
        const seq = ++latest
        const decrypted = await Promise.all(
          list.map(async ({ key, blob }) => {
            try {
              return { key, ...(await decryptAsAdmin(keys, blob)) }
            } catch {
              return null // blob adulterado ou de outra chave
            }
          }),
        )
        if (seq === latest) setRooms(decrypted.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt))
      },
    })
    watcherRef.current = watcher
    return watcher.stop
  }, [keys])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const closeRoom = async (room) => {
    const { cmd, sig } = await signAdminCommand(keys, { action: 'close', code: room.code, ts: Date.now() })
    if (watcherRef.current?.send({ type: 'admin-cmd', key: room.key, cmd, sig })) {
      setClosing((c) => ({ ...c, [room.code]: true }))
    }
  }

  const closeAll = () => {
    if (confirm(`Encerrar todas as ${rooms.length} salas?`)) rooms.forEach(closeRoom)
  }

  const totalPeople = rooms?.reduce((n, r) => n + r.names.length, 0) ?? 0
  const base = `${window.location.origin}${window.location.pathname}`

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Planning Poker</p>
            <p className="text-xl font-bold text-white">Painel do admin</p>
          </div>
        </div>
        <a href={base} className="rounded-lg border border-blue-400/40 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-400/10">
          Ir para o app
        </a>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {keyError ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-300">{keyError}</p>
        ) : !keys || rooms == null ? (
          <p className="flex items-center gap-2 text-slate-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            {keys ? 'Procurando salas...' : 'Validando link...'}
          </p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="flex gap-8">
                <Stat label="Salas abertas" value={rooms.length} />
                <Stat label="Pessoas" value={totalPeople} />
              </div>
              {rooms.length > 0 && (
                <button
                  onClick={closeAll}
                  className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
                >
                  Encerrar todas
                </button>
              )}
            </div>

            {rooms.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-10 text-center text-slate-400">
                Nenhuma sala aberta agora.
              </p>
            ) : (
              <ul className="space-y-3">
                {rooms.map((room) => (
                  <li key={room.key} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xl font-bold tracking-[0.2em] text-white">{room.code}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Aberta há {ago(now - room.createdAt)} · última atividade há {ago(now - room.lastActivity)} · rodada {room.round} ·{' '}
                          {room.revealed ? 'cartas reveladas' : `${room.voted}/${room.names.length} votaram`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`${base}?sala=${room.code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-blue-400/40 px-3 py-1.5 text-sm text-blue-300 transition hover:bg-blue-400/10"
                        >
                          Entrar
                        </a>
                        <button
                          onClick={() => closeRoom(room)}
                          disabled={closing[room.code]}
                          className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                        >
                          {closing[room.code] ? 'Encerrando...' : 'Encerrar'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {room.names.map((name, i) => (
                        <span key={i} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-200">
                          {i === 0 && '👑 '}
                          {name}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-8 text-xs text-slate-500">
              Os dados das salas chegam criptografados e só este link consegue lê-los. Não compartilhe esta URL.
            </p>
          </>
        )}
      </main>
    </div>
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

function ago(ms) {
  const min = Math.max(0, Math.floor(ms / 60_000))
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}
