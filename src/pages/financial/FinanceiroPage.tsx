import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Plus, Check, Clock, Ban } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'fluxo' | 'receber' | 'pagar' | 'dre' | 'despesas' | 'projecao' | 'fechamento'
type RecStatus = 'pending' | 'received' | 'overdue'
type PayStatus = 'pending' | 'paid' | 'overdue'

interface FinReceivable {
  id: string
  description: string
  client_id: string | null
  amount: number
  due_date: string
  received_date: string | null
  status: RecStatus
  company_id: string
  clients: { name: string } | null
}

interface FinPayable {
  id: string
  description: string
  supplier: string | null
  amount: number
  due_date: string
  paid_date: string | null
  credit_card_id: string | null
  status: PayStatus
  category: string | null
  company_id: string
  fin_credit_cards: { name: string } | null
}

interface Order {
  id: string
  total: number
  created_at: string
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function dateKey(dateStr: string) {
  return dateStr.slice(0, 10)
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysInMonth(date: Date): string[] {
  const start = monthStart(date)
  const end = monthEnd(date)
  const days: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(isoDate(new Date(d)))
  }
  return days
}

function weekdayShort(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

function fmtDate(dateStr: string) {
  const [y, m, day] = dateStr.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function RecStatusBadge({ status }: { status: RecStatus }) {
  if (status === 'received')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"><Check size={10} />Recebido</span>
  if (status === 'overdue')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600"><Ban size={10} />Atrasado</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Clock size={10} />Pendente</span>
}

function PayStatusBadge({ status }: { status: PayStatus }) {
  if (status === 'paid')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"><Check size={10} />Pago</span>
  if (status === 'overdue')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600"><Ban size={10} />Atrasado</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Clock size={10} />Pendente</span>
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: 'blue' | 'green' | 'red'
}) {
  const accent =
    color === 'blue'  ? 'text-[#3B5BDB]' :
    color === 'green' ? 'text-emerald-600' :
                        'text-red-500'
  const border =
    color === 'blue'  ? 'border-t-2 border-t-[#3B5BDB]' :
    color === 'green' ? 'border-t-2 border-t-emerald-500' :
                        'border-t-2 border-t-red-400'

  return (
    <div className={`bg-white border border-[#E5E7EB] ${border} rounded-xl px-4 py-4 flex flex-col gap-1`}>
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  )
}

function DreRow({ label, value, indent = false, bold = false, separator = false }: {
  label: string
  value: number
  indent?: boolean
  bold?: boolean
  separator?: boolean
}) {
  return (
    <tr className={separator ? 'border-t-2 border-[#E5E7EB]' : 'border-b border-[#F3F4F6]'}>
      <td className={`px-4 py-3 text-sm ${bold ? 'font-semibold text-[#111827]' : 'text-[#374151]'} ${indent ? 'pl-8' : ''}`}>
        {label}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${bold ? 'font-semibold' : ''} ${value < 0 ? 'text-red-500' : value > 0 ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}>
        {fmt(value)}
      </td>
      <td className="px-4 py-3 w-24">
        {value !== 0 && (
          <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className={`h-full rounded-full ${value >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, Math.abs(value) / 50000 * 100)}%` }}
            />
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const [activeTab, setActiveTab] = useState<TabKey>('fluxo')
  const [recStatusFilter, setRecStatusFilter] = useState<RecStatus | 'all'>('all')
  const [payStatusFilter, setPayStatusFilter] = useState<PayStatus | 'all'>('all')

  const today = isoDate(new Date())
  const mStart = isoDate(monthStart(currentMonth))
  const mEnd   = isoDate(monthEnd(currentMonth))

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: rawReceivables, loading: loadRec, error: errRec, refetch: refetchRec } = useSupabaseQuery<FinReceivable[]>(
    ({ company_id }) =>
      supabase
        .from('fin_receivables')
        .select('*, clients(name)')
        .eq('company_id', company_id)
        .order('due_date', { ascending: true }),
    [],
  )

  const { data: rawPayables, loading: loadPay, error: errPay, refetch: refetchPay } = useSupabaseQuery<FinPayable[]>(
    ({ company_id }) =>
      supabase
        .from('fin_payables')
        .select('*, fin_credit_cards(name)')
        .eq('company_id', company_id)
        .order('due_date', { ascending: true }),
    [],
  )

  const { data: rawOrders, loading: loadOrders } = useSupabaseQuery<Order[]>(
    ({ company_id }) =>
      supabase
        .from('orders')
        .select('id, total, created_at, status')
        .eq('company_id', company_id),
    [],
  )

  const loading = loadRec || loadPay || loadOrders
  const receivables = rawReceivables ?? []
  const payables    = rawPayables    ?? []
  const orders      = rawOrders      ?? []

  // ── KPI derivations ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const allReceived = receivables
      .filter(r => r.status === 'received')
      .reduce((s, r) => s + r.amount, 0)

    const allPaid = payables
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + p.amount, 0)

    const caixaAtual = allReceived - allPaid

    const recMes = receivables
      .filter(r => r.due_date >= mStart && r.due_date <= mEnd)
      .reduce((s, r) => s + r.amount, 0)

    const pagMes = payables
      .filter(p => p.due_date >= mStart && p.due_date <= mEnd)
      .reduce((s, p) => s + p.amount, 0)

    const recPendAnt = receivables
      .filter(r => r.status !== 'received' && r.due_date < mStart)
      .reduce((s, r) => s + r.amount, 0)

    const pagPendAnt = payables
      .filter(p => p.status !== 'paid' && p.due_date < mStart)
      .reduce((s, p) => s + p.amount, 0)

    const saldoFinal = caixaAtual + recMes - pagMes + recPendAnt - pagPendAnt

    return { caixaAtual, recMes, pagMes, recPendAnt, pagPendAnt, saldoFinal }
  }, [receivables, payables, mStart, mEnd])

  // ── Fluxo Mensal ──────────────────────────────────────────────────────────

  const fluxoDiario = useMemo(() => {
    const days = daysInMonth(currentMonth)
    let acumulado = kpis.caixaAtual

    return days.map(day => {
      const entradas = receivables
        .filter(r => dateKey(r.due_date) === day)
        .reduce((s, r) => s + r.amount, 0)

      const saidas = payables
        .filter(p => dateKey(p.due_date) === day)
        .reduce((s, p) => s + p.amount, 0)

      const saldoDia = entradas - saidas
      acumulado += saldoDia

      return { day, entradas, saidas, saldoDia, acumulado }
    })
  }, [receivables, payables, currentMonth, kpis.caixaAtual])

  // ── Contas a Receber filtradas ────────────────────────────────────────────

  const recMesFiltradas = useMemo(() => {
    return receivables.filter(r => {
      if (r.due_date < mStart || r.due_date > mEnd) return false
      if (recStatusFilter !== 'all' && r.status !== recStatusFilter) return false
      return true
    })
  }, [receivables, mStart, mEnd, recStatusFilter])

  // ── Contas a Pagar filtradas ──────────────────────────────────────────────

  const payMesFiltradas = useMemo(() => {
    return payables.filter(p => {
      if (p.due_date < mStart || p.due_date > mEnd) return false
      if (payStatusFilter !== 'all' && p.status !== payStatusFilter) return false
      return true
    })
  }, [payables, mStart, mEnd, payStatusFilter])

  // ── DRE ───────────────────────────────────────────────────────────────────

  const dre = useMemo(() => {
    const ordensDoMes = orders.filter(o => {
      const d = o.created_at.slice(0, 10)
      return d >= mStart && d <= mEnd
    })

    const receitaBruta = ordensDoMes.reduce((s, o) => s + (o.total ?? 0), 0)
    const deducoes = 0
    const receitaLiquida = receitaBruta - deducoes

    const payMes = payables.filter(p => p.due_date >= mStart && p.due_date <= mEnd)
    const cmv = payMes
      .filter(p => (p.category ?? '').toLowerCase() === 'cmv')
      .reduce((s, p) => s + p.amount, 0)

    const lucroBruto = receitaLiquida - cmv

    const despesasOp = payMes
      .filter(p => (p.category ?? '').toLowerCase() !== 'cmv')
      .reduce((s, p) => s + p.amount, 0)

    const ebitda = lucroBruto - despesasOp

    return { receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto, despesasOp, ebitda }
  }, [orders, payables, mStart, mEnd])

  // ── Despesas por categoria ────────────────────────────────────────────────

  const despesasPorCategoria = useMemo(() => {
    const payMes = payables.filter(p => p.due_date >= mStart && p.due_date <= mEnd)
    const map = new Map<string, number>()
    for (const p of payMes) {
      const cat = p.category ?? 'Sem categoria'
      map.set(cat, (map.get(cat) ?? 0) + p.amount)
    }
    const total = payMes.reduce((s, p) => s + p.amount, 0)
    return { entries: [...map.entries()].sort((a, b) => b[1] - a[1]), total }
  }, [payables, mStart, mEnd])

  // ── Projeção Futura ───────────────────────────────────────────────────────

  const projecoes = useMemo(() => {
    return [1, 2, 3].map(offset => {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
      const start = isoDate(monthStart(d))
      const end   = isoDate(monthEnd(d))
      const entradas = receivables
        .filter(r => r.due_date >= start && r.due_date <= end)
        .reduce((s, r) => s + r.amount, 0)
      const saidas = payables
        .filter(p => p.due_date >= start && p.due_date <= end)
        .reduce((s, p) => s + p.amount, 0)
      return { label: monthLabel(d), entradas, saidas, saldo: entradas - saidas }
    })
  }, [receivables, payables, currentMonth])

  // ── Fechamento do Dia ─────────────────────────────────────────────────────

  const fechamento = useMemo(() => {
    const recHoje = receivables.filter(r => dateKey(r.due_date) === today)
    const payHoje = payables.filter(p => dateKey(p.due_date) === today)
    const totalRecebido = recHoje.reduce((s, r) => s + r.amount, 0)
    const totalPago     = payHoje.reduce((s, p) => s + p.amount, 0)
    return { recHoje, payHoje, totalRecebido, totalPago, saldo: totalRecebido - totalPago }
  }, [receivables, payables, today])

  // ── Tabs config ───────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'fluxo',     label: 'Fluxo Mensal'       },
    { key: 'receber',   label: 'Contas a Receber'    },
    { key: 'pagar',     label: 'Contas a Pagar'      },
    { key: 'dre',       label: 'DRE'                 },
    { key: 'despesas',  label: 'Despesas'            },
    { key: 'projecao',  label: 'Projeção Futura'     },
    { key: 'fechamento',label: 'Fechamento do Dia'   },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Financeiro</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Gestão financeira da empresa</p>
          </div>

          {/* Navegação por mês */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[#111827] min-w-36 text-center">
              {monthLabel(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* Erros */}
        {(errRec || errPay) && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle size={14} />
            {errRec ?? errPay}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Caixa Atual"
              value={fmt(kpis.caixaAtual)}
              color="blue"
            />
            <KpiCard
              label="Receber do Mês"
              value={fmt(kpis.recMes)}
              color="green"
            />
            <KpiCard
              label="Pagar do Mês"
              value={fmt(kpis.pagMes)}
              color="red"
            />
            <KpiCard
              label="Receber Pend. Ant."
              value={fmt(kpis.recPendAnt)}
              sub="Vencidos não recebidos"
              color="green"
            />
            <KpiCard
              label="Pagar Pend. Ant."
              value={fmt(kpis.pagPendAnt)}
              sub="Vencidos não pagos"
              color="red"
            />
            <KpiCard
              label="Saldo Final Projetado"
              value={fmt(kpis.saldoFinal)}
              color={kpis.saldoFinal >= 0 ? 'blue' : 'red'}
            />
          </div>
        )}

        {/* Alerta ruptura de caixa */}
        {!loading && kpis.saldoFinal < 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
            <AlertCircle size={15} />
            Ruptura de caixa prevista — saldo acumulado ficará negativo.
          </div>
        )}

        {/* Tabs + Conteúdo */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">

          {/* Tab bar */}
          <div className="flex items-center px-4 border-b border-[#E5E7EB] overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#3B5BDB] border-b-2 border-[#3B5BDB] -mb-px'
                    : 'text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── ABA: FLUXO MENSAL ─────────────────────────────────────────────── */}
          {activeTab === 'fluxo' && (
            loading ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Data</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Entradas</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Saídas</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Saldo do Dia</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Saldo Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fluxoDiario.map(row => (
                      <tr key={row.day} className={`border-b border-[#F3F4F6] ${row.day === today ? 'bg-[#EEF2FF]/40' : 'hover:bg-[#F9FAFB]'} transition-colors`}>
                        <td className="px-4 py-2.5">
                          <span className="text-[#111827] font-medium">{fmtDate(row.day)}</span>
                          <span className="ml-2 text-xs text-[#9CA3AF] capitalize">{weekdayShort(row.day)}</span>
                          {row.day === today && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] font-semibold">hoje</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.entradas > 0
                            ? <span className="text-emerald-600 font-medium">{fmt(row.entradas)}</span>
                            : <span className="text-[#9CA3AF]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.saidas > 0
                            ? <span className="text-red-500 font-medium">{fmt(row.saidas)}</span>
                            : <span className="text-[#9CA3AF]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={row.saldoDia < 0 ? 'text-red-500 font-medium' : row.saldoDia > 0 ? 'text-emerald-600 font-medium' : 'text-[#9CA3AF]'}>
                            {row.saldoDia !== 0 ? fmt(row.saldoDia) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={row.acumulado < 0 ? 'text-red-500 font-semibold' : 'text-[#111827] font-medium'}>
                            {fmt(row.acumulado)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── ABA: CONTAS A RECEBER ─────────────────────────────────────────── */}
          {activeTab === 'receber' && (
            <div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6]">
                <select
                  value={recStatusFilter}
                  onChange={e => setRecStatusFilter(e.target.value as RecStatus | 'all')}
                  className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
                >
                  <option value="all">Todos os status</option>
                  <option value="pending">Pendente</option>
                  <option value="received">Recebido</option>
                  <option value="overdue">Atrasado</option>
                </select>
                <span className="text-xs text-[#9CA3AF]">
                  {recMesFiltradas.length} registro{recMesFiltradas.length !== 1 ? 's' : ''}
                  {' · '}
                  Total: <span className="font-medium text-[#374151]">{fmt(recMesFiltradas.reduce((s, r) => s + r.amount, 0))}</span>
                </span>
                <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors">
                  <Plus size={13} />
                  Nova Conta a Receber
                </button>
              </div>

              {loading ? (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
              ) : recMesFiltradas.length === 0 ? (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">Nenhuma conta a receber para este período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Descrição</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Cliente</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Valor</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Vencimento</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {recMesFiltradas.map(r => (
                        <tr key={r.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-4 py-3 text-[#111827] max-w-56 truncate">{r.description}</td>
                          <td className="px-4 py-3 text-[#374151]">{r.clients?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums whitespace-nowrap">{fmt(r.amount)}</td>
                          <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{fmtDate(dateKey(r.due_date))}</td>
                          <td className="px-4 py-3"><RecStatusBadge status={r.status} /></td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => refetchRec()}
                              className="text-xs px-2.5 py-1 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:text-[#3B5BDB] hover:border-[#3B5BDB] transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── ABA: CONTAS A PAGAR ───────────────────────────────────────────── */}
          {activeTab === 'pagar' && (
            <div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6]">
                <select
                  value={payStatusFilter}
                  onChange={e => setPayStatusFilter(e.target.value as PayStatus | 'all')}
                  className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
                >
                  <option value="all">Todos os status</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Atrasado</option>
                </select>
                <span className="text-xs text-[#9CA3AF]">
                  {payMesFiltradas.length} registro{payMesFiltradas.length !== 1 ? 's' : ''}
                  {' · '}
                  Total: <span className="font-medium text-[#374151]">{fmt(payMesFiltradas.reduce((s, p) => s + p.amount, 0))}</span>
                </span>
                <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors">
                  <Plus size={13} />
                  Nova Conta a Pagar
                </button>
              </div>

              {loading ? (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
              ) : payMesFiltradas.length === 0 ? (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">Nenhuma conta a pagar para este período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Descrição</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Fornecedor</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Valor</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Vencimento</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Cartão</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {payMesFiltradas.map(p => (
                        <tr key={p.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-4 py-3 text-[#111827] max-w-52 truncate">{p.description}</td>
                          <td className="px-4 py-3 text-[#374151]">{p.supplier ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-red-500 tabular-nums whitespace-nowrap">{fmt(p.amount)}</td>
                          <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{fmtDate(dateKey(p.due_date))}</td>
                          <td className="px-4 py-3 text-[#374151]">{p.fin_credit_cards?.name ?? '—'}</td>
                          <td className="px-4 py-3"><PayStatusBadge status={p.status} /></td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => refetchPay()}
                              className="text-xs px-2.5 py-1 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:text-[#3B5BDB] hover:border-[#3B5BDB] transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── ABA: DRE ──────────────────────────────────────────────────────── */}
          {activeTab === 'dre' && (
            loading ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Rubrica</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Valor</th>
                      <th className="px-4 py-2.5 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    <DreRow label="Receita Bruta"           value={dre.receitaBruta}   bold />
                    <DreRow label="Deduções"                value={-dre.deducoes}      indent />
                    <DreRow label="Receita Líquida"         value={dre.receitaLiquida} bold separator />
                    <DreRow label="CMV"                     value={-dre.cmv}           indent />
                    <DreRow label="Lucro Bruto"             value={dre.lucroBruto}     bold separator />
                    <DreRow label="Despesas Operacionais"   value={-dre.despesasOp}    indent />
                    <DreRow label="EBITDA"                  value={dre.ebitda}         bold separator />
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── ABA: DESPESAS ─────────────────────────────────────────────────── */}
          {activeTab === 'despesas' && (
            loading ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
            ) : despesasPorCategoria.entries.length === 0 ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Nenhuma despesa registrada para este período.</div>
            ) : (
              <div className="p-4 space-y-2">
                <p className="text-xs text-[#6B7280] mb-3">
                  Total de despesas: <span className="font-semibold text-[#111827]">{fmt(despesasPorCategoria.total)}</span>
                </p>
                {despesasPorCategoria.entries.map(([cat, total]) => {
                  const pct = despesasPorCategoria.total > 0
                    ? (total / despesasPorCategoria.total) * 100
                    : 0
                  return (
                    <div key={cat} className="border border-[#E5E7EB] rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#374151]">{cat}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#9CA3AF]">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-semibold text-red-500 tabular-nums">{fmt(total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── ABA: PROJEÇÃO FUTURA ──────────────────────────────────────────── */}
          {activeTab === 'projecao' && (
            loading ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {projecoes.map((p, i) => (
                    <div key={i} className="border border-[#E5E7EB] rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#111827]">{p.label}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#6B7280]">Entradas previstas</span>
                          <span className="font-medium text-emerald-600 tabular-nums">{fmt(p.entradas)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#6B7280]">Saídas previstas</span>
                          <span className="font-medium text-red-500 tabular-nums">{fmt(p.saidas)}</span>
                        </div>
                        <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-sm">
                          <span className="font-semibold text-[#374151]">Saldo projetado</span>
                          <span className={`font-semibold tabular-nums ${p.saldo >= 0 ? 'text-[#3B5BDB]' : 'text-red-500'}`}>
                            {fmt(p.saldo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé com soma dos 3 meses */}
                <div className="border border-[#E5E7EB] rounded-xl px-4 py-3">
                  <div className="flex flex-wrap items-center gap-6">
                    <span className="text-sm font-semibold text-[#374151]">Consolidado 3 meses</span>
                    <div className="flex items-center gap-6 ml-auto">
                      <div className="text-right">
                        <p className="text-xs text-[#6B7280]">Entradas totais</p>
                        <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                          {fmt(projecoes.reduce((s, p) => s + p.entradas, 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6B7280]">Saídas totais</p>
                        <p className="text-sm font-semibold text-red-500 tabular-nums">
                          {fmt(projecoes.reduce((s, p) => s + p.saidas, 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6B7280]">Saldo acumulado</p>
                        {(() => {
                          const acc = projecoes.reduce((s, p) => s + p.saldo, 0)
                          return (
                            <p className={`text-sm font-semibold tabular-nums ${acc >= 0 ? 'text-[#3B5BDB]' : 'text-red-500'}`}>
                              {fmt(acc)}
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── ABA: FECHAMENTO DO DIA ────────────────────────────────────────── */}
          {activeTab === 'fechamento' && (
            loading ? (
              <div className="p-16 text-center text-sm text-[#9CA3AF]">Carregando…</div>
            ) : (
              <div className="p-4 space-y-4">

                {/* KPIs do dia */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Total Recebido Hoje</p>
                    <p className="text-lg font-semibold text-emerald-600 tabular-nums mt-1">{fmt(fechamento.totalRecebido)}</p>
                  </div>
                  <div className="border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Total Pago Hoje</p>
                    <p className="text-lg font-semibold text-red-500 tabular-nums mt-1">{fmt(fechamento.totalPago)}</p>
                  </div>
                  <div className="border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Saldo do Dia</p>
                    <p className={`text-lg font-semibold tabular-nums mt-1 ${fechamento.saldo >= 0 ? 'text-[#3B5BDB]' : 'text-red-500'}`}>
                      {fmt(fechamento.saldo)}
                    </p>
                  </div>
                </div>

                {/* Lançamentos do dia */}
                {fechamento.recHoje.length === 0 && fechamento.payHoje.length === 0 ? (
                  <div className="border border-[#E5E7EB] rounded-xl p-8 text-center text-sm text-[#9CA3AF]">
                    Nenhum lançamento para hoje ({fmtDate(today)}).
                  </div>
                ) : (
                  <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                    <p className="px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide border-b border-[#F3F4F6]">
                      Lançamentos — {fmtDate(today)}
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Descrição</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Tipo</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Valor</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fechamento.recHoje.map(r => (
                          <tr key={`rec-${r.id}`} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                            <td className="px-4 py-3 text-[#111827]">{r.description}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Recebimento</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{fmt(r.amount)}</td>
                            <td className="px-4 py-3"><RecStatusBadge status={r.status} /></td>
                          </tr>
                        ))}
                        {fechamento.payHoje.map(p => (
                          <tr key={`pay-${p.id}`} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                            <td className="px-4 py-3 text-[#111827]">{p.description}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Pagamento</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-red-500 tabular-nums">{fmt(p.amount)}</td>
                            <td className="px-4 py-3"><PayStatusBadge status={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  )
}
