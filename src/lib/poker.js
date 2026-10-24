// Constantes e funções puras do jogo (sem nada de rede aqui).

export const DECK = ['0', '½', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕']

// Prefixo para os IDs no servidor público do PeerJS, evitando colisão com outros apps.
// Numa cópia deste projeto, troque por um prefixo próprio (ex.: 'ppoker-fulano-'): com o mesmo
// prefixo, as duas cópias dividem códigos de sala e o contador de salas abertas.
export const PEER_PREFIX = 'ppoker-br-'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I para evitar confusão

export function generateRoomCode(length = 6) {
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  for (const b of bytes) code += CODE_CHARS[b % CODE_CHARS.length]
  return code
}

export function normalizeRoomCode(input) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function toNumber(value) {
  if (value === '½') return 0.5
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Calcula média e distribuição. Cartas "?" e "☕" não entram na média.
export function computeStats(participants) {
  const votes = participants.map((p) => p.vote).filter((v) => v != null)
  const numeric = votes.map(toNumber).filter((n) => n != null)

  const distribution = {}
  for (const v of votes) distribution[v] = (distribution[v] || 0) + 1

  const average = numeric.length
    ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10
    : null

  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  const topCount = sorted[0]?.[1] ?? 0
  // Valor mais votado (só se não houver empate no topo)
  const mode = sorted.length && sorted.filter(([, c]) => c === topCount).length === 1 ? sorted[0][0] : null

  return {
    average,
    totalVotes: votes.length,
    distribution: sorted,
    mode,
    agreement: votes.length ? topCount / votes.length : 0, // 0..1
    consensus: votes.length > 1 && sorted.length === 1,
  }
}
