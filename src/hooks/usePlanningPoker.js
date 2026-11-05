import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import {
  DEFAULT_SPRINT,
  MAX_ROOM_NAME,
  MAX_TEAM_EXTRAS,
  PEER_PREFIX,
  isThrowableEmoji,
  clampAllocation,
  clampSprintConfig,
  generateRoomCode,
  normalizeRoomCode,
} from '../lib/poker'
import { startRoomReporter } from '../lib/registry'
import { newRoomId, recordRound } from '../lib/stats'

/*
 * Arquitetura P2P (estrela):
 *
 *   Convidado A ─┐
 *   Convidado B ─┼──► HOST (dono do estado do jogo)
 *   Convidado C ─┘
 *
 * - O Host registra um ID previsível no servidor de sinalização público do PeerJS
 *   (PEER_PREFIX + código da sala). O servidor só serve para "apresentar" os peers;
 *   depois disso os dados trafegam direto entre os navegadores via WebRTC.
 * - O Host guarda o estado completo (incluindo os votos) apenas em memória.
 * - Os convidados enviam mensagens ("join", "vote") e recebem do Host uma versão
 *   "pública" do estado. Enquanto as cartas não são reveladas, o valor dos votos
 *   NÃO é enviado aos convidados, só o fato de que a pessoa já votou.
 *
 * Mensagens convidado -> host:  { type: 'join', name } | { type: 'vote', value }
 *   capacidade do time (qualquer um, a qualquer momento):
 *     { type: 'allocation', target, value }   <- própria linha ou pessoa adicionada à mão
 *     { type: 'add-member', name, allocation } | { type: 'remove-member', id }
 *     { type: 'sprint-config', patch }         <- { days?, holidays?, pointsPerDay?, roundDown? }
 *   { type: 'throw', target, emoji }          <- jogar um emoji (qualquer um) em alguém da mesa
 * Mensagens host -> convidado:  { type: 'state', state }
 *   { type: 'throw', id, target, emoji }       <- retransmitido a todos SEM dizer quem jogou (anônimo); só animação
 * O nome da sala e o modo "só conduzir" (Host não vota) só o Host altera (ação local, sem mensagem).
 */

const CONNECT_TIMEOUT_MS = 12000
// Sala sem nenhuma atividade (entrada, voto, revelação...) por esse tempo é encerrada sozinha
const IDLE_LIMIT_MS = 60 * 60_000
const IDLE_CHECK_MS = 60_000
// Emojis jogados: intervalo mínimo por pessoa, tempo na tela e quantos voando ao mesmo tempo
const THROW_COOLDOWN_MS = 300
const THROW_LIFETIME_MS = 1800
const MAX_FLYING = 20

const initialGame = { participants: [], revealed: false, round: 1, roomName: '', sprint: DEFAULT_SPRINT, extras: [] }

export function usePlanningPoker() {
  const [status, setStatus] = useState('idle') // idle | connecting | connected
  const [error, setError] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [myId, setMyId] = useState('')
  const [myVote, setMyVote] = useState(null)
  const [game, setGame] = useState(initialGame)
  const [throws, setThrows] = useState([]) // emojis voando agora: { id, target, emoji }

  const peerRef = useRef(null)
  // Host: conexões abertas (peerId -> DataConnection) e estado completo do jogo
  const connectionsRef = useRef(new Map())
  const hostStateRef = useRef(null)
  // Convidado: conexão com o host
  const hostConnRef = useRef(null)
  const leavingRef = useRef(false)
  // Host: contador de salas/painel admin e encerramento por inatividade
  const reporterRef = useRef(null)
  const idleTimerRef = useRef(null)
  // roomId: UUID aleatório usado só nas estatísticas (nunca o código da sala)
  const roomInfoRef = useRef({ code: '', roomId: '', createdAt: 0, lastActivity: 0 })
  // Host: último emoji jogado por cada pessoa (limite de frequência)
  const lastThrowRef = useRef(new Map())

  // Mostra um emoji voando e o tira da tela quando a animação acaba
  const showThrow = useCallback((t) => {
    setThrows((list) => [...list.slice(-(MAX_FLYING - 1)), t])
    setTimeout(() => setThrows((list) => list.filter((x) => x.id !== t.id)), THROW_LIFETIME_MS)
  }, [])

  // ---------- utilitários ----------

  const cleanup = useCallback(() => {
    leavingRef.current = true
    reporterRef.current?.stop()
    reporterRef.current = null
    clearInterval(idleTimerRef.current)
    connectionsRef.current.forEach((c) => c.close())
    connectionsRef.current.clear()
    hostConnRef.current?.close()
    hostConnRef.current = null
    peerRef.current?.destroy()
    peerRef.current = null
    hostStateRef.current = null
  }, [])

  const resetToLobby = useCallback(
    (message = '') => {
      cleanup()
      setStatus('idle')
      setRoomCode('')
      setIsHost(false)
      setMyId('')
      setMyVote(null)
      setGame(initialGame)
      setThrows([])
      setError(message)
    },
    [cleanup],
  )

  // Fecha tudo se o componente for desmontado ou a aba for fechada. O pagehide libera
  // o ID no PeerJS e avisa os outros na hora, sem esperar timeouts de rede.
  useEffect(() => {
    window.addEventListener('pagehide', cleanup)
    return () => {
      window.removeEventListener('pagehide', cleanup)
      cleanup()
    }
  }, [cleanup])

  // ---------- lógica do HOST ----------

  // Gera a versão do estado que pode ser enviada a todos.
  const toPublicState = (state) => ({
    revealed: state.revealed,
    round: state.round,
    roomName: state.roomName,
    sprint: state.sprint,
    participants: [...state.participants.entries()].map(([id, p]) => ({
      id,
      name: p.name,
      isHost: p.isHost,
      spectator: !!p.spectator, // Host que só conduz e não vota
      allocation: p.allocation,
      hasVoted: p.vote != null,
      vote: state.revealed ? p.vote : null,
    })),
    // Pessoas do time que não votam (adicionadas pelo nome)
    extras: state.extras.map(({ id, name, allocation }) => ({ id, name, allocation })),
  })

  const broadcast = useCallback(() => {
    const state = hostStateRef.current
    if (!state) return
    const publicState = toPublicState(state)
    setGame(publicState)
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send({ type: 'state', state: publicState })
    })
    roomInfoRef.current.lastActivity = Date.now()
    reporterRef.current?.update()
  }, [])

  // Dados da sala enviados (criptografados) ao painel de admin
  const getRoomInfo = useCallback(() => {
    const state = hostStateRef.current
    const { code, createdAt, lastActivity } = roomInfoRef.current
    return {
      code,
      roomName: state?.roomName ?? '',
      createdAt,
      lastActivity,
      round: state?.round ?? 0,
      revealed: state?.revealed ?? false,
      names: state ? [...state.participants.values()].map((p) => p.name) : [],
      voted: state ? [...state.participants.values()].filter((p) => p.vote != null).length : 0,
    }
  }, [])

  // Ações da tabela de capacidade. Vale para mensagens dos convidados e para o próprio Host.
  const applyTeamAction = useCallback(
    (senderId, msg, fromHost) => {
      const state = hostStateRef.current
      if (!state) return
      let changed = false

      if (msg.type === 'allocation') {
        const target = String(msg.target ?? '')
        const value = clampAllocation(msg.value)
        const participant = state.participants.get(target)
        // Cada membro indica a própria alocação; o Host pode ajustar a de todos
        if (participant && (fromHost || target === senderId)) {
          participant.allocation = value
          changed = true
        } else {
          const extra = state.extras.find((x) => x.id === target)
          if (extra) {
            extra.allocation = value
            changed = true
          }
        }
      } else if (msg.type === 'add-member') {
        const name = String(msg.name ?? '').trim().slice(0, 30)
        // Quem adiciona pode sugerir o id, para continuar editando a linha antes da resposta do Host
        const wanted = typeof msg.id === 'string' && /^x[\w-]{1,40}$/.test(msg.id) ? msg.id : null
        const taken = (id) => state.participants.has(id) || state.extras.some((x) => x.id === id)
        if (name && state.extras.length < MAX_TEAM_EXTRAS && !(wanted && taken(wanted))) {
          const id = wanted ?? `x${state.nextExtraId++}`
          state.extras.push({ id, name, allocation: clampAllocation(msg.allocation ?? 100) })
          changed = true
        }
      } else if (msg.type === 'rename-member') {
        const name = String(msg.name ?? '').trim().slice(0, 30)
        const extra = state.extras.find((x) => x.id === msg.id)
        if (extra && name && extra.name !== name) {
          extra.name = name
          changed = true
        }
      } else if (msg.type === 'remove-member') {
        const before = state.extras.length
        state.extras = state.extras.filter((x) => x.id !== msg.id)
        changed = state.extras.length !== before
      } else if (msg.type === 'sprint-config') {
        state.sprint = clampSprintConfig(msg.patch, state.sprint)
        changed = true
      } else if (msg.type === 'spectate' && fromHost) {
        const me = state.participants.get(senderId)
        if (me) {
          me.spectator = !!msg.value
          if (me.spectator) me.vote = null
          changed = true
        }
      } else if (msg.type === 'room-name' && fromHost) {
        state.roomName = String(msg.name ?? '').trim().slice(0, MAX_ROOM_NAME)
        changed = true
      }

      if (changed) broadcast()
    },
    [broadcast],
  )

  // Emoji jogado em alguém: o Host confere e retransmite para todos (inclusive quem jogou)
  const relayThrow = useCallback(
    (from, msg) => {
      const state = hostStateRef.current
      const target = String(msg.target ?? '')
      if (!state || !isThrowableEmoji(msg.emoji) || target === from || !state.participants.has(target)) return
      const now = Date.now()
      if (now - (lastThrowRef.current.get(from) ?? 0) < THROW_COOLDOWN_MS) return
      lastThrowRef.current.set(from, now)

      // Anônimo: quem jogou não vai na mensagem (o Host só usa para limitar a frequência)
      const event = { type: 'throw', id: Math.random().toString(36).slice(2), target, emoji: msg.emoji }
      connectionsRef.current.forEach((conn) => {
        if (conn.open) conn.send(event)
      })
      showThrow(event)
    },
    [showThrow],
  )

  const handleGuestMessage = useCallback(
    (conn, msg) => {
      const state = hostStateRef.current
      if (!state || !msg || typeof msg !== 'object') return

      if (msg.type === 'join') {
        const name = String(msg.name || 'Anônimo').slice(0, 30)
        state.participants.set(conn.peer, { name, vote: null, isHost: false, allocation: 100 })
        connectionsRef.current.set(conn.peer, conn)
        broadcast()
      } else if (msg.type === 'vote') {
        const p = state.participants.get(conn.peer)
        if (!p || state.revealed) return // não aceita votos depois de revelar
        p.vote = msg.value == null ? null : String(msg.value).slice(0, 4)
        broadcast()
      } else if (msg.type === 'throw') {
        if (state.participants.has(conn.peer)) relayThrow(conn.peer, msg)
      } else if (state.participants.has(conn.peer)) {
        applyTeamAction(conn.peer, msg, false)
      }
    },
    [applyTeamAction, broadcast, relayThrow],
  )

  const createRoom = useCallback(
    (name, roomName = '') => {
      cleanup()
      leavingRef.current = false
      setError('')
      setStatus('connecting')

      const tryOpen = (attempt = 0) => {
        const code = generateRoomCode()
        const peer = new Peer(PEER_PREFIX + code)
        peerRef.current = peer

        peer.on('open', (id) => {
          hostStateRef.current = {
            revealed: false,
            round: 1,
            roomName: String(roomName).trim().slice(0, MAX_ROOM_NAME),
            sprint: { ...DEFAULT_SPRINT },
            participants: new Map([[id, { name, vote: null, isHost: true, allocation: 100 }]]),
            extras: [],
            nextExtraId: 1,
          }
          const now = Date.now()
          roomInfoRef.current = { code, roomId: newRoomId(), createdAt: now, lastActivity: now }
          setRoomCode(code)
          setMyId(id)
          setIsHost(true)
          setMyVote(null)
          setStatus('connected')

          reporterRef.current = startRoomReporter({
            getInfo: getRoomInfo,
            onAdminCommand: (cmd) => {
              if (cmd.action === 'close') resetToLobby('A sala foi encerrada pelo administrador do site.')
            },
          })
          idleTimerRef.current = setInterval(() => {
            if (Date.now() - roomInfoRef.current.lastActivity > IDLE_LIMIT_MS) {
              resetToLobby('A sala foi encerrada automaticamente após 60 minutos sem atividade.')
            }
          }, IDLE_CHECK_MS)

          broadcast()
        })

        peer.on('connection', (conn) => {
          conn.on('data', (msg) => handleGuestMessage(conn, msg))
          conn.on('close', () => {
            connectionsRef.current.delete(conn.peer)
            lastThrowRef.current.delete(conn.peer)
            hostStateRef.current?.participants.delete(conn.peer)
            broadcast()
          })
          conn.on('error', () => conn.close())
        })

        // Perdeu contato com o servidor de sinalização: as conexões P2P
        // existentes continuam funcionando, mas tentamos reconectar para aceitar novos peers.
        peer.on('disconnected', () => {
          if (!leavingRef.current && !peer.destroyed) peer.reconnect()
        })

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && attempt < 3) {
            // Código já em uso (muito raro): tenta outro
            peer.destroy()
            tryOpen(attempt + 1)
            return
          }
          if (hostStateRef.current) return // erros pontuais com a sala já aberta
          resetToLobby(describeError(err))
        })
      }

      tryOpen()
    },
    [broadcast, cleanup, getRoomInfo, handleGuestMessage, resetToLobby],
  )

  // ---------- lógica do CONVIDADO ----------

  const joinRoom = useCallback(
    (name, rawCode) => {
      const code = normalizeRoomCode(rawCode)
      if (!code) {
        setError('Digite o código da sala.')
        return
      }

      cleanup()
      leavingRef.current = false
      setError('')
      setStatus('connecting')

      const peer = new Peer()
      peerRef.current = peer
      let timeout

      peer.on('open', (id) => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true })
        hostConnRef.current = conn

        timeout = setTimeout(() => {
          if (!conn.open) resetToLobby('Não foi possível conectar à sala. Verifique o código.')
        }, CONNECT_TIMEOUT_MS)

        conn.on('open', () => {
          clearTimeout(timeout)
          conn.send({ type: 'join', name })
          setRoomCode(code)
          setMyId(id)
          setIsHost(false)
          setMyVote(null)
          setStatus('connected')
        })

        conn.on('data', (msg) => {
          if (msg?.type === 'throw') {
            if (isThrowableEmoji(msg.emoji)) showThrow(msg)
            return
          }
          if (msg?.type !== 'state') return
          setGame(msg.state)
          // Sincroniza o voto local com o que o host conhece (ex.: após "Nova Rodada")
          const me = msg.state.participants.find((p) => p.id === id)
          if (me && !me.hasVoted) setMyVote(null)
        })

        conn.on('close', () => {
          clearTimeout(timeout)
          if (!leavingRef.current) resetToLobby('O Host encerrou a sala ou a conexão caiu.')
        })
      })

      peer.on('error', (err) => {
        clearTimeout(timeout)
        resetToLobby(describeError(err))
      })
    },
    [cleanup, resetToLobby, showThrow],
  )

  // ---------- ações da mesa ----------

  const vote = useCallback(
    (value) => {
      if (game.revealed) return
      const next = myVote === value ? null : value // clicar de novo desmarca

      if (isHost) {
        const me = hostStateRef.current?.participants.get(myId)
        if (!me || me.spectator) return
        setMyVote(next)
        me.vote = next
        broadcast()
      } else {
        setMyVote(next)
        hostConnRef.current?.send({ type: 'vote', value: next })
      }
    },
    [broadcast, game.revealed, isHost, myId, myVote],
  )

  const reveal = useCallback(() => {
    const state = hostStateRef.current
    if (!isHost || !state || state.revealed) return
    state.revealed = true
    broadcast()
    // Quem só conduz não entra na conta de "não votaram"
    const voters = [...state.participants.values()].filter((p) => !p.spectator)
    recordRound({ roomId: roomInfoRef.current.roomId, round: state.round, participants: voters })
  }, [broadcast, isHost])

  const newRound = useCallback(() => {
    const state = hostStateRef.current
    if (!isHost || !state) return
    state.revealed = false
    state.round += 1
    state.participants.forEach((p) => (p.vote = null))
    setMyVote(null)
    broadcast()
  }, [broadcast, isHost])

  const leave = useCallback(() => resetToLobby(''), [resetToLobby])

  // ---------- capacidade do time e nome da sala ----------

  // O Host aplica direto; o convidado manda para o Host, que valida e retransmite
  const teamAction = useCallback(
    (msg) => {
      if (isHost) applyTeamAction(myId, msg, true)
      else hostConnRef.current?.send(msg)
    },
    [applyTeamAction, isHost, myId],
  )

  const setAllocation = useCallback((target, value) => teamAction({ type: 'allocation', target, value }), [teamAction])
  const addMember = useCallback(
    (name, allocation, id) => teamAction({ type: 'add-member', name, allocation, id }),
    [teamAction],
  )
  const renameMember = useCallback((id, name) => teamAction({ type: 'rename-member', id, name }), [teamAction])
  const removeMember = useCallback((id) => teamAction({ type: 'remove-member', id }), [teamAction])
  const setSprintConfig = useCallback((patch) => teamAction({ type: 'sprint-config', patch }), [teamAction])
  const setRoomName = useCallback((name) => isHost && teamAction({ type: 'room-name', name }), [isHost, teamAction])

  // Host escolhe só conduzir a sala, sem votar (e pode voltar a votar)
  const setSpectating = useCallback(
    (value) => {
      if (!isHost) return
      if (value) setMyVote(null)
      teamAction({ type: 'spectate', value })
    },
    [isHost, teamAction],
  )

  // Jogar um emoji em alguém da mesa
  const throwEmoji = useCallback(
    (target, emoji) => {
      const msg = { type: 'throw', target, emoji }
      if (isHost) relayThrow(myId, msg)
      else hostConnRef.current?.send(msg)
    },
    [isHost, myId, relayThrow],
  )

  return {
    status,
    error,
    roomCode,
    isHost,
    myId,
    myVote,
    game,
    createRoom,
    joinRoom,
    vote,
    reveal,
    newRound,
    leave,
    setAllocation,
    addMember,
    renameMember,
    removeMember,
    setSprintConfig,
    setRoomName,
    setSpectating,
    throws,
    throwEmoji,
  }
}

function describeError(err) {
  switch (err?.type) {
    case 'peer-unavailable':
      return 'Sala não encontrada. Confira o código ou peça um novo ao Host.'
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Falha de rede ao falar com o servidor de sinalização. Tente novamente.'
    case 'browser-incompatible':
      return 'Seu navegador não suporta WebRTC.'
    default:
      return `Erro de conexão: ${err?.message || err?.type || 'desconhecido'}`
  }
}
