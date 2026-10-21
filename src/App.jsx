import Lobby from './components/Lobby'
import Room from './components/Room'
import { usePlanningPoker } from './hooks/usePlanningPoker'

export default function App() {
  const poker = usePlanningPoker()

  return (
    <div className="min-h-screen bg-[#030617] text-slate-100">
      {poker.status === 'connected' ? (
        <Room poker={poker} />
      ) : (
        <Lobby
          connecting={poker.status === 'connecting'}
          error={poker.error}
          onCreate={poker.createRoom}
          onJoin={poker.joinRoom}
        />
      )}
    </div>
  )
}
