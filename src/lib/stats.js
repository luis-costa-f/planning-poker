import { DECK } from './poker'

/*
 * Estatísticas anônimas das rodadas, gravadas no Supabase (opcional).
 * Sem VITE_SUPABASE_URL e VITE_SUPABASE_KEY no build, nada é enviado.
 *
 * - O Host grava uma linha por rodada revelada: só os valores das cartas e quantas pessoas
 *   não votaram. Sem nomes e sem o código da sala (cada sala ganha um UUID aleatório).
 * - A chave pública só consegue inserir; a leitura é pela função get_stats(), que devolve
 *   números agregados. Ver supabase/schema.sql e docs/SUPABASE.md.
 */

const BASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_KEY

export const statsEnabled = Boolean(BASE_URL && KEY)

function post(path, body, extraHeaders) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...extraHeaders }
  // Chaves "anon" antigas são JWT e vão também no Authorization; as novas (sb_publishable_...) não
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`
  return fetch(`${BASE_URL}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body), keepalive: true })
}

// crypto.randomUUID só existe em https/localhost; fora disso monta um UUID v4 na mão
export function newRoomId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Host: chamado ao revelar. Rodadas sem nenhum voto não são gravadas.
export function recordRound({ roomId, round, participants }) {
  if (!statsEnabled) return
  const votes = participants.map((p) => p.vote).filter((v) => DECK.includes(v))
  if (!votes.length) return
  const total = Math.min(participants.length, 100)
  post(
    'rounds',
    { room_id: roomId, round, participants: total, votes: votes.slice(0, total), no_vote: total - Math.min(votes.length, total) },
    { Prefer: 'return=minimal' },
  ).catch(() => {}) // sem estatística o jogo segue normalmente
}

// Painel do admin: { overall, rooms } (ver get_stats() em supabase/schema.sql)
export async function fetchStats() {
  const res = await post('rpc/get_stats', {})
  if (!res.ok) throw new Error(`O Supabase respondeu ${res.status}`)
  return res.json()
}
