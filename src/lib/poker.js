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

// ---------- capacidade do time ----------

export const MAX_ROOM_NAME = 40
export const MAX_TEAM_EXTRAS = 30
// Configuração da sprint de cada sala (padrão: 15 dias úteis, 1 ponto por dia, sem feriados)
export const MAX_SPRINT_DAYS = 60
export const DEFAULT_SPRINT = { days: 15, holidays: 0, pointsPerDay: 1, roundDown: false }

// Alocação em % inteiro de 0 a 100 (padrão 100)
export function clampAllocation(value) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100
}

// Número >= 0 dentro do limite, com até `decimals` casas; inválido/vazio mantém o valor atual
function clampNumber(value, current, max, decimals = 0) {
  if (value === '' || value == null) return current
  const n = Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return current
  const f = 10 ** decimals
  return Math.min(max, Math.round(n * f) / f)
}

// Aplica uma alteração parcial na configuração da sprint, validando cada campo
export function clampSprintConfig(patch, current = DEFAULT_SPRINT) {
  const p = patch && typeof patch === 'object' ? patch : {}
  const days = clampNumber(p.days, current.days, MAX_SPRINT_DAYS)
  return {
    days,
    // feriados/folgas nunca passam do total de dias
    holidays: Math.min(days, clampNumber(p.holidays, current.holidays, MAX_SPRINT_DAYS)),
    pointsPerDay: clampNumber(p.pointsPerDay, current.pointsPerDay, 100, 1),
    roundDown: typeof p.roundDown === 'boolean' ? p.roundDown : current.roundDown,
  }
}

/*
 * Capacidade da sprint:
 *   dias úteis           = dias da sprint - feriados/folgas
 *   pontos por pessoa    = dias úteis × pontos por dia            (quem está 100% alocado)
 *   pontos de cada um    = pontos por pessoa × alocação           (ex.: 15 × 30% = 4,5)
 *   capacidade do time   = soma dos pontos de cada um
 * Com "arredondar para baixo", cada pessoa fica com a parte inteira (4,5 -> 4).
 */
export function computeCapacity(members, sprint = DEFAULT_SPRINT) {
  const workDays = Math.max(0, sprint.days - sprint.holidays)
  const fullPoints = Math.round(workDays * sprint.pointsPerDay * 10) / 10
  const pointsFor = (allocation) => {
    const raw = (fullPoints * allocation) / 100
    return sprint.roundDown ? Math.floor(raw + 1e-9) : Math.round(raw * 10) / 10
  }
  const n = members.length
  const totalAllocation = members.reduce((s, m) => s + m.allocation, 0)
  const capacity = Math.round(members.reduce((s, m) => s + pointsFor(m.allocation), 0) * 10) / 10
  return {
    workDays,
    fullPoints,
    averageAllocation: n ? Math.round(totalAllocation / n) : 0,
    capacity,
    pointsFor,
  }
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
