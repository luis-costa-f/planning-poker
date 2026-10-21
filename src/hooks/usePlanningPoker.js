import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { PEER_PREFIX, generateRoomCode, normalizeRoomCode } from '../lib/poker'

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
 * Mensagens host -> convidado:  { type: 'state', state }
 */

const CONNECT_TIMEOUT_MS = 12000

const initialGame = { participants: [], revealed: false, round: 1 }

export function usePlanningPoker() {
  const [status, setStatus] = useState('idle') // idle | connecting | connected
  const [error, setError] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [myId, setMyId] = useState('')
  const [myVote, setMyVote] = useState(null)
  const [game, setGame] = useState(initialGame)

  const peerRef = useRef(null)
  // Host: conexões abertas (peerId -> DataConnection) e estado completo do jogo
  const connectionsRef = useRef(new Map())
  const hostStateRef = useRef(null)
  // Convidado: conexão com o host
  const hostConnRef = useRef(null)
  const leavingRef = useRef(false)

  // ---------- utilitários ----------

  const cleanup = useCallback(() => {
    leavingRef.current = true
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
      setError(message)
    },
    [cleanup],
  )

  // Fecha tudo se o componente for desmontado (ex.: fechar a aba)
  useEffect(() => cleanup, [cleanup])

  // ---------- lógica do HOST ----------

  // Gera a versão do estado que pode ser enviada a todos.
  const toPublicState = (state) => ({
    revealed: state.revealed,
    round: state.round,
    participants: [...state.participants.entries()].map(([id, p]) => ({
      id,
      name: p.name,
      isHost: p.isHost,
      hasVoted: p.vote != null,
      vote: state.revealed ? p.vote : null,
    })),
  })

  const broadcast = useCallback(() => {
    const state = hostStateRef.current
    if (!state) return
    const publicState = toPublicState(state)
    setGame(publicState)
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send({ type: 'state', state: publicState })
    })
  }, [])

  const handleGuestMessage = useCallback(
    (conn, msg) => {
      const state = hostStateRef.current
      if (!state || !msg || typeof msg !== 'object') return

      if (msg.type === 'join') {
        const name = String(msg.name || 'Anônimo').slice(0, 30)
        state.participants.set(conn.peer, { name, vote: null, isHost: false })
        connectionsRef.current.set(conn.peer, conn)
        broadcast()
      } else if (msg.type === 'vote') {
        const p = state.participants.get(conn.peer)
        if (!p || state.revealed) return // não aceita votos depois de revelar
        p.vote = msg.value == null ? null : String(msg.value).slice(0, 4)
        broadcast()
      }
    },
    [broadcast],
  )

  const createRoom = useCallback(
    (name) => {
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
            participants: new Map([[id, { name, vote: null, isHost: true }]]),
          }
          setRoomCode(code)
          setMyId(id)
          setIsHost(true)
          setMyVote(null)
          setStatus('connected')
          broadcast()
        })

        peer.on('connection', (conn) => {
          conn.on('data', (msg) => handleGuestMessage(conn, msg))
          conn.on('close', () => {
            connectionsRef.current.delete(conn.peer)
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
    [broadcast, cleanup, handleGuestMessage, resetToLobby],
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
    [cleanup, resetToLobby],
  )

  // ---------- ações da mesa ----------

  const vote = useCallback(
    (value) => {
      if (game.revealed) return
      const next = myVote === value ? null : value // clicar de novo desmarca
      setMyVote(next)

      if (isHost) {
        const me = hostStateRef.current?.participants.get(myId)
        if (me) me.vote = next
        broadcast()
      } else {
        hostConnRef.current?.send({ type: 'vote', value: next })
      }
    },
    [broadcast, game.revealed, isHost, myId, myVote],
  )

  const reveal = useCallback(() => {
    if (!isHost || !hostStateRef.current) return
    hostStateRef.current.revealed = true
    broadcast()
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
