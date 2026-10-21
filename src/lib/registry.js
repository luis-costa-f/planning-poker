import Peer from 'peerjs'
import { PEER_PREFIX } from './poker'
import { encryptForAdmin, verifyAdminCommand } from './adminCrypto'

/*
 * Contador de salas abertas, sem servidor próprio.
 *
 * Um dos Hosts (o primeiro que conseguir registrar o ID fixo REGISTRY_ID no PeerJS)
 * vira o "contador". Os demais Hosts se conectam a ele e informam quantas pessoas
 * há na sua sala; o Lobby se conecta a ele para ler o total.
 *
 * - Se a aba do contador fechar, as conexões caem e os Hosts restantes disputam o
 *   ID fixo de novo: o servidor do PeerJS garante que só um vence (eleição automática).
 * - Sem nenhuma sala aberta, o ID não existe e o Lobby mostra "0".
 * - Em claro trafegam só números. Os detalhes da sala (código, nomes, rodada) vão
 *   criptografados para o admin; o contador apenas repassa, sem conseguir ler.
 * - Comandos do admin ("encerrar sala") vão assinados; cada Host confere a assinatura.
 *
 * Mensagens:
 *   Host -> contador:   { type: 'room', participants, blob }
 *   Lobby -> contador:  { type: 'watch' }        <- { type: 'count', rooms, participants }
 *   Admin -> contador:  { type: 'admin-watch' }  <- { type: 'admin-rooms', rooms: [{ key, blob }] }
 *   Admin -> contador -> Host:  { type: 'admin-cmd', key, cmd, sig }
 */

const REGISTRY_ID = PEER_PREFIX + 'registry-v1'
const HEARTBEAT_MS = 25_000
// Abas em segundo plano têm timers limitados a ~1x por minuto, por isso a folga grande
const ENTRY_TTL_MS = 150_000
const CONNECT_TIMEOUT_MS = 10_000
const RETRY_MS = 5_000
const WATCH_EMPTY_RETRY_MS = 10_000
const FATAL_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed'])

const jitter = () => 300 + Math.random() * 1500

// ---------- usado pelo Host ----------

/**
 * @param getInfo  () => { code, names, round, revealed, createdAt, lastActivity }
 * @param onAdminCommand  (cmd) => void, chamado só com comandos de assinatura válida
 */
export function startRoomReporter({ getInfo, onAdminCommand }) {
  let stopped = false
  let peer = null
  let conn = null
  let timers = []
  let lastJson = null
  let blob = null
  // Só quando esta aba é o contador:
  let rooms = null // Map<peerId | 'self', { participants, blob, conn, lastSeen }>
  let watchers = null // Set<DataConnection>
  let admins = null // Set<DataConnection>

  const later = (fn, ms) => timers.push(setTimeout(fn, ms))
  const every = (fn, ms) => timers.push(setInterval(fn, ms))

  function teardown() {
    timers.forEach(clearTimeout) // clearTimeout também cancela intervals
    timers = []
    const old = peer
    peer = null
    conn = null
    rooms = null
    watchers = null
    admins = null
    old?.destroy()
  }

  function restart(delay) {
    teardown()
    if (!stopped) later(claim, delay)
  }

  async function handleCommand(cmd, sig) {
    const verified = await verifyAdminCommand(cmd, sig, getInfo().code)
    if (verified && !stopped) onAdminCommand(verified)
  }

  // Tenta virar o contador; se o ID já estiver ocupado, entra como membro
  function claim() {
    if (stopped) return
    const p = new Peer(REGISTRY_ID)
    peer = p
    p.on('open', () => peer === p && becomeRegistry(p))
    p.on('disconnected', () => peer === p && !p.destroyed && p.reconnect())
    p.on('error', (err) => {
      if (peer !== p) return
      if (err.type === 'unavailable-id') {
        peer = null
        p.destroy()
        joinAsMember()
      } else if (!rooms) {
        restart(RETRY_MS)
      } else if (FATAL_ERRORS.has(err.type)) {
        // Contador perdeu o servidor: larga o posto e os membros elegem outro
        restart(jitter())
      }
    })
  }

  function publish() {
    if (!rooms) return
    let participants = 0
    rooms.forEach((r) => (participants += r.participants))
    const count = { type: 'count', rooms: rooms.size, participants }
    watchers.forEach((w) => w.open && w.send(count))

    if (admins.size) {
      const list = [...rooms.entries()].filter(([, r]) => r.blob).map(([key, r]) => ({ key, blob: r.blob }))
      const msg = { type: 'admin-rooms', rooms: list }
      admins.forEach((a) => a.open && a.send(msg))
    }
  }

  function becomeRegistry(p) {
    rooms = new Map([['self', { participants: getInfo().names.length, blob, conn: null, lastSeen: Infinity }]])
    watchers = new Set()
    admins = new Set()

    p.on('connection', (c) => {
      c.on('data', (msg) => {
        if (!rooms || !msg || typeof msg !== 'object') return
        if (msg.type === 'room') {
          const participants = Math.max(0, Math.min(100, Number(msg.participants) || 0))
          rooms.set(c.peer, { participants, blob: msg.blob || null, conn: c, lastSeen: Date.now() })
          publish()
        } else if (msg.type === 'watch') {
          watchers.add(c)
          publish()
        } else if (msg.type === 'admin-watch') {
          admins.add(c)
          publish()
        } else if (msg.type === 'admin-cmd') {
          // Só repassa; quem valida a assinatura é o Host de destino
          if (msg.key === 'self') handleCommand(msg.cmd, msg.sig)
          else rooms.get(msg.key)?.conn?.send({ type: 'admin-cmd', cmd: msg.cmd, sig: msg.sig })
        }
      })
      c.on('close', () => {
        if (!rooms) return
        rooms.delete(c.peer)
        watchers.delete(c)
        admins.delete(c)
        publish()
      })
    })

    // Remove salas que pararam de dar sinal de vida sem fechar a conexão
    every(() => {
      const now = Date.now()
      let changed = false
      rooms.forEach((r, key) => {
        if (now - r.lastSeen > ENTRY_TTL_MS) {
          r.conn?.close()
          rooms.delete(key)
          changed = true
        }
      })
      if (changed) publish()
    }, 30_000)
  }

  function send() {
    const participants = getInfo().names.length
    if (rooms) {
      Object.assign(rooms.get('self'), { participants, blob })
      publish()
    } else if (conn?.open) {
      conn.send({ type: 'room', participants, blob })
    }
  }

  function joinAsMember() {
    if (stopped) return
    const p = new Peer()
    peer = p
    p.on('open', () => {
      if (peer !== p) return
      const c = p.connect(REGISTRY_ID, { reliable: true })
      conn = c
      later(() => peer === p && !c.open && restart(jitter()), CONNECT_TIMEOUT_MS)
      c.on('open', () => {
        if (peer !== p) return
        send()
        every(send, HEARTBEAT_MS)
      })
      c.on('data', (msg) => msg?.type === 'admin-cmd' && handleCommand(msg.cmd, msg.sig))
      // O contador saiu: nova eleição
      c.on('close', () => peer === p && restart(jitter()))
    })
    p.on('error', () => peer === p && restart(jitter()))
  }

  // Chamar sempre que algo na sala mudar
  async function update() {
    const info = getInfo()
    const json = JSON.stringify(info)
    if (json === lastJson) return
    lastJson = json
    try {
      const encrypted = await encryptForAdmin(info)
      if (json !== lastJson) return // chegou uma atualização mais nova enquanto cifrava
      blob = encrypted
    } catch {
      blob = null // sem Web Crypto (ex.: http fora de localhost): segue só com a contagem
    }
    send()
  }

  claim()
  update()

  return {
    update,
    stop() {
      stopped = true
      teardown()
    },
  }
}

// ---------- usado pelo Lobby e pelo painel de admin ----------

/**
 * Conecta ao contador e repassa as atualizações.
 * Lobby: onCount({ rooms, participants }). Admin (admin: true): também onRooms([{ key, blob }]).
 * Retorna { stop, send } — send serve para o admin mandar comandos.
 */
export function watchRegistry({ admin = false, onCount, onRooms }) {
  let stopped = false
  let peer = null
  let conn = null
  let retryTimer = null

  function retry(p, ms) {
    if (peer !== p) return
    peer = null
    conn = null
    p.destroy()
    if (!stopped) retryTimer = setTimeout(connect, ms)
  }

  function connect() {
    if (stopped) return
    const p = new Peer()
    peer = p
    let timeout

    p.on('open', () => {
      if (peer !== p) return
      const c = p.connect(REGISTRY_ID, { reliable: true })
      timeout = setTimeout(() => retry(p, RETRY_MS), CONNECT_TIMEOUT_MS)
      c.on('open', () => {
        clearTimeout(timeout)
        conn = c
        c.send({ type: admin ? 'admin-watch' : 'watch' })
      })
      c.on('data', (msg) => {
        if (msg?.type === 'count') onCount?.({ rooms: msg.rooms, participants: msg.participants })
        else if (msg?.type === 'admin-rooms') onRooms?.(msg.rooms)
      })
      // O contador mudou de aba: reconecta ao novo
      c.on('close', () => {
        clearTimeout(timeout)
        retry(p, jitter() + 1500)
      })
    })

    p.on('error', (err) => {
      clearTimeout(timeout)
      if (err.type === 'peer-unavailable') {
        // Ninguém ocupa o ID do contador = nenhuma sala aberta
        onCount?.({ rooms: 0, participants: 0 })
        onRooms?.([])
        retry(p, WATCH_EMPTY_RETRY_MS)
      } else {
        retry(p, RETRY_MS)
      }
    })
  }

  const stop = () => {
    stopped = true
    clearTimeout(retryTimer)
    window.removeEventListener('pagehide', stop)
    const p = peer
    peer = null
    p?.destroy()
  }
  window.addEventListener('pagehide', stop)

  connect()
  return {
    stop,
    send: (msg) => (conn?.open ? (conn.send(msg), true) : false),
  }
}
