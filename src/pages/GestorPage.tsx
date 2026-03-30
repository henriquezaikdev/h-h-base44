import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Users, DollarSign,
  ShoppingCart, Clock, AlertTriangle, Bot, Loader2, Send,
  ChevronDown, ChevronUp, Target, Briefcase, Settings2,
  Calendar, Package, ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useGestorData, type GestorFilters } from '../hooks/useGestorData'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Progress } from '../components/ui/progress'

// Gestor sub-components
import { GestorKPICards } from '../components/gestor/GestorKPICards'
import { GestorDRE } from '../components/gestor/GestorDRE'
import { GestorComissoesTable } from '../components/gestor/GestorComissoesTable'
import { GestorEstoqueCritico } from '../components/gestor/GestorEstoqueCritico'

const CID = '00000000-0000-0000-0000-000000000001'
const SUPABASE_URL = 'https://hxrbytqmqvuyhsfoirao.supabase.co'
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtK = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`
  return fmt(v)
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: 'easeOut' as const },
})

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function GestorPage() {
  const { role } = useAuth()
  const nav = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [activeTab, setActiveTab] = useState('executivo')

  const filters: GestorFilters = { year, month }
  const data = useGestorData(filters)
  const periodLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  useEffect(() => { if (role && role !== 'owner') nav('/') }, [role, nav])
  if (!role || role !== 'owner') return null

  if (data.loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#3B5BDB]" />
          <span className="text-sm text-[#9CA3AF]">Carregando painel...</span>
        </motion.div>
      </div>
    )
  }

  const mainTabs = [
    { value: 'executivo', label: 'Visão Executiva', icon: BarChart3 },
    { value: 'comercial', label: 'Comercial', icon: Briefcase },
    { value: 'operacional', label: 'Operacional', icon: Settings2 },
    { value: 'estrategico', label: 'Estratégico', icon: TrendingUp },
    { value: 'relatorio-ia', label: 'Relatório IA', icon: Bot },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* ═══ HEADER (sticky) ═══ */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB]">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                  <BarChart3 size={20} className="text-[#3B5BDB]" strokeWidth={1.75} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#111827]">Painel de Gestão</h1>
                  <p className="text-xs text-[#9CA3AF] capitalize">{periodLabel}</p>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[#9CA3AF]" />
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-[#3B5BDB] text-[#374151]">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-[#3B5BDB] text-[#374151]">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-white border border-[#E5E7EB] p-1 rounded-xl mb-6 gap-1 flex-wrap">
            {mainTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-[#3B5BDB] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-[#6B7280] data-[state=inactive]:hover:text-[#111827] data-[state=inactive]:hover:bg-[#F3F4F6] transition-all">
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══ VISÃO EXECUTIVA ═══ */}
          <TabsContent value="executivo">
            <div className="space-y-6">
              <motion.div {...fadeUp(0)} className="space-y-1">
                <h2 className="text-lg font-semibold text-[#111827]">Visão Executiva</h2>
                <p className="text-sm text-[#9CA3AF]">Resumo dos indicadores principais do período</p>
              </motion.div>
              <GestorKPICards kpis={data.kpis} />
              <GestorDRE kpis={data.kpis} />
              <GestorEstoqueCritico products={data.criticalProducts} />
              <GestorComissoesTable items={data.sellersResult} />
            </div>
          </TabsContent>

          {/* ═══ COMERCIAL ═══ */}
          <TabsContent value="comercial">
            <ComercialTab data={data} month={month} year={year} />
          </TabsContent>

          {/* ═══ OPERACIONAL ═══ */}
          <TabsContent value="operacional">
            <OperacionalTab data={data} />
          </TabsContent>

          {/* ═══ ESTRATÉGICO ═══ */}
          <TabsContent value="estrategico">
            <EstrategicoTab />
          </TabsContent>

          {/* ═══ RELATÓRIO IA ═══ */}
          <TabsContent value="relatorio-ia">
            <RelatorioIATab data={data} periodLabel={periodLabel} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   COMERCIAL TAB (6 sub-abas)
   ═══════════════════════════════════════════════════════════════════ */

function ComercialTab({ data, month, year }: { data: ReturnType<typeof useGestorData>; month: number; year: number }) {
  const { approved, sellersResult, clients, goals } = data

  // Status counts
  const statusCounts = new Map<string, number>()
  data.orders.forEach(o => statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1))

  // Daily sales
  const dailySales = new Map<string, number>()
  approved.forEach(o => {
    const d = String(o.approved_at ?? o.created_at).replace(' ', 'T').slice(0, 10)
    dailySales.set(d, (dailySales.get(d) ?? 0) + (o.total ?? 0))
  })
  const dailyEntries = [...dailySales.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  // Inactive
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const inactiveClients = clients
    .filter(c => c.status === 'inactive' || (c.last_order_at && c.last_order_at < sixtyDaysAgo))
    .sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0))

  // Priority queue
  const priorityClients = clients
    .filter(c => (c.priority_score ?? 0) > 0)
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, 20)

  // Top clients in period
  const clientRevenue = new Map<string, number>()
  approved.forEach(o => clientRevenue.set(o.client_id, (clientRevenue.get(o.client_id) ?? 0) + (o.total ?? 0)))
  const clientMap = new Map(clients.map(c => [c.id, c.name]))
  const topClients = [...clientRevenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, rev]) => ({ id, name: clientMap.get(id) ?? 'Desconhecido', revenue: rev }))

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp(0)} className="space-y-1">
        <h2 className="text-lg font-semibold text-[#111827]">Comercial</h2>
        <p className="text-sm text-[#9CA3AF]">Vendedores, clientes e metas comerciais</p>
      </motion.div>

      <Tabs defaultValue="vendedores">
        <TabsList className="bg-white border border-[#E5E7EB] p-0.5 rounded-lg gap-0.5">
          <TabsTrigger value="vendedores" className="text-xs gap-1"><Users size={12} /> Vendedores</TabsTrigger>
          <TabsTrigger value="fila" className="text-xs gap-1"><Target size={12} /> Fila Comercial</TabsTrigger>
          <TabsTrigger value="clientes" className="text-xs gap-1"><Users size={12} /> Top Clientes</TabsTrigger>
          <TabsTrigger value="metas" className="text-xs gap-1"><TrendingUp size={12} /> Metas</TabsTrigger>
          <TabsTrigger value="diario" className="text-xs gap-1"><BarChart3 size={12} /> Vendas Diárias</TabsTrigger>
          <TabsTrigger value="inativos" className="text-xs gap-1"><AlertTriangle size={12} /> Inativos</TabsTrigger>
        </TabsList>

        {/* Vendedores */}
        <TabsContent value="vendedores">
          <div className="space-y-6 mt-4">
            {/* Saúde do Negócio — Summary KPIs */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Receita', value: fmt(data.kpis.revenue), accent: 'bg-white border-[#E5E7EB]' },
                { label: 'Resultado Real', value: fmt(data.kpis.profit - data.kpis.totalComissao), accent: (data.kpis.profit - data.kpis.totalComissao) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' },
                { label: 'Margem Média', value: `${data.kpis.marginPercent.toFixed(1)}%`, accent: 'bg-white border-[#E5E7EB]' },
                { label: 'Vendedores', value: String(sellersResult.filter(s => s.revenue > 0).length), accent: 'bg-white border-[#E5E7EB]' },
                { label: 'Pedidos', value: String(data.kpis.ordersCount), accent: 'bg-white border-[#E5E7EB]' },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border ${k.accent} p-4`}>
                  <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide">{k.label}</p>
                  <p className="text-lg font-bold text-[#111827] mt-1 tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Seller Cards */}
            <div className="grid grid-cols-3 gap-4">
              {sellersResult.filter(s => s.revenue > 0 || s.salesTarget > 0).map((s, i) => {
                const initials = s.name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
                const status = s.goalPercent >= 100 ? 'ESCALAR' : s.goalPercent >= 70 ? 'NO CAMINHO' : s.salesTarget > 0 ? 'RISCO' : null
                const statusColor = status === 'ESCALAR' ? 'bg-emerald-100 text-emerald-700' : status === 'NO CAMINHO' ? 'bg-amber-100 text-amber-700' : status === 'RISCO' ? 'bg-rose-100 text-rose-600' : ''

                return (
                  <motion.div key={s.id} {...fadeUp(i * 0.05)}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#D1D5DB] hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#EEF2FF] flex items-center justify-center text-xs font-bold text-[#3B5BDB]">{initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111827] truncate">{s.name}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{s.ordersCount} pedidos · {s.clientsCount} clientes</p>
                        </div>
                      </div>
                      {status && <span className={`text-[9px] font-bold px-2 py-1 rounded-md ${statusColor}`}>{status}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Faturado</p>
                        <p className="text-lg font-bold text-[#111827] tabular-nums">{fmtK(s.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Margem</p>
                        <p className={`text-lg font-bold tabular-nums ${s.marginBruta >= 30 ? 'text-emerald-600' : s.marginBruta >= 15 ? 'text-amber-600' : 'text-rose-600'}`}>{s.marginBruta.toFixed(1)}%</p>
                      </div>
                    </div>

                    {s.salesTarget > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#9CA3AF]">Eficiência de Meta</span>
                          <span className={`text-[10px] font-bold ${s.goalPercent >= 100 ? 'text-emerald-600' : s.goalPercent >= 70 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(s.goalPercent)}%</span>
                        </div>
                        <Progress value={Math.min(s.goalPercent, 100)} className={`h-2 ${s.goalPercent >= 100 ? '[&>div]:bg-emerald-500' : s.goalPercent >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-400'}`} />
                        <p className="text-[10px] text-[#9CA3AF] mt-1">Meta: {fmtK(s.salesTarget)}</p>
                      </div>
                    ) : <p className="text-[10px] text-[#D1D5DB]">Meta não configurada</p>}
                  </motion.div>
                )
              })}
              {sellersResult.length === 0 && <p className="col-span-3 py-12 text-center text-sm text-[#9CA3AF]">Nenhum vendedor com vendas</p>}
            </div>

            {/* Resultado Real por Vendedor */}
            <motion.div {...fadeUp(0.3)} className="bg-white rounded-xl border border-[#E5E7EB]">
              <div className="px-6 py-4 border-b border-[#F3F4F6]">
                <h3 className="text-sm font-semibold text-[#111827]">Resultado Real por Vendedor</h3>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Quanto cada vendedor vendeu, margem e comissão</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    <th className="text-left px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">#</th>
                    <th className="text-left px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Vendedor</th>
                    <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Faturamento</th>
                    <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Margem Bruta</th>
                    <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Comissão</th>
                    <th className="text-right px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {sellersResult.filter(s => s.revenue > 0).map((s, i) => {
                    const resultado = s.revenue - (s.revenue * (100 - s.marginBruta) / 100) - s.comissaoReal
                    return (
                      <tr key={s.id} className="hover:bg-[#FAFAF9] transition-colors">
                        <td className="px-6 py-3 text-[#9CA3AF] text-xs">{i + 1}.</td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{s.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#374151]">{fmt(s.revenue)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${s.marginBruta >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>{s.marginBruta.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#374151]">{fmt(s.comissaoReal)}</td>
                        <td className={`px-6 py-3 text-right tabular-nums font-bold ${resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(resultado)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </motion.div>
          </div>
        </TabsContent>

        {/* Fila Comercial */}
        <TabsContent value="fila">
          <div className="bg-white rounded-xl border border-[#E5E7EB] mt-4">
            <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">Fila Comercial — Top 20</h3>
              <span className="text-[10px] text-[#9CA3AF]">Ordenado por priority_score</span>
            </div>
            {priorityClients.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#9CA3AF]">Nenhum cliente com score de prioridade</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {priorityClients.map((c, i) => (
                  <div key={c.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[#FAFAF9] transition-colors">
                    <span className="w-6 h-6 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[10px] font-bold text-[#6B7280]">{i + 1}</span>
                    <span className="text-sm text-[#111827] flex-1 truncate">{c.name}</span>
                    <div className="w-11 h-7 rounded-md bg-[#3B5BDB] flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-white tabular-nums">{Math.round(c.priority_score ?? 0)}</span>
                    </div>
                    <span className="text-xs text-[#9CA3AF] tabular-nums w-24 text-right">{fmt(c.total_revenue ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Top Clientes */}
        <TabsContent value="clientes">
          <div className="bg-white rounded-xl border border-[#E5E7EB] mt-4">
            <div className="px-6 py-4 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-semibold text-[#111827]">Top 20 Clientes no Período</h3>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">Receita acumulada no mês selecionado</p>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {topClients.map((c, i) => (
                <div key={c.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[#FAFAF9] transition-colors">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? 'bg-[#EEF2FF] text-[#3B5BDB]' : i < 3 ? 'bg-amber-50 text-amber-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                  }`}>{i + 1}</span>
                  <span className="text-sm text-[#111827] flex-1 truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-[#111827] tabular-nums">{fmt(c.revenue)}</span>
                </div>
              ))}
              {topClients.length === 0 && <p className="py-12 text-center text-sm text-[#9CA3AF]">Sem vendas no período</p>}
            </div>
          </div>
        </TabsContent>

        {/* Metas */}
        <TabsContent value="metas">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mt-4">
            <h3 className="text-sm font-semibold text-[#111827] mb-4">Metas do Mês — {MONTHS[month]}/{year}</h3>
            {goals.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-12">Nenhuma meta configurada</p>
            ) : (
              <div className="space-y-4">
                {sellersResult.filter(s => s.salesTarget > 0).map(s => (
                  <div key={s.id} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-[#111827] w-36 truncate">{s.name}</span>
                    <div className="flex-1">
                      <Progress value={s.goalPercent} className={`h-3 rounded-lg ${s.goalPercent >= 100 ? '[&>div]:bg-emerald-500' : s.goalPercent >= 70 ? '[&>div]:bg-[#3B5BDB]' : '[&>div]:bg-amber-500'}`} />
                    </div>
                    <div className="text-right w-48 shrink-0">
                      <span className="text-sm font-semibold text-[#111827] tabular-nums">{fmt(s.revenue)}</span>
                      <span className="text-xs text-[#9CA3AF]"> / {fmt(s.salesTarget)}</span>
                      <span className={`ml-2 text-xs font-bold ${s.goalPercent >= 100 ? 'text-emerald-600' : 'text-[#6B7280]'}`}>{Math.round(s.goalPercent)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Vendas Diárias */}
        <TabsContent value="diario">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mt-4">
            <h3 className="text-sm font-semibold text-[#111827] mb-5">Vendas por Dia</h3>
            {dailyEntries.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-12">Sem vendas no período</p>
            ) : (
              <div className="space-y-2">
                {dailyEntries.map(([day, total], i) => {
                  const max = Math.max(...dailyEntries.map(e => e[1]))
                  const pct = max > 0 ? (total / max) * 100 : 0
                  return (
                    <motion.div key={day} {...fadeUp(i * 0.03)} className="flex items-center gap-3 group">
                      <span className="text-xs text-[#6B7280] w-14 shrink-0 tabular-nums">
                        {new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <div className="flex-1 h-7 bg-[#F3F4F6] rounded-lg overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.03, ease: 'easeOut' }}
                          className="h-full bg-[#3B5BDB] rounded-lg group-hover:bg-[#3451C7] transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-[#111827] w-24 text-right tabular-nums">{fmt(total)}</span>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Inativos */}
        <TabsContent value="inativos">
          <div className="bg-white rounded-xl border border-[#E5E7EB] mt-4">
            <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle size={14} className="text-red-500" />
                </div>
                <h3 className="text-sm font-semibold text-[#111827]">Inativos ({inactiveClients.length})</h3>
              </div>
              <span className="text-[10px] text-[#9CA3AF]">Sem pedido há 60+ dias</span>
            </div>
            {inactiveClients.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#9CA3AF]">Nenhum cliente inativo</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6] max-h-[500px] overflow-y-auto">
                {inactiveClients.slice(0, 50).map((c) => {
                  const days = c.last_order_at
                    ? Math.floor((Date.now() - new Date(String(c.last_order_at).replace(' ', 'T')).getTime()) / 86_400_000)
                    : null
                  return (
                    <div key={c.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-[#FAFAF9] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{c.name}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                          {c.last_order_at ? `Último: ${new Date(String(c.last_order_at).replace(' ', 'T')).toLocaleDateString('pt-BR')}` : 'Nunca comprou'}
                        </p>
                      </div>
                      {days !== null && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md shrink-0 ${
                          days > 120 ? 'bg-red-50 text-red-600' : days > 90 ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          <Clock size={11} />
                          <span className="text-[11px] font-semibold tabular-nums">{days}d</span>
                        </div>
                      )}
                      <span className="text-sm font-semibold text-[#111827] tabular-nums shrink-0">{fmt(c.total_revenue ?? 0)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   OPERACIONAL TAB
   ═══════════════════════════════════════════════════════════════════ */

function OperacionalTab({ data }: { data: ReturnType<typeof useGestorData> }) {
  const { sellersResult, kpis } = data
  const activeSellers = sellersResult.filter(s => s.revenue > 0)

  // Rankings
  const byRevenue = [...activeSellers].sort((a, b) => b.revenue - a.revenue)
  const byMargin = [...activeSellers].sort((a, b) => b.marginBruta - a.marginBruta)
  const byClients = [...activeSellers].sort((a, b) => b.clientsCount - a.clientsCount)

  // Alerts
  const lowMargin = activeSellers.filter(s => s.marginBruta < 20)
  const noGoal = activeSellers.filter(s => s.salesTarget === 0)

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp(0)} className="space-y-1">
        <h2 className="text-lg font-semibold text-[#111827]">Operacional</h2>
        <p className="text-sm text-[#9CA3AF]">Performance, rankings e alertas de gestão</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Vendedores Ativos', value: String(activeSellers.length), icon: Users, bg: 'bg-[#EEF2FF]', color: 'text-[#3B5BDB]' },
          { label: 'Pedidos no Mês', value: String(kpis.ordersCount), icon: ShoppingCart, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Ticket Médio', value: fmt(kpis.avgTicket), icon: DollarSign, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'NF-e Emitidas', value: String(kpis.invoicedCount), icon: Package, bg: 'bg-violet-50', color: 'text-violet-600' },
        ].map((c, i) => (
          <motion.div key={c.label} {...fadeUp(i * 0.05)}
            className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-semibold text-[#111827] mt-1.5 tabular-nums">{c.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
              <c.icon size={18} className={c.color} strokeWidth={1.75} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Top Performers — 3 rankings */}
      <motion.div {...fadeUp(0.15)}>
        <h3 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
          <Target size={14} className="text-[#3B5BDB]" /> Top Performers
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Receita', data: byRevenue.slice(0, 3), render: (s: typeof byRevenue[0]) => fmt(s.revenue) },
            { title: 'Margem', data: byMargin.slice(0, 3), render: (s: typeof byMargin[0]) => `${s.marginBruta.toFixed(1)}%` },
            { title: 'Clientes', data: byClients.slice(0, 3), render: (s: typeof byClients[0]) => String(s.clientsCount) },
          ].map(r => (
            <div key={r.title} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-3">{r.title}</p>
              <div className="space-y-2.5">
                {r.data.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-orange-50 text-orange-600'
                    }`}>{i + 1}</span>
                    <span className="text-sm text-[#111827] flex-1 truncate">{s.name}</span>
                    <span className="text-sm font-semibold text-[#111827] tabular-nums">{r.render(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Alertas de Gestão */}
      {(lowMargin.length > 0 || noGoal.length > 0) && (
        <motion.div {...fadeUp(0.2)} className="space-y-2">
          <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" /> Alertas de Gestão
          </h3>
          {lowMargin.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                {lowMargin.length} vendedor(es) com margem abaixo de 20%: {lowMargin.map(s => s.name).join(', ')}
              </p>
            </div>
          )}
          {noGoal.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
              <Target size={14} className="text-rose-600 shrink-0" />
              <p className="text-sm text-rose-800">
                {noGoal.length} vendedor(es) sem meta configurada: {noGoal.map(s => s.name).join(', ')}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Performance table */}
      <motion.div {...fadeUp(0.25)} className="bg-white rounded-xl border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-sm font-semibold text-[#111827]">Performance por Vendedor</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              <th className="text-left px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Vendedor</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Pedidos</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Faturamento</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Ticket Médio</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Clientes</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase">Margem %</th>
              <th className="px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase w-24">% Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F9FAFB]">
            {activeSellers.map(s => (
              <tr key={s.id} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-6 py-3 font-medium text-[#111827]">{s.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#374151]">{s.ordersCount}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#111827]">{fmt(s.revenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#374151]">{fmt(s.avgTicket)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#374151]">{s.clientsCount}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${s.marginBruta >= 30 ? 'text-emerald-600' : s.marginBruta >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{s.marginBruta.toFixed(1)}%</td>
                <td className="px-6 py-3">
                  {s.salesTarget > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Progress value={s.goalPercent} className="flex-1 h-1.5 [&>div]:bg-[#3B5BDB]" />
                      <span className="text-[10px] text-[#6B7280] tabular-nums">{Math.round(s.goalPercent)}%</span>
                    </div>
                  ) : <span className="text-[10px] text-[#D1D5DB]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   ESTRATÉGICO TAB (placeholder)
   ═══════════════════════════════════════════════════════════════════ */

function EstrategicoTab() {
  return (
    <motion.div {...fadeUp(0)}
      className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
        <TrendingUp size={28} className="text-[#3B5BDB]" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-[#111827] mb-2">Estratégico</h3>
      <p className="text-sm text-[#9CA3AF] max-w-md">
        Simulações, projeções e análises estratégicas. Este módulo será construído na próxima fase do sistema.
      </p>
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[#3B5BDB] font-medium bg-[#EEF2FF] px-3 py-1.5 rounded-full">
        <ArrowUpRight size={12} />
        Em breve
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   RELATÓRIO IA TAB
   ═══════════════════════════════════════════════════════════════════ */

function RelatorioIATab({ data, periodLabel }: { data: ReturnType<typeof useGestorData>; periodLabel: string }) {
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [expanded, setExpanded] = useState(false)

  const context = useMemo(() => {
    const { kpis, sellersResult, clients, payables } = data
    const pendentes = payables.filter(p => p.status === 'pendente')
    const totalPendente = pendentes.reduce((s, p) => s + (p.amount ?? 0), 0)
    const inactiveCount = clients.filter(c => c.status === 'inactive').length
    const sellerLines = sellersResult.filter(s => s.revenue > 0).map(s =>
      `- ${s.name}: ${fmt(s.revenue)} (margem ${s.marginBruta.toFixed(1)}%, ${s.ordersCount} pedidos)`
    ).join('\n')

    return `Período: ${periodLabel}

COMERCIAL:
- Receita: ${fmt(kpis.revenue)}
- CMV: ${fmt(kpis.totalCMV)}
- Margem bruta: ${kpis.marginPercent.toFixed(1)}%
- Pedidos: ${kpis.ordersCount}
- Ticket médio: ${fmt(kpis.avgTicket)}
- Clientes ativos: ${kpis.activeClients}
- Clientes inativos: ${inactiveCount}

VENDEDORES:
${sellerLines || 'Sem vendas'}

FINANCEIRO:
- Contas a pagar: ${fmt(totalPendente)} (${pendentes.length} contas)
- Comissões: ${fmt(kpis.totalComissao)}`
  }, [data, periodLabel])

  async function generateReport() {
    setLoading(true)
    setReport('')
    try {
      const prompt = customPrompt || 'Execute um diagnóstico estratégico completo. Analise comercial, financeiro e operacional. Estruture em: PONTOS POSITIVOS, ALERTAS CRÍTICOS e RECOMENDAÇÕES. Seja direto e prático.'

      const res = await fetch(`${SUPABASE_URL}/functions/v1/assistente-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: CID, messages: [{ role: 'user', content: `${prompt}\n\n${context}` }] }),
      })

      if (!res.ok) { setReport('Erro ao gerar relatório.'); return }
      const json = await res.json()
      setReport(json.response ?? json.content ?? JSON.stringify(json))
    } catch (err) {
      setReport(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp(0)} className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[#111827] flex items-center gap-2">
            <Bot size={18} className="text-[#3B5BDB]" />
            Agente Estratégico IA
          </h2>
          <p className="text-sm text-[#9CA3AF]">Análise global com acesso a todos os dados do período</p>
        </div>
        <div className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-3 py-1.5 rounded-lg capitalize">
          {periodLabel}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div {...fadeUp(0.05)} className="flex gap-3">
        <button onClick={generateReport} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {loading ? 'Gerando...' : 'Rodar Diagnóstico Estratégico'}
        </button>
      </motion.div>

      {/* Context */}
      <motion.div {...fadeUp(0.1)} className="bg-white rounded-xl border border-[#E5E7EB]">
        <button onClick={() => setExpanded(p => !p)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium text-[#6B7280] hover:bg-[#FAFAF9] transition-colors rounded-xl">
          <span className="flex items-center gap-2">
            <Package size={14} className="text-[#9CA3AF]" /> Dados enviados para IA
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {expanded && (
          <div className="px-6 pb-5">
            <pre className="text-xs text-[#6B7280] bg-[#F9FAFB] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap border border-[#F3F4F6]">{context}</pre>
          </div>
        )}
      </motion.div>

      {/* Custom question */}
      <motion.div {...fadeUp(0.15)} className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex gap-3">
          <input type="text" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Pergunte algo específico ou deixe em branco para diagnóstico completo..."
            onKeyDown={e => e.key === 'Enter' && generateReport()}
            className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white" />
          <button onClick={generateReport} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-[#111827] text-white rounded-lg hover:bg-[#374151] disabled:opacity-50 transition-colors">
            <Send size={14} />
          </button>
        </div>
      </motion.div>

      {/* Report */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
            <Bot size={14} className="text-[#3B5BDB]" />
            Resultado
          </h3>
          <div className="prose prose-sm max-w-none text-[#374151] whitespace-pre-wrap leading-relaxed">{report}</div>
        </motion.div>
      )}
    </div>
  )
}
