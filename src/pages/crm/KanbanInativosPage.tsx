import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Phone, MessageCircle,
  Target, Zap, TrendingUp, DollarSign, Clock, AlertTriangle,
  Plus, XCircle, Check, LayoutList, Moon, ArrowUpRight, Eye,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { Progress } from '../../components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface Client {
  id: string; name: string; cnpj: string | null; phone: string | null; email: string | null
  seller_id: string | null; origem: string | null; last_order_at: string | null
  total_orders: number | null; total_revenue: number | null; reativacao_score: number | null
  created_at: string; status: string; city: string | null; state: string | null
  street: string | null; street_number: string | null; complement: string | null
  neighborhood: string | null; zip_code: string | null; ie: string | null
  payment_term: string | null; unit_type: string | null; janela_longa: boolean | null
  notes: string | null; sellers: { name: string } | null
}

interface JanelaClient {
  id: string; name: string; cnpj: string | null
  intervalo_medio_dias: number | null; proxima_compra_estimada: string | null
  sellers: { name: string } | null
}

interface ExpandOrder { id: string; total: number; created_at: string; order_items: { products: { name: string } | null }[] }
interface Reativacao { id: string; data_reativacao: string; valor_primeiro_pedido: number | null }
interface ModalOrder { id: string; order_number: string | null; total: number; status: string; created_at: string }
interface ModalTask { id: string; title: string; status: string; status_crm: string | null; due_date: string | null; priority_crm: string | null }

type CardStatus = 'idle' | 'contacted' | 'negotiating' | 'lost'
type ViewMode = 'normal' | 'interativo'

interface QResult { clients: Client[]; janela: JanelaClient[]; reativacoes: Reativacao[]; atRisk: number }

/* ═══════════════════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════════════════ */

const daysAgo = (d: string | null) => { if (!d) return null; return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000) }
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const date = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') }
const cnpj = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : v }

const ORIGEM: Record<string, string> = { prospeccao:'Prospecção', ligacao:'Prospecção', google:'Google', indicacao:'Indicação', filial:'Filial', porta_loja:'Veio à loja', conta_azul:'Conta Azul', conquistado:'Conquistado', outro:'Outro' }
const META = 10

const STATUS_MAP: Record<CardStatus, { label: string; dot: string }> = {
  idle:        { label: 'Aguardando',   dot: 'bg-[#D1D5DB]' },
  contacted:   { label: 'Em contato',   dot: 'bg-amber-400' },
  negotiating: { label: 'Negociando',   dot: 'bg-[#3B5BDB]' },
  lost:        { label: 'Perdido',      dot: 'bg-red-400' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function KanbanInativosPage() {
  const nav = useNavigate()
  const { seller } = useAuth()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, CardStatus>>({})
  const [janelaOpen, setJanelaOpen] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, ExpandOrder[]>>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [modalClient, setModalClient] = useState<Client | null>(null)

  // Load seller preference
  useEffect(() => {
    if (!seller) return
    supabase.from('sellers').select('ui_mode').eq('id', seller.id).single()
      .then(({ data }) => { if (data?.ui_mode === 'interativo') setViewMode('interativo') })
  }, [seller])

  /* ── Query ─────────────────────────────────────────────────────────────── */

  const { data, loading, refetch } = useSupabaseQuery<QResult>(async ({ company_id }) => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const [a, b, c, d] = await Promise.all([
      supabase.from('clients')
        .select('id,name,cnpj,phone,email,seller_id,origem,last_order_at,total_orders,total_revenue,reativacao_score,created_at,status,city,state,street,street_number,complement,neighborhood,zip_code,ie,payment_term,unit_type,janela_longa,notes,sellers(name)')
        .eq('company_id', company_id).eq('status', 'inactive').eq('janela_longa', false).neq('origem', 'filial')
        .order('reativacao_score', { ascending: false, nullsFirst: false }).limit(50),
      supabase.from('clients')
        .select('id,name,cnpj,intervalo_medio_dias,proxima_compra_estimada,sellers(name)')
        .eq('company_id', company_id).eq('janela_longa', true).neq('origem', 'filial'),
      supabase.from('client_reativacoes').select('id,data_reativacao,valor_primeiro_pedido')
        .eq('company_id', company_id).gte('data_reativacao', monthStart),
      supabase.from('clients').select('id', { count: 'exact', head: true })
        .eq('company_id', company_id).eq('status', 'at_risk').neq('origem', 'filial'),
    ])
    if (a.error) return { data: null, error: a.error }
    return { data: { clients: (a.data ?? []) as unknown as Client[], janela: (b.data ?? []) as unknown as JanelaClient[], reativacoes: (c.data ?? []) as unknown as Reativacao[], atRisk: d.count ?? 0 }, error: null }
  }, [])

  useEffect(() => { const iv = setInterval(refetch, 30_000); return () => clearInterval(iv) }, [refetch])

  const allClients = data?.clients ?? []
  const janelaClients = data?.janela ?? []
  const reativacoes = data?.reativacoes ?? []
  const atRiskCount = data?.atRisk ?? 0
  const resgatados = reativacoes.length
  const receita = reativacoes.reduce((s, r) => s + (r.valor_primeiro_pedido ?? 0), 0)
  const pct = Math.min(100, (resgatados / META) * 100)
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const barColor = pct < 30 ? '[&>div]:bg-red-500' : pct < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
  const visibleClients = allClients.filter(c => !hidden.has(c.id))

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const loadOrders = useCallback(async (id: string) => {
    if (expandedOrders[id]) return
    const { data: o } = await supabase.from('orders').select('id,total,created_at,order_items(products(name))')
      .eq('client_id', id).in('status', ['approved', 'invoiced']).order('created_at', { ascending: false }).limit(3)
    setExpandedOrders(p => ({ ...p, [id]: (o ?? []) as unknown as ExpandOrder[] }))
  }, [expandedOrders])

  function toggle(id: string) { if (expandedId === id) setExpandedId(null); else { setExpandedId(id); loadOrders(id) } }

  async function startReactivation(c: Client) {
    if (!seller) return
    setCreating(c.id)
    try {
      const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      const { error } = await supabase.from('tasks').insert({
        title: `Reativação: ${c.name}`, status: 'open', status_crm: 'pendente',
        priority: 'high', priority_crm: 'alta', client_id: c.id,
        assigned_to_seller_id: seller.id, assigned_to: seller.id, created_by_seller_id: seller.id,
        company_id: seller.company_id, due_date: due, task_date: due,
        task_category: 'reativacao', source_module: 'inativos',
      })
      if (error) { notify(false, error.message); return }
      setStatusMap(p => ({ ...p, [c.id]: 'contacted' }))
      notify(true, `Task de reativação criada para ${c.name}`)
      refetch()
    } catch (e) { notify(false, String(e)) } finally { setCreating(null) }
  }

  function dismiss(id: string) { setHidden(p => new Set(p).add(id)); notify(true, 'Removido da fila') }

  async function switchMode(m: ViewMode) {
    setViewMode(m)
    if (seller) await supabase.from('sellers').update({ ui_mode: m }).eq('id', seller.id)
  }

  function notify(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500) }

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <button onClick={() => nav('/clientes')} className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#374151] mb-2 transition-colors">
            <ChevronLeft size={14} /> Clientes
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Reativação de Clientes</h1>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F3F4F6]">
              {(['normal', 'interativo'] as ViewMode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === m ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'
                  }`}>
                  {m === 'normal' ? <LayoutList size={12} /> : <Zap size={12} />}
                  {m === 'normal' ? 'Normal' : 'Interativo'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">

        {/* Banner interativo */}
        {viewMode === 'interativo' && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#111827] to-[#1E293B] rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Modo Interativo</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Dark theme, animações e game layer em desenvolvimento</p>
            </div>
            <span className="text-[10px] font-medium text-amber-400 border border-amber-400/30 px-2.5 py-1 rounded-full">EM BREVE</span>
          </motion.div>
        )}

        {/* ═══ MÉTRICAS ═══ */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'Inativos', value: allClients.length, icon: Target, color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Em reativação', value: atRiskCount, icon: ArrowUpRight, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Resgatados', value: resgatados, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Recuperado', value: money(receita), icon: DollarSign, color: 'text-[#3B5BDB]', bg: 'bg-[#EEF2FF]' },
          ] as const).map(({ label, value, icon: Ic, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9CA3AF] font-medium">{label}</p>
                <p className="text-2xl font-semibold text-[#111827] mt-1 tabular-nums">{loading ? '–' : typeof value === 'number' ? value : value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Ic size={18} className={color} strokeWidth={1.75} />
              </div>
            </div>
          ))}
        </div>

        {/* ═══ META ═══ */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-[#111827] tabular-nums">{resgatados}</span>
              <span className="text-sm text-[#9CA3AF]">/ {META} reativações em {mesNome}</span>
            </div>
            <span className="text-xs font-medium text-[#6B7280] tabular-nums">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className={`h-1.5 rounded-full ${barColor}`} />
          <p className={`text-xs mt-2 ${resgatados >= META ? 'text-emerald-600 font-medium' : 'text-[#9CA3AF]'}`}>
            {resgatados >= META ? 'Meta atingida' : `Faltam ${META - resgatados}`}
          </p>
        </div>

        {/* ═══ LISTA ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#111827]">Fila de reativação</h2>
            <span className="text-xs text-[#9CA3AF]">{visibleClients.length} clientes</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#9CA3AF]">Carregando...</span>
            </div>
          ) : visibleClients.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 text-center">
              <Target size={28} className="text-[#D1D5DB] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[#6B7280]">Fila vazia</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] overflow-hidden">
              <AnimatePresence mode="popLayout">
                {visibleClients.map((c, i) => {
                  const isOpen = expandedId === c.id
                  const dias = daysAgo(c.last_order_at)
                  const meses = Math.max(1, Math.ceil((daysAgo(c.created_at) ?? 365) / 30))
                  const valorMes = (c.total_revenue ?? 0) / meses
                  const st = statusMap[c.id] ?? 'idle'
                  const stCfg = STATUS_MAP[st]
                  const ords = expandedOrders[c.id]

                  return (
                    <motion.div key={c.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>

                      {/* ROW */}
                      <div className={`px-5 py-4 cursor-pointer transition-colors ${isOpen ? 'bg-[#FAFAF9]' : 'hover:bg-[#FAFAF9]'}`}
                           onClick={() => toggle(c.id)}>

                        <div className="flex items-center gap-4">
                          {/* Rank */}
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-[#6B7280] tabular-nums">{i + 1}</span>
                          </div>

                          {/* Client info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <button onClick={e => { e.stopPropagation(); setModalClient(c) }}
                                className="text-sm font-semibold text-[#111827] hover:text-[#3B5BDB] transition-colors truncate">
                                {c.name}
                              </button>
                              {c.origem && (
                                <span className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] px-1.5 py-0.5 rounded hidden sm:inline">
                                  {ORIGEM[c.origem] ?? c.origem}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-[#9CA3AF]">
                              <span>{money(valorMes)}<span className="text-[#D1D5DB]">/mês</span></span>
                              <span>{c.sellers?.name ?? '—'}</span>
                              {c.cnpj && <span className="font-mono hidden lg:inline">{cnpj(c.cnpj)}</span>}
                            </div>
                          </div>

                          {/* Dias */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Clock size={13} className={dias !== null && dias > 90 ? 'text-red-400' : 'text-[#D1D5DB]'} />
                            <span className={`text-sm font-semibold tabular-nums ${dias !== null && dias > 90 ? 'text-red-500' : 'text-[#374151]'}`}>
                              {dias ?? '—'}
                            </span>
                            <span className="text-[11px] text-[#D1D5DB]">dias</span>
                          </div>

                          {/* Score */}
                          <div className="w-12 h-8 rounded-lg bg-[#3B5BDB] flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-white tabular-nums">{Math.round(c.reativacao_score ?? 0)}</span>
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-1.5 min-w-[90px] shrink-0">
                            <div className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                            <span className="text-xs text-[#6B7280]">{stCfg.label}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {c.phone && (
                              <>
                                <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors" title="Ligar">
                                  <Phone size={14} />
                                </a>
                                <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                   className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="WhatsApp">
                                  <MessageCircle size={14} />
                                </a>
                              </>
                            )}

                            <button onClick={() => setModalClient(c)} title="Ver ficha"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors">
                              <Eye size={14} />
                            </button>

                            <button onClick={() => dismiss(c.id)} title="Remover da fila"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 transition-colors">
                              <XCircle size={14} />
                            </button>

                            {st === 'idle' ? (
                              <button onClick={() => startReactivation(c)} disabled={creating === c.id}
                                className="h-8 px-3 rounded-lg text-xs font-medium bg-[#3B5BDB] text-white hover:bg-[#3451C7] disabled:opacity-50 transition-colors flex items-center gap-1">
                                <Plus size={12} /> {creating === c.id ? '...' : 'Iniciar'}
                              </button>
                            ) : st === 'contacted' ? (
                              <div className="h-8 px-3 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 flex items-center gap-1">
                                <Check size={12} /> Criada
                              </div>
                            ) : null}
                          </div>

                          {/* Chevron */}
                          <div className="shrink-0 ml-1">
                            {isOpen ? <ChevronUp size={16} className="text-[#D1D5DB]" /> : <ChevronDown size={16} className="text-[#D1D5DB]" />}
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                            <div className="px-5 pb-4 bg-[#FAFAF9]">
                              <div className="ml-12 border-l-2 border-[#E5E7EB] pl-5 py-2">
                                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Últimos pedidos</p>
                                {!ords ? <p className="text-xs text-[#D1D5DB]">Carregando...</p> : ords.length === 0 ? <p className="text-xs text-[#D1D5DB]">Sem pedidos</p> : (
                                  <div className="space-y-2">
                                    {ords.map(o => (
                                      <div key={o.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-sm">
                                          <span className="text-[#9CA3AF] tabular-nums text-xs w-16">{date(o.created_at)}</span>
                                          <span className="text-[#374151]">{o.order_items?.[0]?.products?.name ?? '—'}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-[#111827] tabular-nums">{money(o.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center gap-4 text-xs text-[#9CA3AF]">
                                  <span>{c.total_orders ?? 0} pedidos no total</span>
                                  <span>{money(c.total_revenue ?? 0)} em receita</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ═══ SILÊNCIO PROGRAMADO ═══ */}
        {janelaClients.length > 0 && (
          <div>
            <button onClick={() => setJanelaOpen(p => !p)}
              className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#374151] transition-colors mb-3">
              <Moon size={14} />
              <span className="font-medium">Silêncio programado</span>
              <span className="text-[10px] bg-[#F3F4F6] text-[#9CA3AF] px-2 py-0.5 rounded-full tabular-nums">{janelaClients.length}</span>
              {janelaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <AnimatePresence>
              {janelaOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                    {janelaClients.map(j => {
                      const open = j.proxima_compra_estimada ? new Date(j.proxima_compra_estimada) < new Date() : false
                      return (
                        <div key={j.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <button onClick={() => nav(`/clientes/${j.id}`)} className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors">{j.name}</button>
                            <p className="text-xs text-[#9CA3AF] mt-0.5">{j.sellers?.name ?? '—'} {j.cnpj ? `· ${cnpj(j.cnpj)}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-right text-[#6B7280]">
                              <p>Intervalo: <span className="font-semibold tabular-nums">{j.intervalo_medio_dias ?? '—'}d</span></p>
                              <p className="text-[#9CA3AF]">Próxima: {j.proxima_compra_estimada ? date(j.proxima_compra_estimada) : '—'}</p>
                            </div>
                            {open && (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                                <AlertTriangle size={10} /> Janela aberta
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

      {/* ═══ TOAST ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
              toast.ok ? 'bg-[#111827] text-white' : 'bg-red-600 text-white'
            }`}>
            {toast.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MODAL ═══ */}
      {modalClient && <ClientModal client={modalClient} onClose={() => setModalClient(null)} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function ClientModal({ client: c, onClose }: { client: Client; onClose: () => void }) {
  const [tab, setTab] = useState('cadastro')
  const [orders, setOrders] = useState<ModalOrder[] | null>(null)
  const [tasks, setTasks] = useState<ModalTask[] | null>(null)

  useEffect(() => {
    if (tab !== 'pedidos' || orders !== null) return
    supabase.from('orders').select('id,order_number,total,status,created_at')
      .eq('client_id', c.id).in('status', ['approved', 'invoiced', 'pending'])
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setOrders((data ?? []) as ModalOrder[]))
  }, [tab, c.id, orders])

  useEffect(() => {
    if (tab !== 'tarefas' || tasks !== null) return
    supabase.from('tasks').select('id,title,status,status_crm,due_date,priority_crm')
      .eq('client_id', c.id).gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setTasks((data ?? []) as ModalTask[]))
  }, [tab, c.id, tasks])

  const total = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const openTasks = (tasks ?? []).filter(t => t.status === 'open' || t.status_crm === 'pendente')
  const doneTasks = (tasks ?? []).filter(t => t.status === 'done' || t.status_crm === 'concluida')
  const addr = [c.street, c.street_number, c.complement, c.neighborhood].filter(Boolean).join(', ')

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-semibold text-[#111827]">{c.name}</DialogTitle>
            {c.cnpj && <span className="text-xs text-[#9CA3AF] font-mono">{cnpj(c.cnpj)}</span>}
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="shrink-0 mx-6 mt-3 bg-[#F3F4F6] p-0.5 rounded-lg">
            <TabsTrigger value="cadastro" className="text-xs">Cadastro</TabsTrigger>
            <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
            <TabsTrigger value="tarefas" className="text-xs">Tarefas</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="cadastro" className="mt-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <LabelValue label="Nome" value={c.name} />
                <LabelValue label="CNPJ" value={cnpj(c.cnpj)} />
                <LabelValue label="Telefone" value={c.phone} />
                <LabelValue label="Email" value={c.email} />
                <LabelValue label="Endereço" value={addr || null} span />
                <LabelValue label="Cidade / UF" value={[c.city, c.state].filter(Boolean).join(' — ') || null} />
                <LabelValue label="CEP" value={c.zip_code} />
                <LabelValue label="Vendedor" value={c.sellers?.name ?? null} />
                <LabelValue label="Status" value={c.status} />
                <LabelValue label="Origem" value={c.origem ? (ORIGEM[c.origem] ?? c.origem) : null} />
                <LabelValue label="Tipo de unidade" value={c.unit_type} />
                <LabelValue label="Prazo pagamento" value={c.payment_term} />
                <LabelValue label="Cadastro" value={date(c.created_at)} />
                <LabelValue label="Último pedido" value={date(c.last_order_at)} />
                <LabelValue label="Total pedidos" value={String(c.total_orders ?? 0)} />
                <LabelValue label="Receita total" value={money(c.total_revenue ?? 0)} />
                <LabelValue label="Score" value={String(Math.round(c.reativacao_score ?? 0))} />
                {c.notes && <LabelValue label="Observações" value={c.notes} span />}
              </div>
            </TabsContent>

            <TabsContent value="pedidos" className="mt-5">
              {orders === null ? <Loading /> : orders.length === 0 ? <Empty text="Nenhum pedido" /> : (
                <>
                  <div className="space-y-1">
                    {orders.map(o => (
                      <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-[#F9FAFB] last:border-0">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-[#9CA3AF] tabular-nums w-20">{date(o.created_at)}</span>
                          <span className="text-[#6B7280] font-mono text-xs">{o.order_number ?? '—'}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${OSC[o.status] ?? 'bg-[#F3F4F6] text-[#6B7280]'}`}>{o.status}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#111827] tabular-nums">{money(o.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-right">
                    <span className="text-sm font-semibold text-[#111827] tabular-nums">Total: {money(total)}</span>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="tarefas" className="mt-5">
              {tasks === null ? <Loading /> : tasks.length === 0 ? <Empty text="Nenhuma tarefa nos últimos 90 dias" /> : (
                <div className="space-y-6">
                  {openTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Abertas ({openTasks.length})</p>
                      <div className="space-y-1">
                        {openTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2.5 px-3 bg-[#F9FAFB] rounded-lg">
                            <span className="text-sm text-[#111827]">{t.title}</span>
                            <span className="text-xs text-[#9CA3AF] tabular-nums">{date(t.due_date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {doneTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Concluídas ({doneTasks.length})</p>
                      <div className="space-y-1">
                        {doneTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2 px-3">
                            <span className="text-sm text-[#D1D5DB]">{t.title}</span>
                            <span className="text-xs text-[#D1D5DB] tabular-nums">{date(t.due_date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

const OSC: Record<string, string> = { approved: 'bg-emerald-50 text-emerald-700', invoiced: 'bg-[#EEF2FF] text-[#3B5BDB]', pending: 'bg-amber-50 text-amber-700' }

function LabelValue({ label, value, span }: { label: string; value: string | null | undefined; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[11px] text-[#9CA3AF] font-medium mb-1">{label}</p>
      <p className="text-sm text-[#111827]">{value || '—'}</p>
    </div>
  )
}

function Loading() { return <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ text }: { text: string }) { return <p className="py-16 text-center text-sm text-[#9CA3AF]">{text}</p> }
