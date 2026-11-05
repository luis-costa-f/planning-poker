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
  const { game, myId, isHost, setAllocation, addMember, removeMember, setSprintConfig } = poker
  const { participants, extras = [], sprint = DEFAULT_SPRINT } = game
  const [open, setOpen] = useState(true)

  const members = [
    ...participants.map((p) => ({ ...p, voter: true, editable: isHost || p.id === myId })),
    ...extras.map((x) => ({ ...x, voter: false, editable: true })),
  ]
  const { workDays, fullPoints, averageAllocation, capacity, pointsFor } = computeCapacity(members, sprint)

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

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-1 font-medium">Pessoa</th>
                <th className="pb-1 text-right font-medium">Alocação</th>
                <th className="pb-1 text-right font-medium">Pts</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="max-w-0 py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      {/* Barra laranja = pessoa do time que não participa da votação (ver legenda) */}
                      <span
                        aria-hidden="true"
                        className={`h-4 w-1 shrink-0 rounded-full ${m.voter ? 'bg-transparent' : 'bg-orange-400'}`}
                      />
                      <span
                        className={`truncate ${m.id === myId ? 'text-blue-300' : 'text-white'}`}
                        title={m.voter ? m.name : `${m.name} (não está votando)`}
                      >
                        {m.isHost && '👑 '}
                        {m.name}
                        {!m.voter && <span className="sr-only"> (não está votando)</span>}
                      </span>
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
                  <td className="py-1.5 pl-2 text-right text-slate-300">{fmt(pointsFor(m.allocation))}</td>
                  <td className="py-1.5 text-right">
                    {!m.voter && (
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
            </tbody>
          </table>

          {extras.length > 0 && (
            <p className="-mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span aria-hidden="true" className="h-3 w-1 rounded-full bg-orange-400" />
              Não está votando
            </p>
          )}

          {extras.length < MAX_TEAM_EXTRAS && <AddMemberForm onAdd={addMember} />}

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

function AddMemberForm({ onAdd }) {
  const [name, setName] = useState('')
  const [allocation, setAllocation] = useState('100')

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, allocation === '' ? 100 : Number(allocation))
    setName('')
    setAllocation('100')
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Adicionar pessoa"
        aria-label="Nome da pessoa"
        className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-sm outline-none focus:border-blue-400"
      />
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={allocation}
        onChange={(e) => setAllocation(e.target.value)}
        aria-label="Alocação da pessoa (%)"
        className="w-16 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-right text-sm outline-none focus:border-blue-400"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="rounded-md bg-blue-400 px-2.5 py-1 text-sm font-semibold text-slate-950 transition hover:bg-blue-300 disabled:opacity-40"
      >
        +
      </button>
    </form>
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
