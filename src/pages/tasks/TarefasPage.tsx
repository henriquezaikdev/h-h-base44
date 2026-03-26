// ─────────────────────────────────────────────────────────────────────────────
// TarefasPage — gestão completa de tarefas e rotinas fixas
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Plus, Search, X, Check, ChevronLeft, ChevronRight,
  AlertTriangle, ToggleLeft, ToggleRight, Pencil, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  description: string | null
  client_id: string | null
  assigned_to: string | null
  priority: string
  due_date: string | null
  done_at: string | null
  status: string
  is_recurring: boolean | null
  company_id: string
  clients: { name: string }[] | null
}

interface ClientOption { id: string; name: string }
interface SellerOption { id: string; name: string; role: string }

interface TaskForm {
  title: string
  description: string
  client_id: string
  assigned_to: string
  priority: string
  due_date: string
  is_recurring: boolean
}

type StatusFilter   = 'todas' | 'abertas' | 'concluidas' | 'atrasadas'
type PriorityFilter = 'todas' | 'baixa'   | 'normal'     | 'alta' | 'urgente'

interface PageData {
  tasks:   Task[]
  clients: ClientOption[]
  sellers: SellerOption[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

function diffDays(due: string): number {
  const t = todayStr()
  return Math.round(
    (new Date(due + 'T12:00:00').getTime() - new Date(t + 'T12:00:00').getTime()) / 86_400_000,
  )
}

const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-gray-100 text-gray-500'            },
  normal:  { label: 'Normal',  cls: 'bg-blue-50 text-blue-600'              },
  alta:    { label: 'Alta',    cls: 'bg-amber-50 text-amber-700'            },
  urgente: { label: 'Urgente', cls: 'bg-red-50 text-red-600 font-semibold'  },
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  open:      { label: 'Aberta',    cls: 'bg-blue-50 text-blue-600'          },
  completed: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700'    },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400'         },
}


const PRIORITIES = ['baixa', 'normal', 'alta', 'urgente']
const PAGE_SIZE   = 20

const inputCls =
  'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] ' +
  'placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 ' +
  'focus:ring-[#3B5BDB]/20 transition bg-white'

// ─── Routine localStorage (resets daily) ─────────────────────────────────────

function routineDoneKey() { return `routine_done_${todayStr()}` }

function loadDoneRoutines(): Set<string> {
  try {
    const raw = localStorage.getItem(routineDoneKey())
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>()
  } catch { return new Set<string>() }
}

function saveDoneRoutines(ids: Set<string>) {
  localStorage.setItem(routineDoneKey(), JSON.stringify([...ids]))
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] ?? { label: priority, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium leading-none ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-400' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium leading-none ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#374151] mb-1">{label}</label>
      {children}
    </div>
  )
}

function KpiCard({
  label, value, color,
}: {
  label: string; value: number
  color: 'blue' | 'emerald' | 'red' | 'amber'
}) {
  const border = { blue: 'border-t-[#3B5BDB]', emerald: 'border-t-emerald-500', red: 'border-t-red-400',    amber: 'border-t-amber-400'  }[color]
  const val    = { blue: 'text-[#3B5BDB]',      emerald: 'text-emerald-600',     red: 'text-red-500',        amber: 'text-amber-600'      }[color]
  return (
    <div className={`bg-white border border-[#E5E7EB] border-t-2 ${border} rounded-xl px-5 py-4`}>
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${val}`}>{value}</p>
    </div>
  )
}

function DueCell({ due_date, status }: { due_date: string | null; status: string }) {
  if (!due_date || status !== 'open') return <span className="text-[#6B7280]">{fmtDate(due_date)}</span>
  const d   = diffDays(due_date)
  const sub = d < 0 ? `${Math.abs(d)}d atraso` : d === 0 ? 'Hoje' : `${d}d restantes`
  const cls = d < 0 ? 'text-red-500' : d <= 3 ? 'text-amber-600' : 'text-[#9CA3AF]'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[#374151]">{fmtDate(due_date)}</span>
      <span className={`text-[10px] font-medium ${cls}`}>{sub}</span>
    </div>
  )
}

// ─── TaskModal ────────────────────────────────────────────────────────────────

interface TaskModalProps {
  initial?:          Task
  isRoutine?:        boolean
  clients:           ClientOption[]
  sellers:           SellerOption[]
  canAssign:         boolean
  currentSellerId:   string
  onClose:           () => void
  onSave:            (form: TaskForm) => Promise<void>
}

function TaskModal({
  initial, isRoutine = false, clients, sellers,
  canAssign, currentSellerId, onClose, onSave,
}: TaskModalProps) {
  const [form, setForm] = useState<TaskForm>({
    title:        initial?.title        ?? '',
    description:  initial?.description  ?? '',
    client_id:    initial?.client_id    ?? '',
    assigned_to:    initial?.assigned_to    ?? currentSellerId,
    priority:     initial?.priority     ?? 'normal',
    due_date:     initial?.due_date     ?? '',
    is_recurring: initial?.is_recurring  ?? isRoutine,
  })

  const [clientSearch, setClientSearch] = useState(initial?.clients?.[0]?.name ?? '')
  const [showDrop,     setShowDrop]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    return q ? clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8) : clients.slice(0, 8)
  }, [clients, clientSearch])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Título é obrigatório'); return }
    setSaving(true)
    setFormError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const isEdit  = !!initial?.id
  const heading = form.is_recurring
    ? (isEdit ? 'Editar Rotina' : 'Nova Rotina')
    : (isEdit ? 'Editar Tarefa' : 'Nova Tarefa')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">

            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-[#111827]">{heading}</h2>
              <button
                type="button" onClick={onClose}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Fields — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} />
                  {formError}
                </div>
              )}

              <Field label="Título">
                <input
                  className={inputCls}
                  placeholder="Ex: Ligar para confirmar pedido"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </Field>

              <Field label="Descrição">
                <textarea
                  className={`${inputCls} resize-none h-20`}
                  placeholder="Notas adicionais..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </Field>

              {/* Cliente autocomplete */}
              <div ref={dropRef}>
                <Field label="Cliente">
                  <div className="relative">
                    <input
                      className={inputCls}
                      placeholder="Buscar cliente..."
                      value={clientSearch}
                      onChange={e => {
                        setClientSearch(e.target.value)
                        setShowDrop(true)
                        if (!e.target.value) setForm(f => ({ ...f, client_id: '' }))
                      }}
                      onFocus={() => setShowDrop(true)}
                    />
                    {showDrop && filteredClients.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredClients.map(c => (
                          <button
                            key={c.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm text-[#111827] hover:bg-[#F9FAFB] border-b border-[#F3F4F6] last:border-0"
                            onClick={() => { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(c.name); setShowDrop(false) }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {canAssign && (
                  <div className="col-span-2">
                    <Field label="Responsável">
                      <select
                        className={inputCls}
                        value={form.assigned_to}
                        onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                      >
                        {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                <Field label="Prioridade">
                  <select className={inputCls} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Data de vencimento">
                  <input
                    type="date" className={inputCls}
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </Field>

              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E5E7EB] shrink-0 flex justify-end gap-2">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}

// ─── TarefasPage ──────────────────────────────────────────────────────────────

export default function TarefasPage() {
  const { seller } = useAuth()
  const canAssign  = seller?.role === 'owner' || seller?.role === 'admin'

  const { data: raw, loading, error, refetch } = useSupabaseQuery<PageData>(
    async ({ company_id }) => {
      const [tasksRes, clientsRes, sellersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, client_id, assigned_to, priority, due_date, done_at, status, is_recurring, company_id, clients(name)')
          .eq('company_id', company_id)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('clients')
          .select('id, name')
          .eq('company_id', company_id)
          .order('name')
          .limit(300),
        supabase
          .from('sellers')
          .select('id, name, role')
          .eq('company_id', company_id)
          .eq('is_active', true)
          .order('name'),
      ])
      if (tasksRes.error) return { data: null, error: tasksRes.error }
      return {
        data: {
          tasks:   (tasksRes.data   ?? []) as unknown as Task[],
          clients: (clientsRes.data ?? []) as ClientOption[],
          sellers: (sellersRes.data ?? []) as SellerOption[],
        },
        error: null,
      }
    },
    [],
  )

  const allTasks = raw?.tasks   ?? []
  const clients  = raw?.clients ?? []
  const sellers  = raw?.sellers ?? []

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas')
  const [prioFilter,   setPrioFilter]   = useState<PriorityFilter>('todas')
  const [sellerFilter, setSellerFilter] = useState('')
  const [page,         setPage]         = useState(1)

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showNew,     setShowNew]     = useState(false)
  const [editTask,    setEditTask]    = useState<Task | null>(null)
  const [showRoutine, setShowRoutine] = useState(false)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  // ── Routine toggle (localStorage, resets daily) ───────────────────────────
  const [doneRoutines, setDoneRoutines] = useState<Set<string>>(() => loadDoneRoutines())

  function toggleRoutine(id: string) {
    setDoneRoutines(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveDoneRoutines(next)
      return next
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const t = todayStr()

  const regularTasks = allTasks.filter(tk => !tk.is_recurring)
  const routineTasks = allTasks.filter(tk => tk.is_recurring === true)

  const kpis = useMemo(() => {
    const d30 = new Date()
    d30.setDate(d30.getDate() - 30)
    return {
      abertas:    regularTasks.filter(tk => tk.status === 'open').length,
      hoje:       regularTasks.filter(tk => tk.status === 'open' && tk.due_date === t).length,
      atrasadas:  regularTasks.filter(tk => tk.status === 'open' && tk.due_date != null && tk.due_date < t).length,
      concluidas: regularTasks.filter(tk => tk.status === 'completed' && tk.done_at != null && new Date(tk.done_at) >= d30).length,
    }
  }, [regularTasks, t])

  const filtered = useMemo(() => {
    let list = regularTasks
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(tk =>
        tk.title.toLowerCase().includes(q) ||
        (tk.clients?.[0]?.name ?? '').toLowerCase().includes(q),
      )
    }
    if (statusFilter === 'abertas')    list = list.filter(tk => tk.status === 'open')
    if (statusFilter === 'concluidas') list = list.filter(tk => tk.status === 'completed')
    if (statusFilter === 'atrasadas')  list = list.filter(tk => tk.status === 'open' && tk.due_date != null && tk.due_date < t)
    if (prioFilter !== 'todas')        list = list.filter(tk => tk.priority === prioFilter)
    if (sellerFilter)                  list = list.filter(tk => tk.assigned_to === sellerFilter)
    return list
  }, [regularTasks, search, statusFilter, prioFilter, sellerFilter, t])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter, prioFilter, sellerFilter])

  // ── Mutations ─────────────────────────────────────────────────────────────
  async function saveTask(form: TaskForm, existingId?: string) {
    if (!seller) throw new Error('Usuário não autenticado')
    const payload = {
      title:        form.title.trim(),
      description:  form.description.trim() || null,
      client_id:    form.client_id    || null,
      assigned_to:    form.assigned_to    || null,
      priority:     form.priority,
      due_date:     form.due_date     || null,
      is_recurring: form.is_recurring,
    }
    if (existingId) {
      const { error: err } = await supabase.from('tasks').update(payload).eq('id', existingId)
      if (err) throw new Error(err.message)
    } else {
      const { error: err } = await supabase.from('tasks').insert({
        ...payload,
        status:     'open',
        company_id: seller.company_id,
        assigned_to:  payload.assigned_to ?? seller.id,
      })
      if (err) throw new Error(err.message)
    }
    refetch()
  }

  async function completeTask(id: string) {
    await supabase.from('tasks')
      .update({ status: 'completed', done_at: new Date().toISOString() })
      .eq('id', id)
    refetch()
  }

  async function deleteTask(id: string) {
    if (!confirm('Excluir esta tarefa? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    await supabase.from('tasks').delete().eq('id', id)
    setDeleting(null)
    refetch()
  }

  // ── Date label ────────────────────────────────────────────────────────────
  const todayLabel = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B7280]">Carregando tarefas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#111827] mb-1">Erro ao carregar tarefas</p>
          <p className="text-xs text-[#6B7280]">{error}</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#111827]">Tarefas</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{todayLabel}</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
          >
            <Plus size={14} />
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Abertas"           value={kpis.abertas}    color="blue"    />
          <KpiCard label="Vencendo Hoje"     value={kpis.hoje}       color="amber"   />
          <KpiCard label="Atrasadas"         value={kpis.atrasadas}  color="red"     />
          <KpiCard label="Concluídas (30d)"  value={kpis.concluidas} color="emerald" />
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              className="w-full text-sm border border-[#E5E7EB] rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white"
              placeholder="Buscar por título ou cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 outline-none focus:border-[#3B5BDB] bg-white text-[#374151]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="todas">Todos os status</option>
            <option value="abertas">Abertas</option>
            <option value="concluidas">Concluídas</option>
            <option value="atrasadas">Atrasadas</option>
          </select>

          <select
            className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 outline-none focus:border-[#3B5BDB] bg-white text-[#374151]"
            value={prioFilter}
            onChange={e => setPrioFilter(e.target.value as PriorityFilter)}
          >
            <option value="todas">Todas as prioridades</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          {canAssign && (
            <select
              className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 outline-none focus:border-[#3B5BDB] bg-white text-[#374151]"
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
            >
              <option value="">Todos os responsáveis</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* ── Main table ───────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
            <p className="text-sm text-[#9CA3AF]">Nenhuma tarefa encontrada.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Tarefa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Responsável</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Prioridade</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-36">Vencimento</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(task => {
                  const isOverdue  = task.status === 'open' && task.due_date != null && task.due_date < t
                  const isDueToday = task.status === 'open' && task.due_date === t
                  const rowBg = isOverdue ? 'bg-red-50/60' : isDueToday ? 'bg-amber-50/40' : ''
                  const sellerName = sellers.find(s => s.id === task.assigned_to)?.name ?? '—'

                  return (
                    <tr key={task.id} className={`border-b border-[#F3F4F6] last:border-0 hover:brightness-[0.98] transition-all ${rowBg}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111827] leading-tight">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] text-xs">
                        {task.clients?.[0]?.name ?? <span className="text-[#D1D5DB]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] text-xs">{sellerName}</td>
                      <td className="px-4 py-3 text-center">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <DueCell due_date={task.due_date} status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {task.status === 'open' && (
                            <button
                              onClick={() => completeTask(task.id)}
                              title="Concluir"
                              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              <Check size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setEditTask(task)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            disabled={deleting === task.id}
                            title="Excluir"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[#F3F4F6] flex items-center justify-between">
                <p className="text-xs text-[#9CA3AF]">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-[#374151] px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Rotinas Fixas ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Rotinas Fixas</h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Marque como feita hoje — toggle reseta diariamente.</p>
            </div>
            <button
              onClick={() => setShowRoutine(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#E5E7EB] text-[#374151] rounded-lg hover:bg-[#F9FAFB] transition-colors"
            >
              <Plus size={13} />
              Nova Rotina
            </button>
          </div>

          {routineTasks.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-10">
              <p className="text-sm text-[#9CA3AF]">Nenhuma rotina cadastrada.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {routineTasks.map(routine => {
                const done       = doneRoutines.has(routine.id)
                const sellerName = sellers.find(s => s.id === routine.assigned_to)?.name ?? '—'
                return (
                  <div
                    key={routine.id}
                    className={`flex items-center gap-4 px-4 py-3 border-b border-[#F3F4F6] last:border-0 transition-colors ${done ? 'bg-emerald-50/40' : ''}`}
                  >
                    <button
                      onClick={() => toggleRoutine(routine.id)}
                      className={`shrink-0 transition-colors ${done ? 'text-emerald-500' : 'text-[#D1D5DB] hover:text-[#9CA3AF]'}`}
                    >
                      {done ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-tight ${done ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'}`}>
                        {routine.title}
                      </p>
                      {routine.description && (
                        <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{routine.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <PriorityBadge priority={routine.priority} />
                      <span className="text-xs text-[#9CA3AF]">{sellerName}</span>
                    </div>

                    {done && (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                        <Check size={11} />
                        Feita hoje
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditTask(routine)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteTask(routine.id)}
                        disabled={deleting === routine.id}
                        title="Excluir"
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showNew && (
        <TaskModal
          clients={clients}
          sellers={sellers}
          canAssign={canAssign}
          currentSellerId={seller?.id ?? ''}
          onClose={() => setShowNew(false)}
          onSave={form => saveTask(form)}
        />
      )}

      {showRoutine && (
        <TaskModal
          isRoutine
          clients={clients}
          sellers={sellers}
          canAssign={canAssign}
          currentSellerId={seller?.id ?? ''}
          onClose={() => setShowRoutine(false)}
          onSave={form => saveTask(form)}
        />
      )}

      {editTask && (
        <TaskModal
          initial={editTask}
          clients={clients}
          sellers={sellers}
          canAssign={canAssign}
          currentSellerId={seller?.id ?? ''}
          onClose={() => setEditTask(null)}
          onSave={form => saveTask(form, editTask.id)}
        />
      )}

    </div>
  )
}
