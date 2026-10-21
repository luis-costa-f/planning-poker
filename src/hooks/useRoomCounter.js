import { useEffect, useState } from 'react'
import { watchRegistry } from '../lib/registry'

// Total de salas abertas e pessoas nelas. null enquanto ainda não sabemos.
export function useRoomCounter() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    const watcher = watchRegistry({ onCount: setCount })
    return watcher.stop
  }, [])

  return count
}
