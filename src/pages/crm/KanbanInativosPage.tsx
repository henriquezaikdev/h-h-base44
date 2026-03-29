import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Phone, MessageCircle,
  Target, Zap, TrendingUp, DollarSign, Clock, AlertTriangle,
  Plus, Calendar,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { Progress } from '../../components/ui/progress'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InactiveClient {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  seller_id: string | null
  origem: string | null
  last_order_at: string | null
  total_orders: number | null
  total_revenue: number | null
  reativacao_score: number | null
  created_at: string
  sellers: { name: string } | null
}

interface JanelaLongaClient {
  id: string
  name: string
  cnpj: string | null
  intervalo_medio_dias: number | null
  proxima_compra_estimada: string | null
  sellers: { name: string } | null
}

interface RecentOrder {
  id: string
  total: number
  created_at: string
  order_items: { products: { name: string } | null }[]
}

interface Reativacao {
  id: string
  data_reativacao: string
  valor_primeiro_pedido: number | null
}

type ReativacaoStatus = 'nao_iniciado' | 'em_contato' | 'negociando' | 'perdido'

interface QueryResult {
  inactiveClients: InactiveClient[]
  janelaLongaClients: JanelaLongaClient[]
  reativacoesMes: Reativacao[]
  atRiskCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000)
}

function fmtCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtCNPJ(v: string | null): string {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const META_MENSAL = 10

const STATUS_CFG: Record<ReativacaoStatus, { label: string; bg: string; text: string }> = {
  nao_iniciado: { label: 'Nao iniciado', bg: 'bg-gray-100', text: 'text-gray-500' },
  em_contato:   { label: 'Em contato',   bg: 'bg-amber-50', text: 'text-amber-700' },
  negociando:   { label: 'Negociando',   bg: 'bg-[#EEF2FF]', text: 'text-[#3B5BDB]' },
  perdido:      { label: 'Perdido',      bg: 'bg-red-50', text: 'text-red-600' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KanbanInativosPage() {
  const navigate = useNavigate()
  const { seller } = useAuth()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, ReativacaoStatus>>({})
  const [silencioProgramadoOpen, setSilencioProgramadoOpen] = useState(true)
  const [creatingTask, setCreatingTask] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, RecentOrder[]>>({})

  // ── Main query ──────────────────────────────────────────────────────────

  const { data, loading, refetch } = useSupabaseQuery<QueryResult>(
    async ({ company_id }) => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [inactiveRes, janelaRes, reativacoesRes, atRiskRes] = await Promise.all([
        // Inactive clients (not janela_longa), ordered by score DESC
        supabase
          .from('clients')
          .select('id, name, cnpj, phone, seller_id, origem, last_order_at, total_orders, total_revenue, reativacao_score, created_at, sellers(name)')
          .eq('company_id', company_id)
          .eq('status', 'inactive')
          .eq('janela_longa', false)
          .order('reativacao_score', { ascending: false, nullsFirst: false })
          .limit(50),

        // Janela longa clients
        supabase
          .from('clients')
          .select('id, name, cnpj, intervalo_medio_dias, proxima_compra_estimada, sellers(name)')
          .eq('company_id', company_id)
          .eq('janela_longa', true),

        // Reativacoes this month
        supabase
          .from('client_reativacoes')
          .select('id, data_reativacao, valor_primeiro_pedido')
          .eq('company_id', company_id)
          .gte('data_reativacao', monthStart),

        // At risk count
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company_id)
          .eq('status', 'at_risk'),
      ])

      if (inactiveRes.error) return { data: null, error: inactiveRes.error }

      return {
        data: {
          inactiveClients: (inactiveRes.data ?? []) as unknown as InactiveClient[],
          janelaLongaClients: (janelaRes.data ?? []) as unknown as JanelaLongaClient[],
          reativacoesMes: (reativacoesRes.data ?? []) as unknown as Reativacao[],
          atRiskCount: atRiskRes.count ?? 0,
        },
        error: null,
      }
    },
    [],
  )

  // Polling 30s
  useEffect(() => {
    const interval = setInterval(() => { refetch() }, 30_000)
    return () => clearInterval(interval)
  }, [refetch])

  // ── Derived ──────────────────────────────────────────────────────────────

  const inactiveClients = data?.inactiveClients ?? []
  const janelaLongaClients = data?.janelaLongaClients ?? []
  const reativacoesMes = data?.reativacoesMes ?? []
  const atRiskCount = data?.atRiskCount ?? 0

  const resgatadosMes = reativacoesMes.length
  const receitaRecuperada = reativacoesMes.reduce((s, r) => s + (r.valor_primeiro_pedido ?? 0), 0)
  const progressPct = Math.min(100, (resgatadosMes / META_MENSAL) * 100)
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  // ── Fetch orders for expanded card ──────────────────────────────────────

  const fetchOrders = useCallback(async (clientId: string) => {
    if (expandedOrders[clientId]) return
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, created_at, order_items(products(name))')
      .eq('client_id', clientId)
      .in('status', ['approved', 'invoiced'])
      .order('created_at', { ascending: false })
      .limit(3)
    setExpandedOrders(prev => ({ ...prev, [clientId]: (orders ?? []) as unknown as RecentOrder[] }))
  }, [expandedOrders])

  function handleExpand(clientId: string) {
    if (expandedId === clientId) {
      setExpandedId(null)
    } else {
      setExpandedId(clientId)
      fetchOrders(clientId)
    }
  }

  // ── Create reactivation task ────────────────────────────────────────────

  async function handleIniciarReativacao(client: InactiveClient) {
    if (!seller) return
    setCreatingTask(client.id)
    try {
      const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      await supabase.from('tasks').insert({
        title: `Reativacao: ${client.name}`,
        status: 'open',
        status_crm: 'pendente',
        priority_crm: 'alta',
        client_id: client.id,
        assigned_to_seller_id: seller.id,
        assigned_to: seller.id,
        created_by_seller_id: seller.id,
        company_id: seller.company_id,
        due_date: dueDate,
        task_date: dueDate,
        task_category: 'reativacao',
      })
      setStatusMap(prev => ({ ...prev, [client.id]: 'em_contato' }))
      refetch()
    } finally {
      setCreatingTask(null)
    }
  }

  // ── Metrics cards ───────────────────────────────────────────────────────

  const metrics = useMemo(() => [
    { label: 'Total de Inativos', value: String(inactiveClients.length), icon: Target, iconBg: 'bg-red-50', iconCls: 'text-red-500' },
    { label: 'Em Reativacao', value: String(atRiskCount), icon: Zap, iconBg: 'bg-amber-50', iconCls: 'text-amber-500' },
    { label: 'Resgatados no Mes', value: String(resgatadosMes), icon: TrendingUp, iconBg: 'bg-emerald-50', iconCls: 'text-emerald-600' },
    { label: 'Receita Recuperada', value: fmtCurrency(receitaRecuperada), icon: DollarSign, iconBg: 'bg-[#EEF2FF]', iconCls: 'text-[#3B5BDB]' },
  ], [inactiveClients.length, atRiskCount, resgatadosMes, receitaRecuperada])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <button
          onClick={() => navigate('/clientes')}
          className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors"
        >
          <ChevronLeft size={14} /> Carteira de Clientes
        </button>
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Clientes Inativos</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {loading ? 'Carregando...' : `Fila de batalha comercial — ${inactiveClients.length} clientes ranqueados por score`}
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* [A] Painel de Guerra — Metricas */}
        <div className="grid grid-cols-4 gap-3">
          {metrics.map(({ label, value, icon: Icon, iconBg, iconCls }) => (
            <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">{label}</p>
                  <p className="text-xl font-semibold text-[#111827] tabular-nums leading-tight">{loading ? '—' : value}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                  <Icon size={15} className={iconCls} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* [B] Barra de Progresso da Meta */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#111827]">
              {resgatadosMes} / {META_MENSAL} clientes reativados em {mesNome}
            </p>
            <span className="text-xs text-[#6B7280] tabular-nums">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          {resgatadosMes < META_MENSAL && (
            <p className="text-xs text-[#9CA3AF] mt-2">
              Faltam {META_MENSAL - resgatadosMes} clientes para bater a meta
            </p>
          )}
          {resgatadosMes >= META_MENSAL && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">Meta atingida!</p>
          )}
        </div>

        {/* [C] Fila de Batalha */}
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 flex items-center justify-center">
            <span className="text-sm text-[#9CA3AF]">Carregando fila de batalha...</span>
          </div>
        ) : inactiveClients.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 text-center">
            <Target size={32} className="text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280]">Nenhum cliente inativo na fila</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Execute as Edge Functions para calcular scores</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inactiveClients.map((client, index) => {
              const isExpanded = expandedId === client.id
              const dias = daysSince(client.last_order_at)
              const valorMensal = (client.total_revenue ?? 0) / Math.max(1, Math.ceil(((daysSince(client.created_at) ?? 365)) / 30))
              const status = statusMap[client.id] ?? 'nao_iniciado'
              const statusCfg = STATUS_CFG[status]
              const orders = expandedOrders[client.id]

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div
                    className={`bg-white border rounded-xl transition-all ${
                      isExpanded ? 'border-[#3B5BDB]/30 shadow-[0_1px_6px_0_rgb(59,91,219,0.08)]' : 'border-[#E5E7EB] hover:border-[#C7D2FE]'
                    }`}
                  >
                    {/* Card principal */}
                    <div
                      className="px-4 py-3 flex items-center gap-4 cursor-pointer"
                      onClick={() => handleExpand(client.id)}
                    >
                      {/* Rank */}
                      <span className="w-7 h-7 rounded-lg bg-[#F3F4F6] text-[10px] font-bold text-[#6B7280] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/clientes/${client.id}`) }}
                            className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] truncate transition-colors"
                          >
                            {client.name}
                          </button>
                          {client.cnpj && (
                            <span className="text-[10px] text-[#9CA3AF] font-mono shrink-0">{fmtCNPJ(client.cnpj)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-[#6B7280]">Valia {fmtCurrency(valorMensal)}/mes</span>
                          <span className="text-xs text-[#9CA3AF]">{client.sellers?.name ?? '—'}</span>
                        </div>
                      </div>

                      {/* Dias inativo */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <Clock size={12} className={dias !== null && dias > 120 ? 'text-red-400' : 'text-amber-400'} />
                          <span className={`text-xs font-medium tabular-nums ${dias !== null && dias > 120 ? 'text-red-600' : 'text-amber-600'}`}>
                            {dias !== null ? `${dias}d` : '—'}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">sem comprar</p>
                      </div>

                      {/* Score badge */}
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#EEF2FF] text-[#3B5BDB] tabular-nums shrink-0">
                        {Math.round(client.reativacao_score ?? 0)}
                      </span>

                      {/* Status */}
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {client.phone && (
                          <>
                            <a href={`tel:${client.phone}`} title="Ligar"
                               className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                              <Phone size={13} />
                            </a>
                            <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                               target="_blank" rel="noreferrer" title="WhatsApp"
                               className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <MessageCircle size={13} />
                            </a>
                          </>
                        )}
                        {status === 'nao_iniciado' && (
                          <button
                            onClick={() => handleIniciarReativacao(client)}
                            disabled={creatingTask === client.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#3B5BDB] text-white rounded-md hover:bg-[#3451C7] disabled:opacity-50 transition-colors"
                          >
                            <Plus size={11} />
                            {creatingTask === client.id ? '...' : 'Iniciar'}
                          </button>
                        )}
                      </div>

                      {/* Expand indicator */}
                      {isExpanded ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
                    </div>

                    {/* Expanded preview */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pt-1 border-t border-[#F3F4F6]">
                            <p className="text-xs font-medium text-[#6B7280] mb-2">Ultimos pedidos</p>
                            {!orders ? (
                              <p className="text-xs text-[#9CA3AF]">Carregando...</p>
                            ) : orders.length === 0 ? (
                              <p className="text-xs text-[#9CA3AF]">Nenhum pedido encontrado</p>
                            ) : (
                              <div className="space-y-1.5">
                                {orders.map(o => {
                                  const productName = o.order_items?.[0]?.products?.name ?? '—'
                                  return (
                                    <div key={o.id} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[#9CA3AF] whitespace-nowrap">{fmtDate(o.created_at)}</span>
                                        <span className="text-[#374151] truncate">{productName}</span>
                                      </div>
                                      <span className="font-medium text-[#111827] tabular-nums shrink-0 ml-3">{fmtCurrency(o.total)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-[#9CA3AF]">
                                Historico: {client.total_orders ?? 0} pedidos · {fmtCurrency(client.total_revenue ?? 0)} total
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* [D] Silencio Programado */}
        {janelaLongaClients.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <button
              onClick={() => setSilencioProgramadoOpen(p => !p)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#6B7280]" />
                <span className="text-sm font-medium text-[#111827]">Clientes em Silencio Programado</span>
                <span className="text-xs text-[#9CA3AF] tabular-nums">{janelaLongaClients.length}</span>
              </div>
              {silencioProgramadoOpen ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
            </button>

            <AnimatePresence>
              {silencioProgramadoOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[#F3F4F6] divide-y divide-[#F3F4F6]">
                    {janelaLongaClients.map(client => {
                      const estimada = client.proxima_compra_estimada
                      const isJanelaAberta = estimada ? new Date(estimada) < new Date() : false
                      return (
                        <div key={client.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="min-w-0">
                            <button
                              onClick={() => navigate(`/clientes/${client.id}`)}
                              className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors truncate"
                            >
                              {client.name}
                            </button>
                            <div className="flex items-center gap-3 mt-0.5">
                              {client.cnpj && <span className="text-[10px] text-[#9CA3AF] font-mono">{fmtCNPJ(client.cnpj)}</span>}
                              <span className="text-xs text-[#6B7280]">{client.sellers?.name ?? '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-[#6B7280]">Intervalo medio: <span className="font-medium tabular-nums">{client.intervalo_medio_dias ?? '—'}d</span></p>
                              <p className="text-xs text-[#9CA3AF]">Proxima: {estimada ? fmtDate(estimada) : '—'}</p>
                            </div>
                            {isJanelaAberta && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                                <AlertTriangle size={10} /> Janela Aberta
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  )
}
