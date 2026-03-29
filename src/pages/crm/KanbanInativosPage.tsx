import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Phone, MessageCircle,
  Target, Zap, TrendingUp, DollarSign, Clock, AlertTriangle,
  Plus, XCircle, Check, LayoutList, Moon,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { Progress } from '../../components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InactiveClient {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  seller_id: string | null
  origem: string | null
  last_order_at: string | null
  total_orders: number | null
  total_revenue: number | null
  reativacao_score: number | null
  created_at: string
  status: string
  city: string | null
  state: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  neighborhood: string | null
  zip_code: string | null
  ie: string | null
  payment_term: string | null
  unit_type: string | null
  janela_longa: boolean | null
  notes: string | null
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

interface ExpandOrder {
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

interface ModalOrder {
  id: string
  order_number: string | null
  total: number
  status: string
  created_at: string
}

interface ModalTask {
  id: string
  title: string
  status: string
  status_crm: string | null
  due_date: string | null
  priority_crm: string | null
}

type ReativacaoStatus = 'nao_iniciado' | 'em_contato' | 'negociando' | 'perdido'
type ViewMode = 'normal' | 'interativo'

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

const ORIGEM_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção', ligacao: 'Prospecção', google: 'Google', indicacao: 'Indicação',
  filial: 'Filial', porta_loja: 'Veio à loja', conta_azul: 'Conta Azul', conquistado: 'Conquistado', outro: 'Outro',
}

const META_MENSAL = 10

const STATUS_CFG: Record<ReativacaoStatus, { label: string; bg: string; text: string }> = {
  nao_iniciado: { label: 'Nao iniciado', bg: 'bg-[#F3F4F6]',  text: 'text-[#6B7280]' },
  em_contato:   { label: 'Em contato',   bg: 'bg-amber-50',    text: 'text-amber-700' },
  negociando:   { label: 'Negociando',   bg: 'bg-[#EEF2FF]',   text: 'text-[#3B5BDB]' },
  perdido:      { label: 'Perdido',      bg: 'bg-red-50',      text: 'text-red-600' },
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700',
  invoiced: 'bg-[#EEF2FF] text-[#3B5BDB]',
  pending:  'bg-amber-50 text-amber-700',
  created:  'bg-[#F3F4F6] text-[#6B7280]',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KanbanInativosPage() {
  const navigate = useNavigate()
  const { seller } = useAuth()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, ReativacaoStatus>>({})
  const [silencioProgramadoOpen, setSilencioProgramadoOpen] = useState(true)
  const [creatingTask, setCreatingTask] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, ExpandOrder[]>>({})
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [modalClient, setModalClient] = useState<InactiveClient | null>(null)

  // Load ui_mode from seller on mount
  useEffect(() => {
    if (!seller) return
    supabase
      .from('sellers')
      .select('ui_mode')
      .eq('id', seller.id)
      .single()
      .then(({ data }) => {
        if (data?.ui_mode === 'interativo') setViewMode('interativo')
      })
  }, [seller])

  // ── Main query ──────────────────────────────────────────────────────────

  const { data, loading, refetch } = useSupabaseQuery<QueryResult>(
    async ({ company_id }) => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [inactiveRes, janelaRes, reativacoesRes, atRiskRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, cnpj, phone, email, seller_id, origem, last_order_at, total_orders, total_revenue, reativacao_score, created_at, status, city, state, street, street_number, complement, neighborhood, zip_code, ie, payment_term, unit_type, janela_longa, notes, sellers(name)')
          .eq('company_id', company_id)
          .eq('status', 'inactive')
          .eq('janela_longa', false)
          .neq('origem', 'filial')
          .order('reativacao_score', { ascending: false, nullsFirst: false })
          .limit(50),
        supabase
          .from('clients')
          .select('id, name, cnpj, intervalo_medio_dias, proxima_compra_estimada, sellers(name)')
          .eq('company_id', company_id)
          .eq('janela_longa', true)
          .neq('origem', 'filial'),
        supabase
          .from('client_reativacoes')
          .select('id, data_reativacao, valor_primeiro_pedido')
          .eq('company_id', company_id)
          .gte('data_reativacao', monthStart),
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company_id)
          .eq('status', 'at_risk')
          .neq('origem', 'filial'),
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

  useEffect(() => {
    const iv = setInterval(refetch, 30_000)
    return () => clearInterval(iv)
  }, [refetch])

  // ── Derived ─────────────────────────────────────────────────────────────

  const clients = data?.inactiveClients ?? []
  const janelaClients = data?.janelaLongaClients ?? []
  const reativacoes = data?.reativacoesMes ?? []
  const atRisk = data?.atRiskCount ?? 0

  const resgatados = reativacoes.length
  const receita = reativacoes.reduce((s, r) => s + (r.valor_primeiro_pedido ?? 0), 0)
  const pct = Math.min(100, (resgatados / META_MENSAL) * 100)
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  // Progress bar color
  const progressCls = pct < 30 ? '[&>div]:bg-red-500' : pct < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'

  // ── Expand ──────────────────────────────────────────────────────────────

  const fetchExpandOrders = useCallback(async (cid: string) => {
    if (expandedOrders[cid]) return
    const { data: o } = await supabase
      .from('orders')
      .select('id, total, created_at, order_items(products(name))')
      .eq('client_id', cid)
      .in('status', ['approved', 'invoiced'])
      .order('created_at', { ascending: false })
      .limit(3)
    setExpandedOrders(p => ({ ...p, [cid]: (o ?? []) as unknown as ExpandOrder[] }))
  }, [expandedOrders])

  function toggleExpand(cid: string) {
    if (expandedId === cid) { setExpandedId(null) } else { setExpandedId(cid); fetchExpandOrders(cid) }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async function handleIniciar(c: InactiveClient) {
    if (!seller) return
    setCreatingTask(c.id)
    try {
      const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      const { error } = await supabase.from('tasks').insert({
        title: `Reativacao: ${c.name}`,
        status: 'open',
        status_crm: 'pendente',
        priority: 'high',
        priority_crm: 'alta',
        client_id: c.id,
        assigned_to_seller_id: seller.id,
        assigned_to: seller.id,
        created_by_seller_id: seller.id,
        company_id: seller.company_id,
        due_date: due,
        task_date: due,
        task_category: 'reativacao',
        source_module: 'inativos',
      })
      if (error) { showToast('error', `Erro: ${error.message}`); return }
      setStatusMap(p => ({ ...p, [c.id]: 'em_contato' }))
      showToast('success', `Reativacao iniciada para ${c.name}`)
      refetch()
    } catch (e) {
      showToast('error', String(e))
    } finally {
      setCreatingTask(null)
    }
  }

  function handleDescartar(cid: string) {
    setDiscardedIds(p => new Set(p).add(cid))
    showToast('success', 'Cliente removido da fila')
  }

  async function handleToggleMode(m: ViewMode) {
    setViewMode(m)
    if (seller) await supabase.from('sellers').update({ ui_mode: m }).eq('id', seller.id)
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Metrics ─────────────────────────────────────────────────────────────

  const metrics = useMemo(() => [
    { label: 'Total de Inativos', value: String(clients.length), icon: Target, iconBg: 'bg-red-50', iconCls: 'text-red-500' },
    { label: 'Em Reativacao',     value: String(atRisk),          icon: Zap, iconBg: 'bg-amber-50', iconCls: 'text-amber-500' },
    { label: 'Resgatados no Mes', value: String(resgatados),      icon: TrendingUp, iconBg: 'bg-emerald-50', iconCls: 'text-emerald-600' },
    { label: 'Receita Recuperada',value: fmtCurrency(receita),    icon: DollarSign, iconBg: 'bg-[#EEF2FF]', iconCls: 'text-[#3B5BDB]' },
  ], [clients.length, atRisk, resgatados, receita])

  const visibleClients = clients.filter(c => !discardedIds.has(c.id))

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ── SEÇÃO 1: Header ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <button onClick={() => navigate('/clientes')} className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors">
          <ChevronLeft size={14} /> Carteira de Clientes
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Clientes Inativos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {loading ? 'Carregando...' : `${clients.length} clientes ranqueados por score de reativacao`}
            </p>
          </div>
          {/* Toggle */}
          <div className="flex items-center rounded-lg border border-[#E5E7EB] p-0.5 bg-white">
            {(['normal', 'interativo'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => handleToggleMode(m)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === m
                    ? 'bg-[#3B5BDB] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                {m === 'normal' ? <LayoutList size={13} /> : <Zap size={13} />}
                {m === 'normal' ? 'Normal' : 'Interativo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* ── SEÇÃO 7: Interativo banner ───────────────────────────── */}
        {viewMode === 'interativo' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Zap size={16} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Modo Interativo em construção</p>
              <p className="text-xs text-amber-600 mt-0.5">Animações e game layer chegam em breve</p>
            </div>
            <span className="ml-auto inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">Em breve</span>
          </div>
        )}

        {/* ── SEÇÃO 2: Painel de Guerra ────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {metrics.map(({ label, value, icon: Icon, iconBg, iconCls }) => (
            <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-1.5">{label}</p>
                  <p className="text-2xl font-semibold text-[#111827] tabular-nums leading-none">{loading ? '—' : value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                  <Icon size={16} className={iconCls} strokeWidth={1.75} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SEÇÃO 3: Barra de Meta ──────────────────────────────── */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-medium text-[#111827]">
              {resgatados} / {META_MENSAL} clientes reativados em {mes}
            </p>
            <span className="text-xs font-medium text-[#6B7280] tabular-nums">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className={`h-1.5 ${progressCls}`} />
          <p className={`text-xs mt-2 ${resgatados >= META_MENSAL ? 'text-emerald-600 font-medium' : 'text-[#9CA3AF]'}`}>
            {resgatados >= META_MENSAL ? 'Meta atingida!' : `Faltam ${META_MENSAL - resgatados} clientes para bater a meta`}
          </p>
        </div>

        {/* ── SEÇÃO 4: Fila de Batalha ────────────────────────────── */}
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#9CA3AF]">Carregando fila de batalha...</span>
            </div>
          </div>
        ) : visibleClients.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 text-center">
            <Target size={36} className="text-[#D1D5DB] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#6B7280]">Nenhum cliente inativo na fila</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Execute as Edge Functions para calcular scores</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {visibleClients.map((c, i) => {
                const isExp = expandedId === c.id
                const dias = daysSince(c.last_order_at)
                const valorMes = (c.total_revenue ?? 0) / Math.max(1, Math.ceil((daysSince(c.created_at) ?? 365) / 30))
                const st = statusMap[c.id] ?? 'nao_iniciado'
                const stCfg = STATUS_CFG[st]
                const ords = expandedOrders[c.id]
                const diasColor = dias !== null && dias > 120 ? 'text-red-600' : dias !== null && dias > 60 ? 'text-amber-600' : 'text-[#6B7280]'
                const diasIconColor = dias !== null && dias > 120 ? 'text-red-400' : dias !== null && dias > 60 ? 'text-amber-400' : 'text-[#9CA3AF]'

                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.02, duration: 0.25 }}
                  >
                    <div className={`bg-white border rounded-xl transition-all ${
                      isExp ? 'border-[#3B5BDB]/30 shadow-[0_2px_8px_0_rgb(59,91,219,0.06)]' : 'border-[#E5E7EB] hover:border-[#C7D2FE]'
                    }`}>
                      {/* COLLAPSED */}
                      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                        {/* Rank */}
                        <span className="w-7 h-7 rounded-lg bg-[#F3F4F6] text-[10px] font-bold text-[#6B7280] flex items-center justify-center shrink-0 tabular-nums">
                          {i + 1}
                        </span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); setModalClient(c) }}
                              className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] truncate transition-colors text-left"
                            >
                              {c.name}
                            </button>
                            {c.cnpj && <span className="text-[10px] text-[#9CA3AF] font-mono shrink-0 hidden lg:inline">{fmtCNPJ(c.cnpj)}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-[#6B7280]">Valia {fmtCurrency(valorMes)}/mes</span>
                            <span className="text-xs text-[#9CA3AF] hidden sm:inline">{c.sellers?.name ?? '—'}</span>
                          </div>
                        </div>

                        {/* Dias */}
                        <div className="text-right shrink-0 w-16">
                          <div className="flex items-center gap-1 justify-end">
                            <Clock size={11} className={diasIconColor} />
                            <span className={`text-xs font-semibold tabular-nums ${diasColor}`}>{dias !== null ? `${dias}d` : '—'}</span>
                          </div>
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5">sem comprar</p>
                        </div>

                        {/* Score */}
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EEF2FF] text-[#3B5BDB] tabular-nums shrink-0 min-w-[44px] justify-center">
                          {Math.round(c.reativacao_score ?? 0)}
                        </span>

                        {/* Status */}
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${stCfg.bg} ${stCfg.text}`}>
                          {stCfg.label}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {c.phone && (
                            <>
                              <a href={`tel:${c.phone}`} title="Ligar" className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                                <Phone size={13} />
                              </a>
                              <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp"
                                 className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <MessageCircle size={13} />
                              </a>
                            </>
                          )}
                          <button onClick={() => handleDescartar(c.id)} title="Descartar"
                                  className="p-1.5 rounded-md text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 transition-colors">
                            <XCircle size={13} />
                          </button>
                          {st === 'nao_iniciado' ? (
                            <button
                              onClick={() => handleIniciar(c)}
                              disabled={creatingTask === c.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#3B5BDB] text-white rounded-md hover:bg-[#3451C7] disabled:opacity-50 transition-colors ml-0.5"
                            >
                              <Plus size={11} />
                              {creatingTask === c.id ? '...' : 'Iniciar'}
                            </button>
                          ) : st === 'em_contato' ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-md ml-0.5">
                              <Check size={11} /> Task criada
                            </span>
                          ) : null}
                        </div>

                        {/* Chevron */}
                        <div className="shrink-0 w-4">
                          {isExp ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
                        </div>
                      </div>

                      {/* EXPANDED */}
                      <AnimatePresence>
                        {isExp && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-2 border-t border-[#F3F4F6]">
                              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Ultimos pedidos</p>
                              {!ords ? (
                                <p className="text-xs text-[#9CA3AF]">Carregando...</p>
                              ) : ords.length === 0 ? (
                                <p className="text-xs text-[#9CA3AF]">Nenhum pedido encontrado</p>
                              ) : (
                                <div className="space-y-1">
                                  {ords.map(o => (
                                    <div key={o.id} className="flex items-center justify-between text-xs py-1">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-[#9CA3AF] whitespace-nowrap tabular-nums">{fmtDate(o.created_at)}</span>
                                        <span className="text-[#374151] truncate">{o.order_items?.[0]?.products?.name ?? '—'}</span>
                                      </div>
                                      <span className="font-semibold text-[#111827] tabular-nums shrink-0 ml-4">{fmtCurrency(o.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-[10px] text-[#9CA3AF] mt-2 pt-2 border-t border-[#F9FAFB]">
                                Historico: {c.total_orders ?? 0} pedidos · {fmtCurrency(c.total_revenue ?? 0)} total
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ── SEÇÃO 5: Silencio Programado ─────────────────────────── */}
        {janelaClients.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <button
              onClick={() => setSilencioProgramadoOpen(p => !p)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-[#6B7280]" />
                <span className="text-sm font-medium text-[#111827]">Clientes em Silencio Programado</span>
                <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded tabular-nums">{janelaClients.length}</span>
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
                    {janelaClients.map(jc => {
                      const est = jc.proxima_compra_estimada
                      const aberta = est ? new Date(est) < new Date() : false
                      return (
                        <div key={jc.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="min-w-0">
                            <button onClick={() => navigate(`/clientes/${jc.id}`)} className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors truncate">
                              {jc.name}
                            </button>
                            <div className="flex items-center gap-3 mt-0.5">
                              {jc.cnpj && <span className="text-[10px] text-[#9CA3AF] font-mono">{fmtCNPJ(jc.cnpj)}</span>}
                              <span className="text-xs text-[#6B7280]">{jc.sellers?.name ?? '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-[#6B7280]">Intervalo: <span className="font-medium tabular-nums">{jc.intervalo_medio_dias ?? '—'}d</span></p>
                              <p className="text-xs text-[#9CA3AF]">Proxima: {est ? fmtDate(est) : '—'}</p>
                            </div>
                            {aberta && (
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

      {/* ── TOAST ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === 'success' ? 'bg-[#111827] text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEÇÃO 6: Modal ─────────────────────────────────────────── */}
      {modalClient && <ClientDetailModal client={modalClient} onClose={() => setModalClient(null)} />}
    </div>
  )
}

// ─── SEÇÃO 6: Client Detail Modal ─────────────────────────────────────────────

function ClientDetailModal({ client, onClose }: { client: InactiveClient; onClose: () => void }) {
  const [tab, setTab] = useState('cadastro')
  const [mOrders, setMOrders] = useState<ModalOrder[] | null>(null)
  const [mTasks, setMTasks] = useState<ModalTask[] | null>(null)

  useEffect(() => {
    if (tab !== 'pedidos' || mOrders !== null) return
    supabase
      .from('orders')
      .select('id, order_number, total, status, created_at')
      .eq('client_id', client.id)
      .in('status', ['approved', 'invoiced', 'pending'])
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setMOrders((data ?? []) as ModalOrder[]))
  }, [tab, client.id, mOrders])

  useEffect(() => {
    if (tab !== 'interacoes' || mTasks !== null) return
    const ago = new Date(Date.now() - 90 * 86_400_000).toISOString()
    supabase
      .from('tasks')
      .select('id, title, status, status_crm, due_date, priority_crm')
      .eq('client_id', client.id)
      .gte('created_at', ago)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setMTasks((data ?? []) as ModalTask[]))
  }, [tab, client.id, mTasks])

  const total = (mOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const open = (mTasks ?? []).filter(t => t.status === 'open' || t.status_crm === 'pendente')
  const done = (mTasks ?? []).filter(t => t.status === 'done' || t.status_crm === 'concluida')

  const addr = [client.street, client.street_number, client.complement, client.neighborhood].filter(Boolean).join(', ')
  const cityState = [client.city, client.state].filter(Boolean).join(' — ')

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <DialogTitle className="text-base font-semibold text-[#111827] truncate">{client.name}</DialogTitle>
              {client.cnpj && <span className="text-xs text-[#9CA3AF] font-mono shrink-0">{fmtCNPJ(client.cnpj)}</span>}
              {client.origem === 'filial' && <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">Filial</span>}
              {client.janela_longa && <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">Janela Longa</span>}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="shrink-0 mx-6 mt-3">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="interacoes">Interações</TabsTrigger>
            <TabsTrigger value="memoria">Memória</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="cadastro" className="mt-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <F label="Nome" value={client.name} />
                <F label="CNPJ" value={fmtCNPJ(client.cnpj)} />
                <F label="Telefone" value={client.phone} />
                <F label="Email" value={client.email} />
                <F label="Endereço" value={addr || null} span2 />
                <F label="Cidade / UF" value={cityState || null} />
                <F label="CEP" value={client.zip_code} />
                <F label="IE" value={client.ie} />
                <F label="Vendedor" value={client.sellers?.name ?? null} />
                <F label="Status" value={client.status} />
                <F label="Origem" value={client.origem ? (ORIGEM_LABELS[client.origem] ?? client.origem) : null} />
                <F label="Tipo de Unidade" value={client.unit_type} />
                <F label="Prazo de Pagamento" value={client.payment_term} />
                <F label="Data de Cadastro" value={fmtDate(client.created_at)} />
                <F label="Ultimo Pedido" value={fmtDate(client.last_order_at)} />
                <F label="Total de Pedidos" value={String(client.total_orders ?? 0)} />
                <F label="Receita Total" value={fmtCurrency(client.total_revenue ?? 0)} />
                <F label="Score de Reativacao" value={String(Math.round(client.reativacao_score ?? 0))} />
              </div>
            </TabsContent>

            <TabsContent value="pedidos" className="mt-4">
              {mOrders === null ? (
                <p className="text-sm text-[#9CA3AF] py-10 text-center">Carregando pedidos...</p>
              ) : mOrders.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] py-10 text-center">Nenhum pedido encontrado</p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left pb-2 text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Data</th>
                        <th className="text-left pb-2 text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Pedido</th>
                        <th className="text-right pb-2 text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Valor</th>
                        <th className="text-left pb-2 pl-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {mOrders.map(o => (
                        <tr key={o.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-2.5 text-[#374151] whitespace-nowrap tabular-nums">{fmtDate(o.created_at)}</td>
                          <td className="py-2.5 text-[#6B7280] font-mono text-xs">{o.order_number ?? '—'}</td>
                          <td className="py-2.5 text-right font-semibold text-[#111827] tabular-nums">{fmtCurrency(o.total)}</td>
                          <td className="py-2.5 pl-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex justify-end">
                    <span className="text-sm font-semibold text-[#111827] tabular-nums">Total: {fmtCurrency(total)}</span>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="interacoes" className="mt-4">
              {mTasks === null ? (
                <p className="text-sm text-[#9CA3AF] py-10 text-center">Carregando tarefas...</p>
              ) : mTasks.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] py-10 text-center">Nenhuma tarefa nos ultimos 90 dias</p>
              ) : (
                <div className="space-y-5">
                  {open.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Abertas ({open.length})</p>
                      <div className="space-y-1">
                        {open.map(t => (
                          <div key={t.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded-lg px-3 py-2.5">
                            <span className="text-[#111827] truncate">{t.title}</span>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {t.priority_crm && <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{t.priority_crm}</span>}
                              <span className="text-xs text-[#9CA3AF] tabular-nums">{fmtDate(t.due_date)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {done.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Concluídas ({done.length})</p>
                      <div className="space-y-1">
                        {done.map(t => (
                          <div key={t.id} className="flex items-center justify-between text-sm px-3 py-2">
                            <span className="text-[#9CA3AF]">{t.title}</span>
                            <span className="text-xs text-[#D1D5DB] tabular-nums">{fmtDate(t.due_date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="memoria" className="mt-4">
              <div className="py-10 text-center">
                <p className="text-sm text-[#9CA3AF]">Nenhuma memória comercial registrada ainda.</p>
                <p className="text-xs text-[#D1D5DB] mt-1">Este recurso estará disponivel em breve</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function F({ label, value, span2 }: { label: string; value: string | null | undefined; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-[#111827]">{value || '—'}</p>
    </div>
  )
}
