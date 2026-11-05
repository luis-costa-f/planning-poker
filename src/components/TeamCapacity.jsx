import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SPRINT, MAX_SPRINT_DAYS, MAX_TEAM_EXTRAS, computeCapacity } from '../lib/poker'

/*
 * Tabela de capacidade do time, no canto da sala.
 * - Quem está na sala aparece sozinho e indica a própria alocação (o Host pode ajustar todas).
 * - Qualquer pessoa pode adicionar alguém do time só pelo nome, mesmo que não vote.
 * - A configuração da sprint (dias, feriados, pontos por dia, arredondamento) pode ser
 *   trocada por qualquer um a qualquer momento. Cada dia útil vale `pointsPerDay` pontos
 *   para quem está 100% alocado: 15 dias a 30% = 4,5 pts (ou 4, arredondando para baixo).
 * Tudo fica só na memória do Host, como o resto do jogo.
 */
export default function TeamCapacity({ poker }) {
  const { game, myId, isHost, setAllocation, addMember, renameMember, removeMember, setSprintConfig } = poker
  const { participants, extras = [], sprint = DEFAULT_SPRINT } = game
  const [open, setOpen] = useState(true)
  // Pessoa sendo adicionada agora: já existe na sala desde a primeira letra, mas continua
  // na linha de "Adicionar pessoa" até o foco sair dela
  const [draftId, setDraftId] = useState(null)
  const [rowKey, setRowKey] = useState(0) // troca para esvaziar a linha de adicionar
  const finishDraft = () => {
    setDraftId(null)
    setRowKey((k) => k + 1)
  }

  const members = [
    ...participants.map((p) => ({ ...p, voter: !p.spectator, editable: isHost || p.id === myId })),
    ...extras.map((x) => ({ ...x, voter: false, extra: true, editable: true })),
  ]
  const { workDays, fullPoints, averageAllocation, capacity, pointsFor } = computeCapacity(members, sprint)
  const draft = draftId ? extras.find((x) => x.id === draftId) : null
  const listed = members.filter((m) => m.id !== draftId)

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="font-semibold text-white">👥 Capacidade do time</span>
        <span className="flex items-center gap-2 text-sm text-slate-400">
          <span className="font-semibold text-blue-300">{fmt(capacity)} pts</span>
          <span>{open ? '−' : '+'}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/5 px-4 pt-3 pb-4">
          <SprintConfig sprint={sprint} onChange={setSprintConfig} />

          <p className="rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400">
            {workDays} {workDays === 1 ? 'dia útil' : 'dias úteis'} × {fmt(sprint.pointsPerDay)} pt/dia ={' '}
            <span className="font-semibold text-slate-200">{fmt(fullPoints)} pts</span> por pessoa a 100%
          </p>

          <table className="w-full table-fixed text-sm">
            {/* Larguras fixas: o campo de % não se mexe quando os números mudam de tamanho */}
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-14" />
              <col className="w-7" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-1 font-medium">Pessoa</th>
                <th className="pb-1 text-right font-medium">Alocação</th>
                <th className="pb-1 text-right font-medium">Pts</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {listed.map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="max-w-0 py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      {/* Barra laranja = pessoa do time que não participa da votação (ver legenda) */}
                      <span
                        aria-hidden="true"
                        className={`h-4 w-1 shrink-0 rounded-full ${m.voter ? 'bg-transparent' : 'bg-orange-400'}`}
                      />
                      {!m.extra ? (
                        <span className={`truncate ${m.id === myId ? 'text-blue-300' : 'text-white'}`} title={m.voter ? m.name : `${m.name} (não está votando)`}>
                          {m.isHost && '👑 '}
                          {m.name}
                        </span>
                      ) : (
                        <NameField
                          value={m.name}
                          onChange={(name) => renameMember(m.id, name)}
                          ariaLabel={`Nome de ${m.name} (não está votando)`}
                        />
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {m.editable ? (
                      <NumberField
                        value={m.allocation}
                        onCommit={(v) => setAllocation(m.id, v)}
                        max={100}
                        step={5}
                        ariaLabel={`Alocação de ${m.name}`}
                        className="w-16"
                        suffix="%"
                      />
                    ) : (
                      <span className="text-slate-300">{m.allocation}%</span>
                    )}
                  </td>
                  <td className="truncate py-1.5 pl-2 text-right text-slate-300 tabular-nums">
                    {fmt(pointsFor(m.allocation))}
                  </td>
                  <td className="py-1.5 text-right">
                    {m.extra && (
                      <button
                        onClick={() => removeMember(m.id)}
                        aria-label={`Remover ${m.name}`}
                        className="rounded px-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(draft || extras.length < MAX_TEAM_EXTRAS) && (
                <NewMemberRow
                  key={rowKey}
                  member={draft}
                  points={draft ? fmt(pointsFor(draft.allocation)) : null}
                  onStart={(name, allocation) => {
                    const id = `x${Math.random().toString(36).slice(2, 10)}`
                    setDraftId(id)
                    addMember(name, allocation, id)
                    return id
                  }}
                  onRename={renameMember}
                  onAllocation={setAllocation}
                  onRemove={(id) => {
                    removeMember(id)
                    finishDraft()
                  }}
                  onDone={finishDraft}
                />
              )}
            </tbody>
          </table>

          {members.some((m) => !m.voter) && (
            <p className="-mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span aria-hidden="true" className="h-3 w-1 rounded-full bg-orange-400" />
              Não está votando
            </p>
          )}

          <div className="rounded-lg bg-slate-800/70 px-3 py-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Alocação média</span>
              <span className="font-semibold text-white">{averageAllocation}%</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Capacidade do time</span>
              <span className="font-semibold text-blue-300">{fmt(capacity)} pts</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Configuração da sprint desta sala
function SprintConfig({ sprint, onChange }) {
  return (
    <div className="space-y-2 text-sm text-slate-300">
      <p className="text-xs uppercase tracking-wider text-slate-500">Configuração da sprint</p>
      <div className="grid grid-cols-3 gap-2">
        <ConfigField label="Dias úteis">
          <NumberField
            value={sprint.days}
            onCommit={(v) => onChange({ days: v })}
            max={MAX_SPRINT_DAYS}
            step={1}
            ariaLabel="Dias úteis da sprint"
            className="w-full"
          />
        </ConfigField>
        <ConfigField label="Feriados/folgas">
          <NumberField
            value={sprint.holidays}
            onCommit={(v) => onChange({ holidays: v })}
            max={sprint.days}
            step={1}
            ariaLabel="Feriados e folgas na sprint"
            className="w-full"
          />
        </ConfigField>
        <ConfigField label="Pts por dia">
          <NumberField
            value={sprint.pointsPerDay}
            onCommit={(v) => onChange({ pointsPerDay: v })}
            max={100}
            step="any"
            ariaLabel="Pontos por dia"
            className="w-full"
          />
        </ConfigField>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={sprint.roundDown}
          onChange={(e) => onChange({ roundDown: e.target.checked })}
          className="accent-blue-400"
        />
        Arredondar os pontos de cada pessoa para baixo (4,5 → 4)
      </label>
    </div>
  )
}

function ConfigField({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs text-slate-400">{label}</span>
      {children}
    </label>
  )
}

/*
 * Última linha da tabela: digitar a primeira letra já adiciona a pessoa (sem botão de confirmar).
 * As letras seguintes renomeiam, e a alocação ao lado já vale para ela. Quando o foco sai da
 * linha (ou Enter), ela vira uma linha comum e esta volta a ficar vazia.
 * O id é gerado aqui, então dá para continuar digitando sem esperar a resposta do Host.
 */
function NewMemberRow({ member, points, onStart, onRename, onAllocation, onRemove, onDone }) {
  const rowRef = useRef(null)
  const idRef = useRef(member?.id ?? null)
  const [name, setName] = useState(member?.name ?? '')
  const [allocation, setAllocationValue] = useState(member?.allocation ?? 100)

  const changeName = (text) => {
    setName(text)
    const trimmed = text.trim()
    if (!trimmed) return
    if (idRef.current) onRename(idRef.current, trimmed)
    else idRef.current = onStart(trimmed, allocation)
  }

  const changeAllocation = (value) => {
    setAllocationValue(value)
    if (idRef.current) onAllocation(idRef.current, value)
  }

  const finish = () => {
    const id = idRef.current
    if (!id) return
    if (!name.trim()) onRemove(id) // apagou o nome todo: desiste de adicionar
    else onDone()
  }

  return (
    <tr
      ref={rowRef}
      className="border-t border-white/5"
      onBlur={(e) => {
        if (!rowRef.current?.contains(e.relatedTarget)) finish()
      }}
    >
      <td className="py-1.5 pr-2">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-4 w-1 shrink-0 rounded-full ${idRef.current ? 'bg-orange-400' : 'bg-transparent'}`}
          />
          <input
            value={name}
            onChange={(e) => changeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            maxLength={30}
            placeholder="+ Pessoa"
            aria-label="Nome da pessoa a adicionar"
            className={nameInputClass}
          />
        </span>
      </td>
      <td className="py-1.5 text-right whitespace-nowrap">
        <NumberField
          value={member?.allocation ?? allocation}
          onCommit={changeAllocation}
          max={100}
          step={5}
          ariaLabel="Alocação da pessoa a adicionar"
          className="w-16"
          suffix="%"
        />
      </td>
      <td className="truncate py-1.5 pl-2 text-right text-slate-300 tabular-nums">{points}</td>
      <td className="py-1.5 text-right">
        {idRef.current && (
          <button
            onClick={() => onRemove(idRef.current)}
            aria-label={`Remover ${name}`}
            className="rounded px-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  )
}

const nameInputClass =
  'w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-white outline-none placeholder:text-slate-500 hover:border-white/10 focus:border-blue-400 focus:bg-slate-900/80'

// Nome editável de quem foi adicionado pelo nome. Envia a cada letra; se ficar vazio, volta ao nome atual.
function NameField({ value, onChange, ariaLabel }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  return (
    <input
      value={draft}
      title={`${value} (não está votando)`}
      maxLength={30}
      aria-label={ariaLabel}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value.trim()) onChange(e.target.value.trim())
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={nameInputClass}
    />
  )
}

/*
 * Campo numérico que envia o valor a cada alteração, para o cálculo atualizar na hora.
 * Campo vazio ou inválido não é enviado (ao sair, volta ao valor atual); Esc desfaz a edição.
 * Enquanto a pessoa digita, atualizações vindas do Host não sobrescrevem o que ela está digitando.
 */
function NumberField({ value, onCommit, max, step, placeholder, ariaLabel, className = '', suffix }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [editing, setEditing] = useState(false)
  const startRef = useRef(value) // valor ao entrar no campo, para o Esc
  const sentRef = useRef(value) // último valor enviado, para não repetir mensagens

  useEffect(() => {
    if (!editing) setDraft(value == null ? '' : String(value))
  }, [value, editing])

  const send = (next) => {
    if (next === sentRef.current) return
    sentRef.current = next
    onCommit(next)
  }

  const handleChange = (text) => {
    setDraft(text)
    if (text.trim() === '') return
    const next = Number(text.replace(',', '.'))
    if (Number.isFinite(next) && next >= 0) send(next)
  }

  return (
    <span className={`${suffix ? 'inline-flex' : 'flex'} items-center gap-1`}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={() => {
          startRef.current = value
          sentRef.current = value
          setEditing(true)
        }}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            send(startRef.current)
            e.currentTarget.blur()
          }
        }}
        className={`rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-right text-sm text-white outline-none focus:border-blue-400 ${className}`}
      />
      {suffix && <span className="text-slate-400">{suffix}</span>}
    </span>
  )
}

const fmt = (n) => (n == null ? null : n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
