import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, TrendingUp, Users, DollarSign, FileText,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Package,
  Clock, AlertTriangle, CheckCircle2, Bot, Loader2, Send,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

const CID = '00000000-0000-0000-0000-000000000001'
const SUPABASE_URL = 'https://hxrbytqmqvuyhsfoirao.supabase.co'

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

interface Order {
  id: string
  total: number
  status: string
  seller_id: string
  client_id: string
  created_at: string
  nfe_status: string | null
}

interface Seller {
  id: string
  name: string
  role: string
  is_sales_active: boolean
}

interface Client {
  id: string
  name: string
  status: string
  last_order_at: string | null
  total_revenue: number
}

interface Payable {
  id: string
  description: string
  amount: number
  due_date: string
  status: string
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCompact(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}K`
  return fmt(v)
}

function getMonthRange(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const y = d.getFullYear()
  const m = d.getMonth()
  const start = new Date(y, m, 1).toISOString()
  const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString()
  return { start, end, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

/* ═══════════════════════════════════════════════════════════════════
   DATA HOOK
   ═══════════════════════════════════════════════════════════════════ */

function useGestorData() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [prevOrders, setPrevOrders] = useState<Order[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [payables, setPayables] = useState<Payable[]>([])

  const load = useCallback(async () => {
    const curr = getMonthRange(0)
    const prev = getMonthRange(-1)

    const [ordersRes, prevOrdersRes, sellersRes, clientsRes, payablesRes] = await Promise.all([
      supabase.from('orders').select('id, total, status, seller_id, client_id, created_at, nfe_status')
        .eq('company_id', CID).gte('created_at', curr.start).lte('created_at', curr.end),
      supabase.from('orders').select('id, total, status, seller_id, client_id, created_at, nfe_status')
        .eq('company_id', CID).gte('created_at', prev.start).lte('created_at', prev.end),
      supabase.from('sellers').select('id, name, role, is_sales_active').eq('company_id', CID).eq('active', true),
      supabase.from('clients').select('id, name, status, last_order_at, total_revenue')
        .eq('company_id', CID).order('total_revenue', { ascending: false }).limit(500),
      supabase.from('fin_payables').select('id, description, amount, due_date, status')
        .eq('company_id', CID).order('due_date'),
    ])

    setOrders(ordersRes.data ?? [])
    setPrevOrders(prevOrdersRes.data ?? [])
    setSellers(sellersRes.data ?? [])
    setClients(clientsRes.data ?? [])
    setPayables(payablesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { loading, orders, prevOrders, sellers, clients, payables, refetch: load }
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function GestorPage() {
  const { role } = useAuth()
  const nav = useNavigate()

  useEffect(() => { if (role && role !== 'owner') nav('/') }, [role, nav])
  if (!role || role !== 'owner') return null

  const data = useGestorData()

  if (data.loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#9CA3AF]">Carregando painel...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1120px] mx-auto px-6 py-5">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-[#9CA3AF]" strokeWidth={1.75} />
            <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Painel do Gestor</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">{getMonthRange(0).label}</p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-6 py-6">
        <Tabs defaultValue="executivo">
          <TabsList className="bg-[#F3F4F6] p-0.5 rounded-lg mb-6">
            <TabsTrigger value="executivo" className="text-xs gap-1.5"><BarChart3 size={13} /> Visão Executiva</TabsTrigger>
            <TabsTrigger value="comercial" className="text-xs gap-1.5"><TrendingUp size={13} /> Comercial</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs gap-1.5"><DollarSign size={13} /> Financeiro</TabsTrigger>
            <TabsTrigger value="relatorio-ia" className="text-xs gap-1.5"><Bot size={13} /> Relatório IA</TabsTrigger>
          </TabsList>

          <TabsContent value="executivo"><VisaoExecutiva {...data} /></TabsContent>
          <TabsContent value="comercial"><Comercial {...data} /></TabsContent>
          <TabsContent value="financeiro"><Financeiro payables={data.payables} /></TabsContent>
          <TabsContent value="relatorio-ia"><RelatorioIA {...data} /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   VISÃO EXECUTIVA
   ═══════════════════════════════════════════════════════════════════ */

function VisaoExecutiva({ orders, prevOrders, sellers, clients }: {
  orders: Order[]; prevOrders: Order[]; sellers: Seller[]; clients: Client[]
}) {
  const approved = orders.filter(o => o.status !== 'cancelled')
  const prevApproved = prevOrders.filter(o => o.status !== 'cancelled')

  const revenue = approved.reduce((s, o) => s + (o.total ?? 0), 0)
  const prevRevenue = prevApproved.reduce((s, o) => s + (o.total ?? 0), 0)
  const revDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

  const ticketMedio = approved.length > 0 ? revenue / approved.length : 0
  const prevTicket = prevApproved.length > 0 ? prevRevenue / prevApproved.length : 0
  const ticketDelta = prevTicket > 0 ? ((ticketMedio - prevTicket) / prevTicket) * 100 : 0

  const activeClients = new Set(approved.map(o => o.client_id)).size
  const prevActiveClients = new Set(prevApproved.map(o => o.client_id)).size
  const clientDelta = prevActiveClients > 0 ? ((activeClients - prevActiveClients) / prevActiveClients) * 100 : 0

  const invoiced = approved.filter(o => o.nfe_status === 'autorizada').length

  const cards = [
    { label: 'Faturamento', value: fmtCompact(revenue), delta: revDelta, icon: DollarSign },
    { label: 'Pedidos', value: String(approved.length), delta: prevApproved.length > 0 ? ((approved.length - prevApproved.length) / prevApproved.length) * 100 : 0, icon: ShoppingCart },
    { label: 'Ticket Médio', value: fmt(ticketMedio), delta: ticketDelta, icon: TrendingUp },
    { label: 'Clientes Ativos', value: String(activeClients), delta: clientDelta, icon: Users },
    { label: 'NF-e Emitidas', value: String(invoiced), delta: null, icon: FileText },
  ]

  // Top sellers
  const salesBySeller = new Map<string, number>()
  approved.forEach(o => salesBySeller.set(o.seller_id, (salesBySeller.get(o.seller_id) ?? 0) + (o.total ?? 0)))
  const activeSellers = sellers.filter(s => s.is_sales_active || s.role === 'seller')
  const ranking = activeSellers
    .map(s => ({ ...s, total: salesBySeller.get(s.id) ?? 0 }))
    .sort((a, b) => b.total - a.total)

  // Top clients
  const topClients = clients.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#9CA3AF] font-medium">{c.label}</span>
              <c.icon size={14} className="text-[#D1D5DB]" />
            </div>
            <p className="text-lg font-semibold text-[#111827] tabular-nums">{c.value}</p>
            {c.delta !== null && (
              <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${c.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {c.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(c.delta).toFixed(1)}% vs mês anterior
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Ranking Vendedores */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">Ranking Vendedores</h3>
          <div className="space-y-3">
            {ranking.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                }`}>{i + 1}</span>
                <span className="text-sm text-[#111827] flex-1 truncate">{s.name}</span>
                <span className="text-sm font-semibold text-[#111827] tabular-nums">{fmt(s.total)}</span>
              </div>
            ))}
            {ranking.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">Sem vendas no período</p>}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">Top Clientes (Receita Total)</h3>
          <div className="space-y-3">
            {topClients.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                }`}>{i + 1}</span>
                <span className="text-sm text-[#111827] flex-1 truncate">{c.name}</span>
                <span className="text-sm font-semibold text-[#111827] tabular-nums">{fmt(c.total_revenue ?? 0)}</span>
              </div>
            ))}
            {topClients.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">Sem clientes</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   COMERCIAL (5 sub-abas)
   ═══════════════════════════════════════════════════════════════════ */

function Comercial({ orders, sellers, clients }: {
  orders: Order[]; sellers: Seller[]; clients: Client[]
}) {
  const approved = orders.filter(o => o.status !== 'cancelled')
  const activeSellers = sellers.filter(s => s.is_sales_active || s.role === 'seller')

  // Sales by seller
  const salesBySeller = new Map<string, { count: number; total: number; clients: Set<string> }>()
  approved.forEach(o => {
    const cur = salesBySeller.get(o.seller_id) ?? { count: 0, total: 0, clients: new Set<string>() }
    cur.count++
    cur.total += o.total ?? 0
    cur.clients.add(o.client_id)
    salesBySeller.set(o.seller_id, cur)
  })

  // Orders by status
  const statusCounts = new Map<string, number>()
  orders.forEach(o => statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1))

  // Daily sales
  const dailySales = new Map<string, number>()
  approved.forEach(o => {
    const day = o.created_at.replace(' ', 'T').slice(0, 10)
    dailySales.set(day, (dailySales.get(day) ?? 0) + (o.total ?? 0))
  })
  const dailyEntries = [...dailySales.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  // Inactive clients
  const now = new Date()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const inactiveClients = clients.filter(c =>
    c.status === 'inactive' || (c.last_order_at && c.last_order_at < sixtyDaysAgo)
  )

  return (
    <Tabs defaultValue="resumo">
      <TabsList className="bg-white border border-[#E5E7EB] p-0.5 rounded-lg mb-5">
        <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
        <TabsTrigger value="vendedores" className="text-xs">Vendedores</TabsTrigger>
        <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
        <TabsTrigger value="diario" className="text-xs">Vendas Diárias</TabsTrigger>
        <TabsTrigger value="inativos" className="text-xs">Inativos</TabsTrigger>
      </TabsList>

      {/* Resumo */}
      <TabsContent value="resumo">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Pedidos do Mês" value={String(approved.length)} icon={ShoppingCart} />
          <StatCard label="Faturamento" value={fmtCompact(approved.reduce((s, o) => s + (o.total ?? 0), 0))} icon={DollarSign} />
          <StatCard label="Clientes Atendidos" value={String(new Set(approved.map(o => o.client_id)).size)} icon={Users} />
        </div>
        <div className="mt-4 bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">Status dos Pedidos</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'created', label: 'Novos', color: 'bg-blue-50 text-blue-700' },
              { key: 'approved', label: 'Aprovados', color: 'bg-emerald-50 text-emerald-700' },
              { key: 'invoiced', label: 'Faturados', color: 'bg-[#EEF2FF] text-[#3B5BDB]' },
              { key: 'cancelled', label: 'Cancelados', color: 'bg-red-50 text-red-600' },
            ].map(s => (
              <div key={s.key} className={`rounded-lg p-3 ${s.color}`}>
                <p className="text-2xl font-bold tabular-nums">{statusCounts.get(s.key) ?? 0}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* Vendedores */}
      <TabsContent value="vendedores">
        <div className="bg-white rounded-xl border border-[#E5E7EB]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Vendedor</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Pedidos</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Faturamento</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Ticket Médio</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Clientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {activeSellers.map(s => {
                const d = salesBySeller.get(s.id)
                const count = d?.count ?? 0
                const total = d?.total ?? 0
                const ticket = count > 0 ? total / count : 0
                return (
                  <tr key={s.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3 font-medium text-[#111827]">{s.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{count}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{fmt(total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{fmt(ticket)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{d?.clients.size ?? 0}</td>
                  </tr>
                )
              })}
              {activeSellers.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-[#9CA3AF]">Nenhum vendedor ativo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* Pedidos */}
      <TabsContent value="pedidos">
        <div className="bg-white rounded-xl border border-[#E5E7EB]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Quantidade</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase">Total (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {['created', 'approved', 'picked', 'delivered', 'invoiced', 'cancelled'].map(st => {
                const filtered = orders.filter(o => o.status === st)
                if (filtered.length === 0) return null
                return (
                  <tr key={st} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        st === 'cancelled' ? 'bg-red-50 text-red-600' :
                        st === 'delivered' || st === 'invoiced' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-[#EEF2FF] text-[#3B5BDB]'
                      }`}>{st}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{filtered.length}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#374151]">{fmt(filtered.reduce((s, o) => s + (o.total ?? 0), 0))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* Vendas Diárias */}
      <TabsContent value="diario">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">Vendas por Dia</h3>
          {dailyEntries.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">Sem vendas no período</p>
          ) : (
            <div className="space-y-2">
              {dailyEntries.map(([day, total]) => {
                const max = Math.max(...dailyEntries.map(e => e[1]))
                const pct = max > 0 ? (total / max) * 100 : 0
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-xs text-[#6B7280] w-20 shrink-0 tabular-nums">
                      {new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <div className="flex-1 h-6 bg-[#F3F4F6] rounded overflow-hidden">
                      <div className="h-full bg-[#3B5BDB] rounded transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-[#111827] w-24 text-right tabular-nums">{fmt(total)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Inativos */}
      <TabsContent value="inativos">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#111827]">Clientes Inativos ({inactiveClients.length})</h3>
            <span className="text-xs text-[#9CA3AF]">Sem pedido há 60+ dias</span>
          </div>
          {inactiveClients.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">Nenhum cliente inativo</p>
          ) : (
            <div className="divide-y divide-[#F3F4F6] max-h-[400px] overflow-y-auto">
              {inactiveClients.slice(0, 50).map(c => (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-sm text-[#111827] flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-[#9CA3AF] tabular-nums">
                    {c.last_order_at ? `Último: ${new Date(c.last_order_at.replace(' ', 'T')).toLocaleDateString('pt-BR')}` : 'Nunca comprou'}
                  </span>
                  <span className="text-xs font-medium text-[#374151] tabular-nums">{fmt(c.total_revenue ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   FINANCEIRO
   ═══════════════════════════════════════════════════════════════════ */

function Financeiro({ payables }: { payables: Payable[] }) {
  const today = new Date().toISOString().slice(0, 10)

  const pendentes = payables.filter(p => p.status === 'pendente')
  const pagas = payables.filter(p => p.status !== 'pendente')
  const vencidas = pendentes.filter(p => p.due_date < today)
  const aVencer = pendentes.filter(p => p.due_date >= today)

  const totalPendente = pendentes.reduce((s, p) => s + (p.amount ?? 0), 0)
  const totalVencido = vencidas.reduce((s, p) => s + (p.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Pendente" value={fmt(totalPendente)} icon={Clock} accent={totalPendente > 0} />
        <StatCard label="Vencido" value={fmt(totalVencido)} icon={AlertTriangle} accent={totalVencido > 0} negative />
        <StatCard label="Contas Pagas" value={String(pagas.length)} icon={CheckCircle2} />
      </div>

      {/* Vencidas */}
      {vencidas.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Contas Vencidas ({vencidas.length})
          </h3>
          <PayableTable items={vencidas} />
        </div>
      )}

      {/* A vencer */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h3 className="text-sm font-semibold text-[#111827] mb-3">A Vencer ({aVencer.length})</h3>
        {aVencer.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">Nenhuma conta a vencer</p>
        ) : (
          <PayableTable items={aVencer} />
        )}
      </div>

      {/* Pagas */}
      {pagas.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">Pagas ({pagas.length})</h3>
          <PayableTable items={pagas} />
        </div>
      )}
    </div>
  )
}

function PayableTable({ items }: { items: Payable[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#E5E7EB]">
          <th className="text-left py-2 text-xs font-medium text-[#6B7280]">Descrição</th>
          <th className="text-right py-2 text-xs font-medium text-[#6B7280]">Valor</th>
          <th className="text-right py-2 text-xs font-medium text-[#6B7280]">Vencimento</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#F3F4F6]">
        {items.map(p => (
          <tr key={p.id} className="hover:bg-[#FAFAF9] transition-colors">
            <td className="py-2 text-[#111827] truncate max-w-[300px]">{p.description}</td>
            <td className="py-2 text-right tabular-nums font-medium text-[#111827]">{fmt(p.amount)}</td>
            <td className="py-2 text-right tabular-nums text-[#6B7280]">
              {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   RELATÓRIO IA
   ═══════════════════════════════════════════════════════════════════ */

function RelatorioIA({ orders, sellers, clients, payables }: {
  orders: Order[]; sellers: Seller[]; clients: Client[]; payables: Payable[]
}) {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [expanded, setExpanded] = useState(false)

  const context = useMemo(() => {
    const approved = orders.filter(o => o.status !== 'cancelled')
    const revenue = approved.reduce((s, o) => s + (o.total ?? 0), 0)
    const activeSellers = sellers.filter(s => s.is_sales_active || s.role === 'seller')

    const salesBySeller = new Map<string, number>()
    approved.forEach(o => salesBySeller.set(o.seller_id, (salesBySeller.get(o.seller_id) ?? 0) + (o.total ?? 0)))

    const sellerLines = activeSellers.map(s =>
      `- ${s.name}: ${fmt(salesBySeller.get(s.id) ?? 0)}`
    ).join('\n')

    const pendentes = payables.filter(p => p.status === 'pendente')
    const totalPendente = pendentes.reduce((s, p) => s + (p.amount ?? 0), 0)

    const inactiveCount = clients.filter(c => c.status === 'inactive').length

    return `Dados do mês atual:
- Faturamento: ${fmt(revenue)}
- Pedidos: ${approved.length}
- Ticket médio: ${fmt(approved.length > 0 ? revenue / approved.length : 0)}
- Clientes atendidos: ${new Set(approved.map(o => o.client_id)).size}
- Clientes inativos: ${inactiveCount}
- Contas a pagar pendentes: ${fmt(totalPendente)} (${pendentes.length} contas)

Vendas por vendedor:
${sellerLines || 'Nenhum vendedor com vendas'}

Pedidos cancelados: ${orders.filter(o => o.status === 'cancelled').length}`
  }, [orders, sellers, clients, payables])

  async function generateReport() {
    setLoading(true)
    setReport('')
    try {
      const prompt = customPrompt || 'Analise os dados comerciais e financeiros do mês. Dê um panorama executivo com pontos positivos, alertas e recomendações práticas. Seja direto e objetivo, como um relatório para CEO.'

      const res = await fetch(`${SUPABASE_URL}/functions/v1/assistente-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: CID,
          messages: [
            { role: 'user', content: `${prompt}\n\n${context}` }
          ],
        }),
      })

      if (!res.ok) {
        setReport('Erro ao gerar relatório. A Edge Function assistente-cliente pode não suportar este formato. Verifique os logs.')
        return
      }

      const data = await res.json()
      setReport(data.response ?? data.content ?? JSON.stringify(data))
    } catch (err) {
      setReport(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Context preview */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center justify-between text-sm font-semibold text-[#111827]"
        >
          <span className="flex items-center gap-1.5"><Package size={14} className="text-[#9CA3AF]" /> Dados Enviados para IA</span>
          {expanded ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
        </button>
        {expanded && (
          <pre className="mt-3 text-xs text-[#6B7280] bg-[#F9FAFB] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{context}</pre>
        )}
      </div>

      {/* Prompt */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h3 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-1.5">
          <Bot size={14} className="text-[#9CA3AF]" /> Relatório com IA
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Pergunte algo específico ou deixe em branco para panorama geral..."
            className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white"
          />
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {loading ? 'Gerando...' : 'Gerar'}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">Resultado</h3>
          <div className="prose prose-sm max-w-none text-[#374151] whitespace-pre-wrap">{report}</div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED
   ═══════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, icon: Icon, accent, negative }: {
  label: string; value: string; icon: React.ElementType; accent?: boolean; negative?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${
      negative && accent ? 'border-red-200' : accent ? 'border-amber-200' : 'border-[#E5E7EB]'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#9CA3AF] font-medium">{label}</span>
        <Icon size={14} className={negative && accent ? 'text-red-400' : accent ? 'text-amber-400' : 'text-[#D1D5DB]'} />
      </div>
      <p className={`text-lg font-semibold tabular-nums ${
        negative && accent ? 'text-red-600' : 'text-[#111827]'
      }`}>{value}</p>
    </div>
  )
}
