// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage — layout personalizado por perfil
// Perfis: owner/admin · seller/manager · financeiro_gestora · logistica
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Plus, Search, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import type { Seller } from '../../types'
import { FilaPrioridades } from '../../components/dashboard/FilaPrioridades'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  clients: { name: string } | null
}

interface Quote {
  id: string
  total: number
  created_at: string
  status: string
  clients: { name: string }[] | null
}

interface OrderStats {
  id: string
  total: number
  created_at: string
  status: string
}

interface MuralPost {
  id: string
  seller_id: string
  content: string
  created_at: string
  sellers: { name: string } | null
}

interface TeamSeller {
  id: string
  name: string
  role: string
  department: string | null
  xp: number | null
}

interface FinItem {
  id: string
  description: string
  amount: number
  due_date: string
  status: string
}

interface NewTaskForm {
  title: string
  due_date: string
  priority: string
  client_id: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Bom dia, ${name}`
  if (h < 18) return `Boa tarde, ${name}`
  return `Boa noite, ${name}`
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function fmtShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  return fmt(v)
}

function monthLabel(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function monthBounds(d: Date) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const end   = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`
  return { start, end }
}

const PRIORITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const PRIORITY_LABEL: Record<string, string>  = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' }
const PRIORITY_COLOR: Record<string, string>  = {
  critical: 'text-red-600 bg-red-50',
  high:     'text-amber-600 bg-amber-50',
  medium:   'text-blue-600 bg-blue-50',
  low:      'text-[#6B7280] bg-[#F3F4F6]',
}


function priorityVal(p: string | null) { return PRIORITY_ORDER[p ?? 'low'] ?? 0 }

const COMMISSION_BRACKETS = [
  { label: '≥ 45%',    min: 45, rate: 2.0 },
  { label: '35 – 44%', min: 35, rate: 1.3 },
  { label: '20 – 34%', min: 20, rate: 1.0 },
  { label: '15 – 19%', min: 15, rate: 0.5 },
  { label: '< 15%',    min: 0,  rate: 0.0 },
]

// ─── Shared Micro-components ─────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { key: T; label: string }[]
  active: T
  onChange: (k: T) => void
}) {
  return (
    <div className="flex items-center px-4 border-b border-[#E5E7EB] overflow-x-auto bg-white">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            active === t.key
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.low
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  )
}

function KpiCard({
  label, value, sub, accent = false, danger = false,
}: {
  label: string; value: string | number; sub?: string
  accent?: boolean; danger?: boolean
}) {
  const valCls = danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valCls}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SectionCard({
  title, children, action,
}: {
  title: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const today    = isoDate()
  const isOverdue = task.due_date ? task.due_date < today : false
  const isToday   = task.due_date === today
  const borderCls = isOverdue ? 'border-l-2 border-l-red-400'
    : isToday ? 'border-l-2 border-l-amber-400'
    : 'border-l-2 border-l-blue-300'

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors ${borderCls}`}>
      <button
        onClick={() => onComplete(task.id)}
        title="Marcar como concluída"
        className="mt-0.5 w-4 h-4 rounded border border-[#D1D5DB] hover:border-primary hover:bg-accent transition-colors shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-tight">{task.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.clients && (
            <span className="text-xs text-muted-foreground">{task.clients.name}</span>
          )}

          {task.due_date && (
            <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              · {fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
    </div>
  )
}

// ─── ABA PERFIL (shared) ─────────────────────────────────────────────────────

function AbaPerfil({
  seller, allTasks, mural, onPost,
}: {
  seller: Seller; allTasks: Task[]; mural: MuralPost[]
  onPost: (content: string) => void
}) {
  const [postText, setPostText] = useState('')

  const completedCount = allTasks.filter(t => t.status === 'completed').length
  const totalCount     = allTasks.filter(t => t.status !== 'cancelled').length
  const xp             = completedCount * 10
  const level          = Math.floor(xp / 500) + 1
  const xpInLevel      = xp % 500
  const progress       = Math.min(100, (xpInLevel / 500) * 100)
  const score          = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const initials = seller.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const ROLE_LABEL: Record<string, string> = {
    owner: 'Proprietário', admin: 'Administrador', manager: 'Gerente',
    seller: 'Vendedor', logistics: 'Logística',
  }

  function handlePost() {
    if (!postText.trim()) return
    onPost(postText.trim())
    setPostText('')
  }

  return (
    <div className="p-4 space-y-4">
      {/* Cartão de perfil */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold select-none shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">{seller.name}</p>
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[seller.role] ?? seller.role}</p>
          {seller.department && (
            <p className="text-xs text-muted-foreground mt-0.5">{seller.department}</p>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Nível"     value={level}           accent />
        <KpiCard label="XP Total"  value={xp.toLocaleString('pt-BR')} />
        <KpiCard label="Score"     value={`${score}%`}    accent={score >= 70} danger={score < 40} />
      </div>

      {/* Barra de progresso */}
      <div className="bg-card border border-border rounded-xl px-4 py-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Progresso para Nível {level + 1}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{xpInLevel} / 500 XP</p>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Mural */}
      <SectionCard title="Mural da Empresa">
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <textarea
              value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder="Compartilhe algo com a equipe…"
              rows={2}
              className="flex-1 text-sm border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground bg-card outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition resize-none"
            />
            <button onClick={handlePost} className="btn-primary self-end px-4">
              Postar
            </button>
          </div>

          {mural.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma postagem ainda.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {mural.map(p => (
                <div key={p.id} className="border border-border rounded-lg px-3 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{p.sellers?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(p.created_at.slice(0, 10))}</p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── ABA EVOLUÇÃO (shared) ───────────────────────────────────────────────────

type EvoTab = 'performance' | 'comissao' | 'regras'

function AbaEvolucao({
  sellerId, allTasks, orders,
}: {
  sellerId: string; allTasks: Task[]; orders: OrderStats[]
}) {
  const [month,  setMonth]  = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [evoTab, setEvoTab] = useState<EvoTab>('performance')

  const { start, end } = monthBounds(month)

  const myTasksMonth = allTasks.filter(t =>
    t.assigned_to === sellerId && t.due_date && t.due_date >= start && t.due_date <= end,
  )
  const ordersMonth = orders.filter(o => o.created_at.slice(0, 10) >= start && o.created_at.slice(0, 10) <= end)

  const completed      = myTasksMonth.filter(t => t.status === 'completed').length
  const total          = myTasksMonth.length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const totalSales     = ordersMonth.reduce((s, o) => s + (o.total ?? 0), 0)
  const avgMargin      = 0
  const calls    = 0
  const whatsapp = 0

  const commissionRate  = COMMISSION_BRACKETS.find(b => avgMargin >= b.min)?.rate ?? 0
  const commissionValue = totalSales * (commissionRate / 100)

  const EVO_TABS: { key: EvoTab; label: string }[] = [
    { key: 'performance', label: 'Performance'      },
    { key: 'comissao',    label: 'Comissão e Nível' },
    { key: 'regras',      label: 'Regras'            },
  ]

  return (
    <div>
      {/* Navegação por mês */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6] bg-card">
        <button
          onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel(month)}</span>
        <button
          onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <TabBar tabs={EVO_TABS} active={evoTab} onChange={setEvoTab} />

      <div className="p-4 space-y-4">
        {evoTab === 'performance' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Vendas no Mês"      value={fmtShort(totalSales)} accent />
              <KpiCard label="Pedidos"             value={ordersMonth.length} />
              <KpiCard label="Tarefas Concluídas"  value={`${completed}/${total}`} />
              <KpiCard label="Taxa de Conclusão"   value={`${completionRate}%`} accent={completionRate >= 70} danger={completionRate < 40} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Ligações Realizadas" value={calls} />
              <KpiCard label="WhatsApp Enviados"   value={whatsapp} />
            </div>
          </>
        )}

        {evoTab === 'comissao' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Receita do Mês" value={fmtShort(totalSales)} />
              <KpiCard label="Margem Média"   value={`${avgMargin.toFixed(1)}%`} />
              <KpiCard label="Comissão Est."  value={fmt(commissionValue)} accent />
            </div>

            <SectionCard title="Tabela de Comissão por Margem">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Faixa de Margem</th>
                      <th className="text-right">Taxa</th>
                      <th className="text-right">Sobre R$ 100k</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMMISSION_BRACKETS.map((b, idx) => {
                      const nextMin   = idx === 0 ? Infinity : COMMISSION_BRACKETS[idx - 1].min
                      const isActive  = avgMargin >= b.min && avgMargin < nextMin
                      return (
                        <tr key={b.label} className={isActive ? 'bg-accent/40' : ''}>
                          <td className="font-medium">{b.label}</td>
                          <td className="text-right tabular-nums font-semibold text-primary">{b.rate.toFixed(1)}%</td>
                          <td className="text-right tabular-nums">{fmt(100_000 * b.rate / 100)}</td>
                          <td>
                            {isActive && <span className="hh-badge-info">Sua faixa</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {evoTab === 'regras' && (
          <SectionCard title="Regras do Sistema de Comissão">
            <div className="p-4 space-y-3 text-sm text-foreground">
              <p>A comissão é calculada mensalmente com base na margem média dos pedidos faturados no período.</p>
              <div className="border-t border-border pt-3 space-y-1">
                <p className="font-medium">Critérios de elegibilidade:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Pedido com status Concluído ou Faturado</li>
                  <li>Margem registrada no sistema</li>
                  <li>Vendedor ativo no período</li>
                </ul>
              </div>
              <div className="border-t border-border pt-3 space-y-1">
                <p className="font-medium">XP e Níveis:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>+10 XP por tarefa concluída</li>
                  <li>+150 XP por elogio recebido do gestor</li>
                  <li>Nível sobe a cada 500 XP acumulados</li>
                </ul>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// ─── ABA VENDAS ──────────────────────────────────────────────────────────────

function AbaVendas({
  seller, tasks, quotes, onComplete,
}: {
  seller: Seller; tasks: Task[]; quotes: Quote[]
  onComplete: (id: string) => void
}) {
  const today  = isoDate()
  const [search, setSearch] = useState('')

  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigned_to === seller.id), [tasks, seller.id])

  const overdue = useMemo(() =>
    myTasks
      .filter(t => t.status === 'open' && t.due_date && t.due_date < today)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
    [myTasks, today])

  const todayTasks = useMemo(() =>
    myTasks
      .filter(t => t.status === 'open' && t.due_date === today)
      .sort((a, b) => priorityVal(b.priority) - priorityVal(a.priority)),
    [myTasks, today])

  const upcoming = useMemo(() =>
    myTasks
      .filter(t => t.status === 'open' && t.due_date && t.due_date > today)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .slice(0, 12),
    [myTasks, today])

  const focoHoje = todayTasks.slice(0, 3)

  const callsDone  = 0
  const waDone     = 0
  const totalDone  = myTasks.filter(t => t.status === 'completed' && t.done_at?.slice(0, 10) === today).length

  const quotesFiltered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q
      ? quotes.filter(o => (o.clients?.[0]?.name ?? '').toLowerCase().includes(q))
      : quotes
  }, [quotes, search])

  return (
    <div className="p-4 space-y-4">
      {/* Saudação */}
      <div className="bg-card border border-border rounded-xl px-4 py-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {greeting(seller.name.split(' ')[0])}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou orçamento…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-lg text-foreground placeholder:text-muted-foreground bg-card outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition"
          />
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border-l-2 border-l-destructive border border-border rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-destructive tabular-nums">{overdue.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Atrasadas</p>
        </div>
        <div className="bg-card border-l-2 border-l-amber-400 border border-border rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{todayTasks.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Hoje</p>
        </div>
        <div className="bg-card border-l-2 border-l-primary border border-border rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-primary tabular-nums">{upcoming.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Próximos dias</p>
        </div>
      </div>

      {/* Painel de metas */}
      <SectionCard title="Painel de Metas — Hoje">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#F3F4F6]">
          {[
            { label: 'Ligações',    done: callsDone, meta: 10 },
            { label: 'WhatsApp',    done: waDone,    meta: 20 },
            { label: 'Contatos',    done: totalDone, meta: 15 },
            { label: 'Vendas Hoje', done: 0,         meta: 0  },
          ].map(item => {
            const pct = item.meta > 0 ? Math.min(100, (item.done / item.meta) * 100) : 0
            const ok  = item.meta > 0 && item.done >= item.meta
            return (
              <div key={item.label} className="px-4 py-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${ok ? 'text-success' : 'text-foreground'}`}>
                  {item.done}
                  {item.meta > 0 && (
                    <span className="text-xs font-normal text-muted-foreground"> / {item.meta}</span>
                  )}
                </p>
                {item.meta > 0 && (
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ok ? 'bg-success' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Fila de Prioridades */}
      <FilaPrioridades />

      {/* Foco obrigatório */}
      {focoHoje.length > 0 && (
        <SectionCard title={`Foco Obrigatório de Hoje (${focoHoje.length})`}>
          {focoHoje.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </SectionCard>
      )}

      {/* Orçamentos em aberto */}
      {quotesFiltered.length > 0 && (
        <SectionCard title={`Orçamentos em Aberto (${quotesFiltered.length})`}>
          <div className="divide-y divide-[#F3F4F6]">
            {quotesFiltered.slice(0, 8).map(q => {
              const days = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86_400_000)
              return (
                <div key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F9FAFB] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{q.clients?.[0]?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">#{q.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary tabular-nums">{fmt(q.total)}</p>
                    <p className={`text-xs tabular-nums ${days > 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {days === 0 ? 'Hoje' : `${days}d aberto`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Seções de tarefas */}
      {overdue.length > 0 && (
        <SectionCard title={`Atrasadas (${overdue.length})`}>
          {overdue.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </SectionCard>
      )}
      {todayTasks.length > 0 && (
        <SectionCard title={`Hoje (${todayTasks.length})`}>
          {todayTasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </SectionCard>
      )}
      {upcoming.length > 0 && (
        <SectionCard title={`Próximos Dias (${upcoming.length})`}>
          {upcoming.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </SectionCard>
      )}
      {overdue.length === 0 && todayTasks.length === 0 && upcoming.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Sem tarefas pendentes. Bom trabalho.
        </div>
      )}
    </div>
  )
}

// ─── ABA TAREFAS GESTOR ───────────────────────────────────────────────────────

function AbaTarefasGestor({
  sellerId, tasks, sellers, clients, onComplete, onNewTask,
}: {
  sellerId: string
  tasks: Task[]
  sellers: TeamSeller[]
  clients: { id: string; name: string }[]
  onComplete: (id: string) => void
  onNewTask: (form: NewTaskForm) => void
}) {
  const today = isoDate()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewTaskForm>({
    title: '', due_date: today, priority: 'medium', client_id: '',
  })

  const myTasks      = useMemo(() => tasks.filter(t => t.assigned_to === sellerId && t.status === 'open'), [tasks, sellerId])
  const delegatedByMe = useMemo(() => tasks.filter(t => t.assigned_to !== sellerId && t.status === 'open'), [tasks, sellerId])

  const overdueCount   = myTasks.filter(t => t.due_date && t.due_date < today).length
  const todayCount     = myTasks.filter(t => t.due_date === today).length

  const delegatedBySeller = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of delegatedByMe) {
      const key = t.assigned_to ?? 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return [...map.entries()]
  }, [delegatedByMe])

  function sellerName(id: string) {
    return sellers.find(s => s.id === id)?.name ?? id.slice(0, 8)
  }

  function handleSave() {
    if (!form.title.trim()) return
    onNewTask(form)
    setForm({ title: '', due_date: today, priority: 'medium', client_id: '' })
    setShowNew(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tarefas Abertas"      value={myTasks.length} />
        <KpiCard label="Vencendo Hoje"        value={todayCount}     accent={todayCount > 0} />
        <KpiCard label="Atrasadas"            value={overdueCount}   danger={overdueCount > 0} />
        <KpiCard label="Delegadas Pendentes"  value={delegatedByMe.length} />
      </div>

      <SectionCard
        title="Minhas Tarefas"
        action={
          <button onClick={() => setShowNew(v => !v)} className="btn-primary text-xs px-2.5 py-1">
            <Plus size={12} /> Nova Tarefa
          </button>
        }
      >
        {showNew && (
          <div className="px-4 py-3 border-b border-[#F3F4F6] space-y-3">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Título da tarefa"
              className="w-full text-sm border border-input rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground bg-card outline-none focus:border-ring transition"
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="text-sm border border-input rounded-lg px-3 py-1.5 text-foreground bg-card outline-none focus:border-ring transition"
              />
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="text-sm border border-input rounded-lg px-3 py-1.5 text-foreground bg-card outline-none focus:border-ring transition"
              >
                <option value="critical">Crítico</option>
                <option value="high">Alto</option>
                <option value="medium">Médio</option>
                <option value="low">Baixo</option>
              </select>
              {clients.length > 0 && (
                <select
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="text-sm border border-input rounded-lg px-3 py-1.5 text-foreground bg-card outline-none focus:border-ring transition"
                >
                  <option value="">Cliente (opcional)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary">Salvar</button>
              <button onClick={() => setShowNew(false)} className="btn-outline">Cancelar</button>
            </div>
          </div>
        )}
        {myTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa aberta.</div>
        ) : (
          myTasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)
        )}
      </SectionCard>

      {delegatedBySeller.length > 0 && (
        <SectionCard title={`Delegadas por Mim (${delegatedByMe.length})`}>
          {delegatedBySeller.map(([sid, sellerTasks]) => (
            <div key={sid}>
              <div className="px-4 py-2 bg-secondary border-b border-[#F3F4F6]">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {sellerName(sid)} — {sellerTasks.length} tarefa{sellerTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              {sellerTasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  )
}

// ─── ABA EQUIPE (owner only) ─────────────────────────────────────────────────

type PeriodFilter = 'today' | 'week' | 'month'

function AbaEquipe({
  tasks, sellers, onElogio,
}: {
  tasks: Task[]
  sellers: TeamSeller[]
  onElogio: (sellerId: string) => void
}) {
  const [period, setPeriod] = useState<PeriodFilter>('month')

  const today      = isoDate()
  const weekStart  = isoDate(new Date(Date.now() - 6 * 86_400_000))
  const { start: mStart } = monthBounds(new Date())
  const periodStart = period === 'today' ? today : period === 'week' ? weekStart : mStart

  const ROLE_LABEL: Record<string, string> = {
    owner: 'Proprietário', admin: 'Administrador', manager: 'Gerente',
    seller: 'Vendedor', logistics: 'Logística',
  }

  const teamStats = sellers.map(s => {
    const st = tasks.filter(t => t.assigned_to === s.id && t.due_date && t.due_date >= periodStart)
    return {
      ...s,
      open:    st.filter(t => t.status === 'open').length,
      overdue: st.filter(t => t.status === 'open' && t.due_date && t.due_date < today).length,
      done:    st.filter(t => t.status === 'completed').length,
    }
  })

  const totalOpen    = teamStats.reduce((s, t) => s + t.open, 0)
  const totalOverdue = teamStats.reduce((s, t) => s + t.overdue, 0)
  const totalDone    = teamStats.reduce((s, t) => s + t.done, 0)
  const withOverdue  = teamStats.filter(s => s.overdue > 0).length

  const allOverdue = tasks.filter(t => t.status === 'open' && t.due_date && t.due_date < today)

  return (
    <div className="p-4 space-y-4">
      {/* Header + filtro período */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Equipe — Visão do Gestor</h2>
        <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
          {([['today', 'Hoje'], ['week', 'Esta Semana'], ['month', 'Este Mês']] as [PeriodFilter, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                period === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs da equipe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tarefas Abertas"          value={totalOpen} />
        <KpiCard label="Atrasadas"                value={totalOverdue} danger={totalOverdue > 0} />
        <KpiCard label="Concluídas no Período"    value={totalDone}   accent />
        <KpiCard label="Colaboradores c/ Atraso"  value={withOverdue} danger={withOverdue > 0} />
      </div>

      {/* Grid de colaboradores */}
      <SectionCard title="Colaboradores">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
          {teamStats.map(s => (
            <div key={s.id} className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[s.role] ?? s.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#F3F4F6]">
                <div className="text-center">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{s.open}</p>
                  <p className="text-[10px] text-muted-foreground">Abertas</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold tabular-nums ${s.overdue > 0 ? 'text-destructive' : 'text-foreground'}`}>{s.overdue}</p>
                  <p className="text-[10px] text-muted-foreground">Atrasadas</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold tabular-nums text-success">{s.done}</p>
                  <p className="text-[10px] text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Tarefas atrasadas da equipe */}
      {allOverdue.length > 0 && (
        <SectionCard title={`Tarefas Atrasadas da Equipe (${allOverdue.length})`}>
          {allOverdue.slice(0, 15).map(t => {
            const sName = sellers.find(s => s.id === t.assigned_to)?.name ?? '—'
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{sName} · {t.due_date ? fmtDate(t.due_date) : '—'}</p>
                </div>
                <PriorityBadge priority={t.priority} />
                <button className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                  Delegar
                </button>
              </div>
            )
          })}
        </SectionCard>
      )}

      {/* Creditar elogio */}
      <SectionCard title="Creditar Elogio (+150 XP)">
        <div className="p-3 flex flex-wrap gap-2">
          {sellers.map(s => (
            <button
              key={s.id}
              onClick={() => onElogio(s.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Award size={13} />
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── OWNER / ADMIN DASHBOARD ─────────────────────────────────────────────────

type OwnerTab = 'vendas' | 'tarefas' | 'equipe' | 'perfil' | 'evolucao'

function OwnerDashboard({ seller }: { seller: Seller }) {
  const [tab, setTab] = useState<OwnerTab>('vendas')
  const isOwner = seller.role === 'owner'

  const { data: rawTasks,   error: eTasks,  refetch: refetchTasks  } = useSupabaseQuery<Task[]>(
    ({ company_id }) =>
      supabase.from('tasks').select('*, clients(name)').eq('company_id', company_id).order('due_date'),
    [],
  )
  const { data: rawSellers } = useSupabaseQuery<TeamSeller[]>(
    ({ company_id }) =>
      supabase.from('sellers').select('id, name, role, department, xp').eq('company_id', company_id).eq('is_active', true).order('name'),
    [],
  )
  const { data: rawQuotes } = useSupabaseQuery<Quote[]>(
    ({ company_id }) =>
      supabase.from('orders').select('id, total, created_at, status, clients(name)')
        .eq('company_id', company_id)
        .not('status', 'in', '(invoiced,delivered,cancelled)')
        .order('created_at', { ascending: false }).limit(30),
    [],
  )
  const { data: rawOrders } = useSupabaseQuery<OrderStats[]>(
    ({ company_id }) =>
      supabase.from('orders').select('id, total, created_at, status').eq('company_id', company_id).order('created_at', { ascending: false }),
    [],
  )
  const { data: rawMural,   refetch: refetchMural  } = useSupabaseQuery<MuralPost[]>(
    ({ company_id }) =>
      supabase.from('mural_posts').select('*, sellers(name)').eq('company_id', company_id).order('created_at', { ascending: false }).limit(20),
    [],
  )
  const { data: rawClients } = useSupabaseQuery<{ id: string; name: string }[]>(
    ({ company_id }) =>
      supabase.from('clients').select('id, name').eq('company_id', company_id).order('name').limit(150),
    [],
  )

  const tasks   = rawTasks   ?? []
  const sellers = rawSellers ?? []
  const quotes  = rawQuotes  ?? []
  const orders  = rawOrders  ?? []
  const mural   = rawMural   ?? []
  const clients = rawClients ?? []

  async function completeTask(id: string) {
    await supabase.from('tasks').update({ status: 'completed', done_at: new Date().toISOString() }).eq('id', id)
    refetchTasks()
  }

  async function newTask(form: NewTaskForm) {
    await supabase.from('tasks').insert({
      title: form.title, due_date: form.due_date, priority: form.priority,
      client_id: form.client_id || null,
      assigned_to: seller.id, status: 'open', company_id: seller.company_id,
    })
    refetchTasks()
  }

  async function postMural(content: string) {
    await supabase.from('mural_posts').insert({ content, seller_id: seller.id, company_id: seller.company_id })
    refetchMural()
  }

  async function creditarElogio(targetId: string) {
    const cur = sellers.find(s => s.id === targetId)
    await supabase.from('sellers').update({ xp: (cur?.xp ?? 0) + 150 }).eq('id', targetId)
  }

  const TABS: { key: OwnerTab; label: string }[] = [
    { key: 'vendas',   label: 'Vendas'   },
    { key: 'tarefas',  label: 'Tarefas'  },
    ...(isOwner ? [{ key: 'equipe' as OwnerTab, label: 'Equipe' }] : []),
    { key: 'perfil',   label: 'Perfil'   },
    { key: 'evolucao', label: 'Evolução' },
  ]

  if (eTasks) {
    return (
      <div className="p-4">
        <div className="hh-alert-danger"><AlertCircle size={14} />{eTasks}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do seu trabalho</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'vendas'   && <AbaVendas seller={seller} tasks={tasks} quotes={quotes} onComplete={completeTask} />}
      {tab === 'tarefas'  && <AbaTarefasGestor sellerId={seller.id} tasks={tasks} sellers={sellers} clients={clients} onComplete={completeTask} onNewTask={newTask} />}
      {tab === 'equipe'   && isOwner && <AbaEquipe tasks={tasks} sellers={sellers} onElogio={creditarElogio} />}
      {tab === 'perfil'   && <AbaPerfil seller={seller} allTasks={tasks.filter(t => t.assigned_to === seller.id)} mural={mural} onPost={postMural} />}
      {tab === 'evolucao' && <AbaEvolucao sellerId={seller.id} allTasks={tasks} orders={orders} />}
    </div>
  )
}

// ─── SELLER / MANAGER DASHBOARD ──────────────────────────────────────────────

type SellerTab = 'meu-dia' | 'tarefas' | 'perfil' | 'evolucao'

function SellerDashboard({ seller }: { seller: Seller }) {
  const [tab, setTab] = useState<SellerTab>('meu-dia')

  const { data: rawTasks,  refetch: refetchTasks } = useSupabaseQuery<Task[]>(
    ({ company_id }) =>
      supabase.from('tasks').select('*, clients(name)')
        .eq('company_id', company_id).eq('assigned_to', seller.id).order('due_date'),
    [],
  )
  const { data: rawQuotes } = useSupabaseQuery<Quote[]>(
    ({ company_id }) =>
      supabase.from('orders').select('id, total, created_at, status, clients(name)')
        .eq('company_id', company_id)
        .not('status', 'in', '(invoiced,delivered,cancelled)')
        .order('created_at', { ascending: false }).limit(20),
    [],
  )
  const { data: rawOrders } = useSupabaseQuery<OrderStats[]>(
    ({ company_id }) =>
      supabase.from('orders').select('id, total, created_at, status').eq('company_id', company_id).order('created_at', { ascending: false }),
    [],
  )
  const { data: rawMural,  refetch: refetchMural  } = useSupabaseQuery<MuralPost[]>(
    ({ company_id }) =>
      supabase.from('mural_posts').select('*, sellers(name)').eq('company_id', company_id).order('created_at', { ascending: false }).limit(20),
    [],
  )
  const { data: rawClients } = useSupabaseQuery<{ id: string; name: string }[]>(
    ({ company_id }) =>
      supabase.from('clients').select('id, name').eq('company_id', company_id).order('name').limit(150),
    [],
  )

  const tasks   = rawTasks   ?? []
  const quotes  = rawQuotes  ?? []
  const orders  = rawOrders  ?? []
  const mural   = rawMural   ?? []
  const clients = rawClients ?? []

  async function completeTask(id: string) {
    await supabase.from('tasks').update({ status: 'completed', done_at: new Date().toISOString() }).eq('id', id)
    refetchTasks()
  }

  async function newTask(form: NewTaskForm) {
    await supabase.from('tasks').insert({
      title: form.title, due_date: form.due_date, priority: form.priority,
      client_id: form.client_id || null,
      assigned_to: seller.id, status: 'open', company_id: seller.company_id,
    })
    refetchTasks()
  }

  async function postMural(content: string) {
    await supabase.from('mural_posts').insert({ content, seller_id: seller.id, company_id: seller.company_id })
    refetchMural()
  }

  const TABS: { key: SellerTab; label: string }[] = [
    { key: 'meu-dia',  label: 'Meu Dia'  },
    { key: 'tarefas',  label: 'Tarefas'  },
    { key: 'perfil',   label: 'Perfil'   },
    { key: 'evolucao', label: 'Evolução' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do seu trabalho</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'meu-dia'  && <AbaVendas seller={seller} tasks={tasks} quotes={quotes} onComplete={completeTask} />}
      {tab === 'tarefas'  && <AbaTarefasGestor sellerId={seller.id} tasks={tasks} sellers={[]} clients={clients} onComplete={completeTask} onNewTask={newTask} />}
      {tab === 'perfil'   && <AbaPerfil seller={seller} allTasks={tasks} mural={mural} onPost={postMural} />}
      {tab === 'evolucao' && <AbaEvolucao sellerId={seller.id} allTasks={tasks} orders={orders} />}
    </div>
  )
}

// ─── FINANCEIRO / GESTORA DASHBOARD ──────────────────────────────────────────

type FinTab = 'tarefas' | 'compras' | 'financeiro' | 'perfil'

const FIN_CATEGORIES = ['Financeiro', 'Compras', 'Estoque', 'Logística', 'Gestão', 'Administrativo']

function FinanceiroDashboard({ seller }: { seller: Seller }) {
  const [tab, setTab] = useState<FinTab>('tarefas')

  const { data: rawTasks,  refetch: refetchTasks } = useSupabaseQuery<Task[]>(
    ({ company_id }) =>
      supabase.from('tasks').select('*, clients(name)').eq('company_id', company_id).order('due_date'),
    [],
  )
  const { data: rawRec } = useSupabaseQuery<FinItem[]>(
    ({ company_id }) =>
      supabase.from('fin_receivables').select('id, description, amount, due_date, status')
        .eq('company_id', company_id).order('due_date'),
    [],
  )
  const { data: rawPay } = useSupabaseQuery<FinItem[]>(
    ({ company_id }) =>
      supabase.from('fin_payables').select('id, description, amount, due_date, status')
        .eq('company_id', company_id).order('due_date'),
    [],
  )
  const { data: rawMural, refetch: refetchMural } = useSupabaseQuery<MuralPost[]>(
    ({ company_id }) =>
      supabase.from('mural_posts').select('*, sellers(name)').eq('company_id', company_id).order('created_at', { ascending: false }).limit(20),
    [],
  )

  const tasks       = rawTasks ?? []
  const receivables = rawRec   ?? []
  const payables    = rawPay   ?? []
  const mural       = rawMural ?? []

  const today  = isoDate()
  const { start: mStart, end: mEnd } = monthBounds(new Date())
  const next7  = isoDate(new Date(Date.now() + 7 * 86_400_000))

  async function completeTask(id: string) {
    await supabase.from('tasks').update({ status: 'completed', done_at: new Date().toISOString() }).eq('id', id)
    refetchTasks()
  }

  async function postMural(content: string) {
    await supabase.from('mural_posts').insert({ content, seller_id: seller.id, company_id: seller.company_id })
    refetchMural()
  }

  // KPIs financeiros
  const recMes     = receivables.filter(r => r.due_date >= mStart && r.due_date <= mEnd).reduce((s, r) => s + r.amount, 0)
  const payMes     = payables.filter(p => p.due_date >= mStart && p.due_date <= mEnd).reduce((s, p) => s + p.amount, 0)
  const saldoProj  = recMes - payMes
  const vencHoje   = [...receivables, ...payables].filter(x => x.due_date === today && x.status !== 'received' && x.status !== 'paid').length

  // KPIs de tarefas
  const openTasks     = tasks.filter(t => t.status === 'open')
  const todayTasks    = openTasks.filter(t => t.due_date === today)
  const overdueTasks  = openTasks.filter(t => t.due_date && t.due_date < today)
  const criticalTasks = openTasks.filter(t => t.priority === 'critical')
  const comprasTasks  = openTasks

  // Grupos por categoria (campo category removido do schema — exibindo todas as tarefas abertas)
  const tasksByCat: Record<string, Task[]> = {}
  for (const cat of FIN_CATEGORIES) {
    tasksByCat[cat] = openTasks
  }

  // Planejamento colunas
  const tomorrow = isoDate(new Date(Date.now() + 86_400_000))
  const weekEnd  = isoDate(new Date(Date.now() + 7 * 86_400_000))
  const planHoje    = openTasks.filter(t => t.due_date === today)
  const planAmanha  = openTasks.filter(t => t.due_date === tomorrow)
  const planSemana  = openTasks.filter(t => t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd)

  // Vencimentos próximos (7 dias)
  const upcoming7 = [...receivables, ...payables]
    .filter(x => x.due_date >= today && x.due_date <= next7 && x.status !== 'received' && x.status !== 'paid')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const TABS: { key: FinTab; label: string }[] = [
    { key: 'tarefas',    label: 'Tarefas'    },
    { key: 'compras',    label: 'Compras'    },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'perfil',     label: 'Perfil'     },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{greeting(seller.name.split(' ')[0])} — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* ABA TAREFAS */}
      {tab === 'tarefas' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Vencendo Hoje"     value={todayTasks.length}    accent={todayTasks.length > 0} />
            <KpiCard label="Atrasadas"         value={overdueTasks.length}  danger={overdueTasks.length > 0} />
            <KpiCard label="Críticas"          value={criticalTasks.length} danger={criticalTasks.length > 0} />
            <KpiCard label="Pendências Compras" value={comprasTasks.length} accent={comprasTasks.length > 0} />
          </div>

          {/* Grid de categorias */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {FIN_CATEGORIES.map(cat => {
              const catTasks = tasksByCat[cat] ?? []
              return (
                <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#F3F4F6]">
                    <p className="text-xs font-semibold text-foreground">{cat}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${catTasks.length > 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {catTasks.length}
                    </span>
                  </div>
                  {catTasks.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">Sem tarefas.</p>
                  ) : (
                    catTasks.slice(0, 3).map(t => (
                      <div key={t.id} onClick={() => completeTask(t.id)} className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                        <div className="w-3 h-3 rounded border border-[#D1D5DB] hover:border-primary shrink-0" />
                        <p className="text-xs text-foreground truncate">{t.title}</p>
                        <PriorityBadge priority={t.priority} />
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>

          {/* Planejamento em 3 colunas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Hoje', tasks: planHoje },
              { label: 'Amanhã', tasks: planAmanha },
              { label: 'Esta Semana', tasks: planSemana },
            ].map(col => (
              <SectionCard key={col.label} title={`${col.label} (${col.tasks.length})`}>
                {col.tasks.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-muted-foreground text-center">Livre</div>
                ) : (
                  col.tasks.map(t => <TaskRow key={t.id} task={t} onComplete={completeTask} />)
                )}
              </SectionCard>
            ))}
          </div>
        </div>
      )}

      {/* ABA COMPRAS — embute ComprasPage via navigate hint; renderiza imports dinâmicos */}
      {tab === 'compras' && (
        <div className="p-4">
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Acesse o módulo completo de Compras pelo menu lateral.
          </div>
        </div>
      )}

      {/* ABA FINANCEIRO */}
      {tab === 'financeiro' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="A Receber — Mês"  value={fmtShort(recMes)}  accent />
            <KpiCard label="A Pagar — Mês"    value={fmtShort(payMes)}  danger />
            <KpiCard label="Vencendo Hoje"     value={vencHoje}          danger={vencHoje > 0} />
            <KpiCard label="Saldo Projetado"   value={fmtShort(saldoProj)} accent={saldoProj >= 0} danger={saldoProj < 0} />
          </div>

          <SectionCard title={`Vencimentos Próximos — 7 dias (${upcoming7.length})`}>
            {upcoming7.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum vencimento nos próximos 7 dias.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Vencimento</th>
                      <th className="text-right">Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming7.map(x => (
                      <tr key={x.id}>
                        <td>{x.description}</td>
                        <td className={x.due_date === today ? 'font-semibold text-destructive' : ''}>{fmtDate(x.due_date)}</td>
                        <td className="text-right tabular-nums font-medium">{fmt(x.amount)}</td>
                        <td>
                          <span className={`hh-badge ${x.status === 'received' || x.status === 'paid' ? 'hh-badge-success' : x.due_date < today ? 'hh-badge-danger' : 'hh-badge-warning'}`}>
                            {x.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'perfil' && <AbaPerfil seller={seller} allTasks={tasks.filter(t => t.assigned_to === seller.id)} mural={mural} onPost={postMural} />}
    </div>
  )
}

// ─── LOGÍSTICA DASHBOARD ─────────────────────────────────────────────────────

type LogTab = 'tarefas' | 'estoque' | 'entregas' | 'perfil'

function LogisticaDashboard({ seller }: { seller: Seller }) {
  const [tab, setTab] = useState<LogTab>('tarefas')

  const { data: rawTasks, refetch: refetchTasks } = useSupabaseQuery<Task[]>(
    ({ company_id }) =>
      supabase.from('tasks').select('*, clients(name)').eq('company_id', company_id).order('due_date'),
    [],
  )
  const { data: rawMural, refetch: refetchMural } = useSupabaseQuery<MuralPost[]>(
    ({ company_id }) =>
      supabase.from('mural_posts').select('*, sellers(name)').eq('company_id', company_id).order('created_at', { ascending: false }).limit(20),
    [],
  )

  const tasks = rawTasks ?? []
  const mural = rawMural ?? []
  const today = isoDate()

  async function completeTask(id: string) {
    await supabase.from('tasks').update({ status: 'completed', done_at: new Date().toISOString() }).eq('id', id)
    refetchTasks()
  }

  async function toggleRoutine(task: Task) {
    const newStatus = task.status === 'completed' ? 'open' : 'completed'
    await supabase.from('tasks').update({ status: newStatus, done_at: newStatus === 'completed' ? new Date().toISOString() : null }).eq('id', task.id)
    refetchTasks()
  }

  async function postMural(content: string) {
    await supabase.from('mural_posts').insert({ content, seller_id: seller.id, company_id: seller.company_id })
    refetchMural()
  }

  const openTasks = tasks.filter(t => t.status === 'open')

  // KPIs logística
  const conferencias   = openTasks.length
  const separar        = 0
  const estoqueBaixo   = 0 // necessitaria query de produtos
  const atrasadas      = openTasks.filter(t => t.due_date && t.due_date < today).length

  // Rotinas fixas
  const rotinas      = tasks.filter(t => t.is_recurring === true)
  const rotinasAbert = rotinas.filter(t => t.status === 'open')

  // Entregas do dia
  const entregasHoje = tasks.filter(t => t.due_date === today)

  const TABS: { key: LogTab; label: string }[] = [
    { key: 'tarefas',   label: 'Tarefas'   },
    { key: 'estoque',   label: 'Estoque'   },
    { key: 'entregas',  label: 'Entregas'  },
    { key: 'perfil',    label: 'Perfil'    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="px-6 py-4">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{greeting(seller.name.split(' ')[0])} — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* ABA TAREFAS */}
      {tab === 'tarefas' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Conferências"     value={conferencias}  accent={conferencias > 0} />
            <KpiCard label="Separar / Embalar" value={separar}      accent={separar > 0} />
            <KpiCard label="Estoque Baixo"    value={estoqueBaixo}  danger={estoqueBaixo > 0} />
            <KpiCard label="Atrasadas"        value={atrasadas}     danger={atrasadas > 0} />
          </div>

          {/* Lista de tarefas */}
          <SectionCard title={`Tarefas Abertas (${openTasks.length})`}>
            {openTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa aberta.</div>
            ) : (
              openTasks
                .sort((a, b) => priorityVal(b.priority) - priorityVal(a.priority))
                .map(t => <TaskRow key={t.id} task={t} onComplete={completeTask} />)
            )}
          </SectionCard>

          {/* Rotinas Fixas */}
          {rotinas.length > 0 && (
            <SectionCard title={`Rotinas Fixas (${rotinasAbert.length} pendentes)`}>
              {rotinas.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <button
                    onClick={() => toggleRoutine(t)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${t.status === 'completed' ? 'bg-primary' : 'bg-[#D1D5DB]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${t.status === 'completed' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <p className={`text-sm flex-1 ${t.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {t.title}
                  </p>
                  <PriorityBadge priority={t.priority} />
                </div>
              ))}
            </SectionCard>
          )}
        </div>
      )}

      {/* ABA ESTOQUE */}
      {tab === 'estoque' && (
        <div className="p-4">
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Acesse o módulo completo de Estoque pelo menu lateral.
          </div>
        </div>
      )}

      {/* ABA ENTREGAS */}
      {tab === 'entregas' && (
        <div className="p-4 space-y-4">
          <KpiCard label={`Entregas de Hoje — ${fmtDate(today)}`} value={entregasHoje.length} accent={entregasHoje.length > 0} />

          <SectionCard title="Lista de Entregas do Dia">
            {entregasHoje.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma entrega agendada para hoje.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarefa / Destino</th>
                      <th>Cliente</th>
                      <th>Prioridade</th>
                      <th>Status</th>
                      <th className="text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregasHoje.map(t => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.title}</td>
                        <td>{t.clients?.name ?? '—'}</td>
                        <td><PriorityBadge priority={t.priority} /></td>
                        <td>
                          <span className={`hh-badge ${t.status === 'completed' ? 'hh-badge-success' : 'hh-badge-warning'}`}>
                            {t.status === 'completed' ? 'Entregue' : 'Pendente'}
                          </span>
                        </td>
                        <td className="text-center">
                          {t.status !== 'completed' && (
                            <button
                              onClick={() => completeTask(t.id)}
                              className="btn-primary text-xs px-2.5 py-1"
                            >
                              Confirmar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'perfil' && <AbaPerfil seller={seller} allTasks={tasks.filter(t => t.assigned_to === seller.id)} mural={mural} onPost={postMural} />}
    </div>
  )
}

// ─── PROFILE ROUTER ──────────────────────────────────────────────────────────

function detectProfile(seller: Seller): 'owner' | 'seller' | 'financeiro' | 'logistica' {
  const dept = (seller.department ?? '').toLowerCase()
  if (dept === 'financeiro_gestora') return 'financeiro'
  if (dept === 'logistica')          return 'logistica'
  if (seller.role === 'owner' || seller.role === 'admin') return 'owner'
  return 'seller'
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { seller, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="hh-alert-danger">
          <AlertCircle size={14} />
          Perfil não encontrado. Verifique se o auth_user_id está vinculado à tabela sellers.
        </div>
      </div>
    )
  }

  const profile = detectProfile(seller)

  if (profile === 'financeiro') return <FinanceiroDashboard seller={seller} />
  if (profile === 'logistica')  return <LogisticaDashboard  seller={seller} />
  if (profile === 'owner')      return <OwnerDashboard      seller={seller} />
  return <SellerDashboard seller={seller} />
}
