import AdminPanel from './components/AdminPanel'
import Lobby from './components/Lobby'
import Room from './components/Room'
import { usePlanningPoker } from './hooks/usePlanningPoker'

// O link mágico do admin leva as chaves no fragmento (#admin=...), que nunca é enviado ao servidor
const adminSecret = window.location.hash.startsWith('#admin=') ? window.location.hash.slice(7) : null

export default function App() {
  return <div className="min-h-screen bg-[#030617] text-slate-100">{adminSecret ? <AdminPanel secret={adminSecret} /> : <Game />}</div>
}

function Game() {
  const poker = usePlanningPoker()

  return poker.status === 'connected' ? (
    <Room poker={poker} />
  ) : (
    <Lobby
      connecting={poker.status === 'connecting'}
      error={poker.error}
      onCreate={poker.createRoom}
      onJoin={poker.joinRoom}
    />
  )
}
