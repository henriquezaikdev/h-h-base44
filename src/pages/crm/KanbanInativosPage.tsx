import { useState, useEffect, useCallback } from 'react'
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
  id: string; name: string; cnpj: string | null; phone: string | null; email: string | null
  seller_id: string | null; origem: string | null; last_order_at: string | null
  total_orders: number | null; total_revenue: number | null; reativacao_score: number | null
  created_at: string; status: string; city: string | null; state: string | null
  street: string | null; street_number: string | null; complement: string | null
  neighborhood: string | null; zip_code: string | null; ie: string | null
  payment_term: string | null; unit_type: string | null; janela_longa: boolean | null
  notes: string | null; sellers: { name: string } | null
}
interface JanelaLongaClient {
  id: string; name: string; cnpj: string | null
  intervalo_medio_dias: number | null; proxima_compra_estimada: string | null
  sellers: { name: string } | null
}
interface ExpandOrder { id: string; total: number; created_at: string; order_items: { products: { name: string } | null }[] }
interface Reativacao { id: string; data_reativacao: string; valor_primeiro_pedido: number | null }
interface ModalOrder { id: string; order_number: string | null; total: number; status: string; created_at: string }
interface ModalTask { id: string; title: string; status: string; status_crm: string | null; due_date: string | null; priority_crm: string | null }
type RStatus = 'nao_iniciado' | 'em_contato' | 'negociando' | 'perdido'
type VMode = 'normal' | 'interativo'
interface QResult { inactiveClients: InactiveClient[]; janelaLongaClients: JanelaLongaClient[]; reativacoesMes: Reativacao[]; atRiskCount: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ds = (d: string | null): number | null => { if (!d) return null; return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000) }
const fc = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fd = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
const fCNPJ = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); if (d.length !== 14) return v; return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` }

const ORIGEM: Record<string, string> = { prospeccao:'Prospecção', ligacao:'Prospecção', google:'Google', indicacao:'Indicação', filial:'Filial', porta_loja:'Veio à loja', conta_azul:'Conta Azul', conquistado:'Conquistado', outro:'Outro' }
const META = 10
const ST: Record<RStatus, { l: string; bg: string; tx: string }> = {
  nao_iniciado: { l: 'Nao iniciado', bg: 'bg-[#F3F4F6]', tx: 'text-[#6B7280]' },
  em_contato:   { l: 'Em contato',   bg: 'bg-amber-50',  tx: 'text-amber-700' },
  negociando:   { l: 'Negociando',   bg: 'bg-[#EEF2FF]', tx: 'text-[#3B5BDB]' },
  perdido:      { l: 'Perdido',      bg: 'bg-red-50',    tx: 'text-red-600' },
}
const OSC: Record<string, string> = { approved:'bg-emerald-50 text-emerald-700', invoiced:'bg-[#EEF2FF] text-[#3B5BDB]', pending:'bg-amber-50 text-amber-700', created:'bg-[#F3F4F6] text-[#6B7280]' }

// ─── Component ────────────────────────────────────────────────────────────────

export default function KanbanInativosPage() {
  const nav = useNavigate()
  const { seller } = useAuth()
  const [expId, setExpId] = useState<string | null>(null)
  const [stMap, setStMap] = useState<Record<string, RStatus>>({})
  const [spOpen, setSpOpen] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [expOrds, setExpOrds] = useState<Record<string, ExpandOrder[]>>({})
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ t: 'ok' | 'err'; m: string } | null>(null)
  const [vMode, setVMode] = useState<VMode>('normal')
  const [modal, setModal] = useState<InactiveClient | null>(null)

  useEffect(() => {
    if (!seller) return
    supabase.from('sellers').select('ui_mode').eq('id', seller.id).single()
      .then(({ data }) => { if (data?.ui_mode === 'interativo') setVMode('interativo') })
  }, [seller])

  // ── Query ───────────────────────────────────────────────────────────────
  const { data, loading, refetch } = useSupabaseQuery<QResult>(async ({ company_id }) => {
    const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const [a, b, c, d] = await Promise.all([
      supabase.from('clients')
        .select('id,name,cnpj,phone,email,seller_id,origem,last_order_at,total_orders,total_revenue,reativacao_score,created_at,status,city,state,street,street_number,complement,neighborhood,zip_code,ie,payment_term,unit_type,janela_longa,notes,sellers(name)')
        .eq('company_id', company_id).eq('status', 'inactive').eq('janela_longa', false).neq('origem', 'filial')
        .order('reativacao_score', { ascending: false, nullsFirst: false }).limit(50),
      supabase.from('clients')
        .select('id,name,cnpj,intervalo_medio_dias,proxima_compra_estimada,sellers(name)')
        .eq('company_id', company_id).eq('janela_longa', true).neq('origem', 'filial'),
      supabase.from('client_reativacoes')
        .select('id,data_reativacao,valor_primeiro_pedido')
        .eq('company_id', company_id).gte('data_reativacao', ms),
      supabase.from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company_id).eq('status', 'at_risk').neq('origem', 'filial'),
    ])
    if (a.error) return { data: null, error: a.error }
    return { data: { inactiveClients: (a.data??[]) as unknown as InactiveClient[], janelaLongaClients: (b.data??[]) as unknown as JanelaLongaClient[], reativacoesMes: (c.data??[]) as unknown as Reativacao[], atRiskCount: d.count??0 }, error: null }
  }, [])

  useEffect(() => { const iv = setInterval(refetch, 30_000); return () => clearInterval(iv) }, [refetch])

  const cls = data?.inactiveClients ?? []
  const jls = data?.janelaLongaClients ?? []
  const reats = data?.reativacoesMes ?? []
  const atR = data?.atRiskCount ?? 0
  const resg = reats.length
  const rec = reats.reduce((s, r) => s + (r.valor_primeiro_pedido ?? 0), 0)
  const pct = Math.min(100, (resg / META) * 100)
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const pCls = pct < 30 ? '[&>div]:bg-red-500' : pct < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
  const vis = cls.filter(c => !discarded.has(c.id))

  // ── Actions ─────────────────────────────────────────────────────────────
  const fetchExp = useCallback(async (id: string) => {
    if (expOrds[id]) return
    const { data: o } = await supabase.from('orders').select('id,total,created_at,order_items(products(name))')
      .eq('client_id', id).in('status', ['approved','invoiced']).order('created_at', { ascending: false }).limit(3)
    setExpOrds(p => ({ ...p, [id]: (o??[]) as unknown as ExpandOrder[] }))
  }, [expOrds])

  function toggleExp(id: string) { if (expId === id) setExpId(null); else { setExpId(id); fetchExp(id) } }

  async function iniciar(c: InactiveClient) {
    if (!seller) return; setCreating(c.id)
    try {
      const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      const { error } = await supabase.from('tasks').insert({
        title: `Reativacao: ${c.name}`, status: 'open', status_crm: 'pendente', priority: 'high', priority_crm: 'alta',
        client_id: c.id, assigned_to_seller_id: seller.id, assigned_to: seller.id, created_by_seller_id: seller.id,
        company_id: seller.company_id, due_date: due, task_date: due, task_category: 'reativacao', source_module: 'inativos',
      })
      if (error) { showT('err', error.message); return }
      setStMap(p => ({ ...p, [c.id]: 'em_contato' }))
      showT('ok', `Reativacao iniciada para ${c.name}`)
      refetch()
    } catch (e) { showT('err', String(e)) } finally { setCreating(null) }
  }

  function descartar(id: string) { setDiscarded(p => new Set(p).add(id)); showT('ok', 'Cliente removido da fila') }
  async function toggleMode(m: VMode) { setVMode(m); if (seller) await supabase.from('sellers').update({ ui_mode: m }).eq('id', seller.id) }
  function showT(t: 'ok' | 'err', m: string) { setToast({ t, m }); setTimeout(() => setToast(null), 4000) }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* HEADER */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <button onClick={() => nav('/clientes')} className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors">
          <ChevronLeft size={14} /> Carteira de Clientes
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Clientes Inativos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{loading ? 'Carregando...' : `${cls.length} clientes ranqueados por score`}</p>
          </div>
          <div className="flex items-center rounded-lg border border-[#E5E7EB] p-0.5">
            {(['normal','interativo'] as VMode[]).map(m => (
              <button key={m} onClick={() => toggleMode(m)} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${vMode===m ? 'bg-[#3B5BDB] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}>
                {m==='normal' ? <LayoutList size={13} /> : <Zap size={13} />}
                {m==='normal' ? 'Normal' : 'Interativo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4 max-w-[1400px] mx-auto">
        {/* INTERATIVO BANNER */}
        {vMode==='interativo' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Zap size={16} className="text-amber-600 shrink-0" />
            <div><p className="text-sm font-medium text-amber-800">Modo Interativo em construção</p><p className="text-xs text-amber-600 mt-0.5">Animações e game layer chegam em breve</p></div>
            <span className="ml-auto text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Em breve</span>
          </div>
        )}

        {/* METRICS */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { l:'Total de Inativos', v:String(cls.length), ic:Target, bg:'bg-red-50', cl:'text-red-500' },
            { l:'Em Reativação',     v:String(atR),         ic:Zap, bg:'bg-amber-50', cl:'text-amber-500' },
            { l:'Resgatados no Mês', v:String(resg),        ic:TrendingUp, bg:'bg-emerald-50', cl:'text-emerald-600' },
            { l:'Receita Recuperada',v:fc(rec),             ic:DollarSign, bg:'bg-[#EEF2FF]', cl:'text-[#3B5BDB]' },
          ].map(({ l, v, ic:Ic, bg, cl }) => (
            <div key={l} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wider font-medium">{l}</p>
                  <p className="text-3xl font-semibold text-[#111827] tabular-nums mt-2 leading-none">{loading ? '—' : v}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Ic size={18} className={cl} strokeWidth={1.75} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PROGRESS */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#111827]">{resg} / {META} clientes reativados em {mes}</p>
            <span className="text-xs font-semibold text-[#6B7280] tabular-nums">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className={`h-2 ${pCls}`} />
          <p className={`text-xs mt-2 ${resg>=META ? 'text-emerald-600 font-medium' : 'text-[#9CA3AF]'}`}>
            {resg>=META ? 'Meta atingida!' : `Faltam ${META-resg} clientes para bater a meta`}
          </p>
        </div>

        {/* FILA */}
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-20 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#9CA3AF]">Carregando fila de batalha...</span>
          </div>
        ) : vis.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-20 text-center">
            <Target size={40} className="text-[#D1D5DB] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#6B7280]">Nenhum cliente inativo na fila</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {vis.map((c, i) => {
                const exp = expId === c.id
                const dias = ds(c.last_order_at)
                const meses = Math.max(1, Math.ceil((ds(c.created_at) ?? 365) / 30))
                const valMes = (c.total_revenue ?? 0) / meses
                const st = stMap[c.id] ?? 'nao_iniciado'
                const stc = ST[st]
                const ords = expOrds[c.id]
                const dCor = dias !== null && dias > 120 ? 'text-red-600' : dias !== null && dias > 60 ? 'text-amber-600' : 'text-[#6B7280]'
                const dIco = dias !== null && dias > 120 ? 'text-red-400' : dias !== null && dias > 60 ? 'text-amber-400' : 'text-[#9CA3AF]'

                return (
                  <motion.div key={c.id} layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -60, transition: { duration: 0.25 } }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <div className={`bg-white border rounded-xl transition-all ${exp ? 'border-[#3B5BDB]/30 shadow-[0_2px_12px_0_rgb(59,91,219,0.08)]' : 'border-[#E5E7EB] hover:border-[#C7D2FE]'}`}>
                      <div className="p-4 cursor-pointer" onClick={() => toggleExp(c.id)}>
                        {/* Linha 1: nome + score + status */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="w-7 h-7 rounded-lg bg-[#F3F4F6] text-[10px] font-bold text-[#6B7280] flex items-center justify-center shrink-0 tabular-nums">{i+1}</span>

                          <button onClick={e => { e.stopPropagation(); setModal(c) }}
                            className="text-[15px] font-semibold text-[#111827] hover:text-[#3B5BDB] transition-colors truncate text-left">
                            {c.name}
                          </button>

                          {c.cnpj && <span className="text-[11px] text-[#9CA3AF] font-mono shrink-0 hidden md:inline">{fCNPJ(c.cnpj)}</span>}

                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EEF2FF] text-[#3B5BDB] tabular-nums min-w-[48px] justify-center">
                              {Math.round(c.reativacao_score ?? 0)}
                            </span>
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium ${stc.bg} ${stc.tx}`}>{stc.l}</span>
                            {exp ? <ChevronUp size={16} className="text-[#9CA3AF]" /> : <ChevronDown size={16} className="text-[#9CA3AF]" />}
                          </div>
                        </div>

                        {/* Linha 2: infos + ações */}
                        <div className="flex items-center gap-6 pl-10">
                          <span className="text-xs text-[#6B7280]">Valia <span className="font-semibold text-[#374151]">{fc(valMes)}</span>/mês</span>

                          <div className="flex items-center gap-1">
                            <Clock size={12} className={dIco} />
                            <span className={`text-xs font-semibold tabular-nums ${dCor}`}>
                              {dias !== null ? `${dias} dias` : '—'}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF]">sem comprar</span>
                          </div>

                          <span className="text-xs text-[#9CA3AF]">{c.sellers?.name ?? '—'}</span>

                          {c.origem && <span className="text-[10px] text-[#9CA3AF] bg-[#F9FAFB] px-1.5 py-0.5 rounded">{ORIGEM[c.origem] ?? c.origem}</span>}

                          {/* Ações */}
                          <div className="ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            {c.phone && (
                              <>
                                <a href={`tel:${c.phone}`} title="Ligar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                                  <Phone size={14} />
                                </a>
                                <a href={`https://wa.me/55${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" title="WhatsApp"
                                   className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                  <MessageCircle size={14} />
                                </a>
                              </>
                            )}
                            <button onClick={() => descartar(c.id)} title="Descartar da fila"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 transition-colors">
                              <XCircle size={14} />
                            </button>

                            {st === 'nao_iniciado' ? (
                              <button onClick={() => iniciar(c)} disabled={creating===c.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors">
                                <Plus size={12} />{creating===c.id ? '...' : 'Iniciar'}
                              </button>
                            ) : st === 'em_contato' ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg">
                                <Check size={12} /> Task criada
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED */}
                      <AnimatePresence>
                        {exp && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="px-4 pb-4 pt-2 border-t border-[#F3F4F6] ml-10">
                              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Últimos pedidos</p>
                              {!ords ? <p className="text-xs text-[#9CA3AF]">Carregando...</p> : ords.length === 0 ? <p className="text-xs text-[#9CA3AF]">Nenhum pedido</p> : (
                                <div className="space-y-1.5">
                                  {ords.map(o => (
                                    <div key={o.id} className="flex items-center justify-between text-sm py-1">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-[#9CA3AF] tabular-nums w-16">{fd(o.created_at)}</span>
                                        <span className="text-[#374151]">{o.order_items?.[0]?.products?.name ?? '—'}</span>
                                      </div>
                                      <span className="font-semibold text-[#111827] tabular-nums">{fc(o.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] text-[#9CA3AF] mt-3 pt-2 border-t border-[#F9FAFB]">
                                Histórico: {c.total_orders ?? 0} pedidos · {fc(c.total_revenue ?? 0)} total
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

        {/* SILÊNCIO PROGRAMADO */}
        {jls.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <button onClick={() => setSpOpen(p => !p)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center gap-2.5">
                <Moon size={15} className="text-[#6B7280]" />
                <span className="text-sm font-medium text-[#111827]">Clientes em Silêncio Programado</span>
                <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full tabular-nums">{jls.length}</span>
              </div>
              {spOpen ? <ChevronUp size={15} className="text-[#9CA3AF]" /> : <ChevronDown size={15} className="text-[#9CA3AF]" />}
            </button>
            <AnimatePresence>
              {spOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="border-t border-[#F3F4F6] divide-y divide-[#F3F4F6]">
                    {jls.map(j => {
                      const aberta = j.proxima_compra_estimada ? new Date(j.proxima_compra_estimada) < new Date() : false
                      return (
                        <div key={j.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <button onClick={() => nav(`/clientes/${j.id}`)} className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors">{j.name}</button>
                            <div className="flex items-center gap-3 mt-0.5">
                              {j.cnpj && <span className="text-[10px] text-[#9CA3AF] font-mono">{fCNPJ(j.cnpj)}</span>}
                              <span className="text-xs text-[#6B7280]">{j.sellers?.name ?? '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-[#6B7280]">Intervalo: <span className="font-semibold tabular-nums">{j.intervalo_medio_dias ?? '—'}d</span></p>
                              <p className="text-xs text-[#9CA3AF]">Próxima: {j.proxima_compra_estimada ? fd(j.proxima_compra_estimada) : '—'}</p>
                            </div>
                            {aberta && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700"><AlertTriangle size={10} /> Janela Aberta</span>}
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

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.t==='ok' ? 'bg-[#111827] text-white' : 'bg-red-600 text-white'}`}>
            {toast.t==='ok' ? <Check size={14} /> : <AlertTriangle size={14} />}{toast.m}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL */}
      {modal && <DetailModal c={modal} close={() => setModal(null)} />}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ c, close }: { c: InactiveClient; close: () => void }) {
  const [tab, setTab] = useState('cadastro')
  const [ords, setOrds] = useState<ModalOrder[] | null>(null)
  const [tsks, setTsks] = useState<ModalTask[] | null>(null)

  useEffect(() => {
    if (tab !== 'pedidos' || ords !== null) return
    supabase.from('orders').select('id,order_number,total,status,created_at')
      .eq('client_id', c.id).in('status', ['approved','invoiced','pending']).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setOrds((data ?? []) as ModalOrder[]))
  }, [tab, c.id, ords])

  useEffect(() => {
    if (tab !== 'interacoes' || tsks !== null) return
    supabase.from('tasks').select('id,title,status,status_crm,due_date,priority_crm')
      .eq('client_id', c.id).gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setTsks((data ?? []) as ModalTask[]))
  }, [tab, c.id, tsks])

  const tot = (ords??[]).reduce((s, o) => s + (o.total ?? 0), 0)
  const opn = (tsks??[]).filter(t => t.status === 'open' || t.status_crm === 'pendente')
  const don = (tsks??[]).filter(t => t.status === 'done' || t.status_crm === 'concluida')
  const addr = [c.street, c.street_number, c.complement, c.neighborhood].filter(Boolean).join(', ')

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-semibold text-[#111827]">{c.name}</DialogTitle>
            {c.cnpj && <span className="text-xs text-[#9CA3AF] font-mono">{fCNPJ(c.cnpj)}</span>}
            {c.origem === 'filial' && <span className="text-[10px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Filial</span>}
            {c.janela_longa && <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Janela Longa</span>}
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
                <Fl l="Nome" v={c.name} /><Fl l="CNPJ" v={fCNPJ(c.cnpj)} />
                <Fl l="Telefone" v={c.phone} /><Fl l="Email" v={c.email} />
                <Fl l="Endereço" v={addr||null} s /><Fl l="Cidade / UF" v={[c.city,c.state].filter(Boolean).join(' — ')||null} />
                <Fl l="CEP" v={c.zip_code} /><Fl l="IE" v={c.ie} />
                <Fl l="Vendedor" v={c.sellers?.name??null} /><Fl l="Status" v={c.status} />
                <Fl l="Origem" v={c.origem ? (ORIGEM[c.origem]??c.origem) : null} />
                <Fl l="Tipo de Unidade" v={c.unit_type} /><Fl l="Prazo Pagamento" v={c.payment_term} />
                <Fl l="Data Cadastro" v={fd(c.created_at)} /><Fl l="Último Pedido" v={fd(c.last_order_at)} />
                <Fl l="Total Pedidos" v={String(c.total_orders??0)} /><Fl l="Receita Total" v={fc(c.total_revenue??0)} />
                <Fl l="Score" v={String(Math.round(c.reativacao_score??0))} />
                {c.notes && <Fl l="Observações" v={c.notes} s />}
              </div>
            </TabsContent>
            <TabsContent value="pedidos" className="mt-4">
              {ords===null ? <p className="text-sm text-[#9CA3AF] py-12 text-center">Carregando...</p> : ords.length===0 ? <p className="text-sm text-[#9CA3AF] py-12 text-center">Nenhum pedido</p> : (
                <>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#E5E7EB]">
                      <th className="text-left pb-2.5 text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Data</th>
                      <th className="text-left pb-2.5 text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Pedido</th>
                      <th className="text-right pb-2.5 text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Valor</th>
                      <th className="text-left pb-2.5 pl-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {ords.map(o => (
                        <tr key={o.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2.5 text-[#374151] tabular-nums">{fd(o.created_at)}</td>
                          <td className="py-2.5 text-[#6B7280] font-mono text-xs">{o.order_number??'—'}</td>
                          <td className="py-2.5 text-right font-semibold text-[#111827] tabular-nums">{fc(o.total)}</td>
                          <td className="py-2.5 pl-4"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${OSC[o.status]??'bg-[#F3F4F6] text-[#6B7280]'}`}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex justify-end">
                    <span className="text-sm font-semibold text-[#111827] tabular-nums">Total: {fc(tot)}</span>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="interacoes" className="mt-4">
              {tsks===null ? <p className="text-sm text-[#9CA3AF] py-12 text-center">Carregando...</p> : tsks.length===0 ? <p className="text-sm text-[#9CA3AF] py-12 text-center">Nenhuma tarefa nos últimos 90 dias</p> : (
                <div className="space-y-5">
                  {opn.length > 0 && <div>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Abertas ({opn.length})</p>
                    <div className="space-y-1.5">{opn.map(t => (
                      <div key={t.id} className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2.5 text-sm">
                        <span className="text-[#111827] truncate">{t.title}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {t.priority_crm && <span className="text-[10px] bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded">{t.priority_crm}</span>}
                          <span className="text-xs text-[#9CA3AF] tabular-nums">{fd(t.due_date)}</span>
                        </div>
                      </div>
                    ))}</div>
                  </div>}
                  {don.length > 0 && <div>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Concluídas ({don.length})</p>
                    <div className="space-y-1">{don.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-[#9CA3AF]">{t.title}</span>
                        <span className="text-xs text-[#D1D5DB] tabular-nums">{fd(t.due_date)}</span>
                      </div>
                    ))}</div>
                  </div>}
                </div>
              )}
            </TabsContent>
            <TabsContent value="memoria" className="mt-4">
              <div className="py-12 text-center"><p className="text-sm text-[#9CA3AF]">Nenhuma memória comercial registrada ainda.</p></div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function Fl({ l, v, s }: { l: string; v: string | null | undefined; s?: boolean }) {
  return <div className={s ? 'col-span-2' : ''}><p className="text-[11px] text-[#6B7280] uppercase tracking-wider font-medium mb-1">{l}</p><p className="text-[#111827]">{v || '—'}</p></div>
}
