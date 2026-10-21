import { useState } from 'react'

// Permite compartilhar um link do tipo https://.../planning-poker/?sala=ABC123
function readRoomFromUrl() {
  return new URLSearchParams(window.location.search).get('sala') || ''
}

export default function Lobby({ connecting, error, onCreate, onJoin }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(readRoomFromUrl)
  const [nameError, setNameError] = useState('')

  const validName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Digite seu nome para continuar.')
      return null
    }
    setNameError('')
    return trimmed
  }

  const handleCreate = () => {
    const n = validName()
    if (n) onCreate(n)
  }

  const handleJoin = (e) => {
    e.preventDefault()
    const n = validName()
    if (n) onJoin(n, code)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <div className="mb-3 text-5xl">🃏</div>
        <h1 className="text-3xl font-bold tracking-tight">Planning Poker</h1>
        <p className="mt-2 text-sm text-slate-400">
          Peer-to-peer, sem cadastro e sem banco de dados. Tudo some quando a sala fecha.
        </p>
      </header>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-300">
            Seu nome
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="Ex.: Ana"
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
          />
          {nameError && <p className="mt-1 text-sm text-rose-400">{nameError}</p>}
        </div>

        <button
          onClick={handleCreate}
          disabled={connecting}
          className="w-full rounded-lg bg-blue-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-blue-300 disabled:cursor-wait disabled:opacity-60"
        >
          Criar Nova Sala
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <label htmlFor="code" className="block text-sm font-medium text-slate-300">
            Código da sala
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="ABC123"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 font-mono tracking-widest uppercase outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300/30"
            />
            <button
              type="submit"
              disabled={connecting}
              className="rounded-lg bg-blue-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-blue-300 disabled:cursor-wait disabled:opacity-60"
            >
              Entrar
            </button>
          </div>
        </form>

        {connecting && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            Conectando...
          </p>
        )}
        {error && !connecting && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
