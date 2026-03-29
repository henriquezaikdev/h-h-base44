import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Zap, Check, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClientesInativos, useExpandedOrders, useViewMode, type ClienteInativo } from '../hooks/useClientesInativos'
import { iniciarReativacao } from '../hooks/useReativacao'
import { ViewModeToggle } from '../components/inativos/ViewModeToggle'
import { PainelGuerra } from '../components/inativos/PainelGuerra'
import { BarraMeta } from '../components/inativos/BarraMeta'
import { FilaReativacao } from '../components/inativos/FilaReativacao'
import { SecaoJanelaLonga } from '../components/inativos/SecaoJanelaLonga'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

/* ═══════════════════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════════════════ */

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtDate = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') }
const fmtCnpj = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : v }
const ORIGEM: Record<string, string> = { prospeccao:'Prospecção', ligacao:'Prospecção', google:'Google', indicacao:'Indicação', filial:'Filial', porta_loja:'Veio à loja', conta_azul:'Conta Azul', conquistado:'Conquistado', outro:'Outro' }

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ClientesInativos() {
  const nav = useNavigate()
  const { seller } = useAuth()
  const { data, loading, refetch } = useClientesInativos()
  const { cache: ordersCache, loadOrders } = useExpandedOrders()
  const { mode, switchMode } = useViewMode()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [startingId, setStartingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [modalClient, setModalClient] = useState<ClienteInativo | null>(null)

  const clientes = (data?.clientes ?? []).filter(c => !hidden.has(c.id))
  const janelaClientes = data?.janela ?? []
  const resgatados = (data?.reativacoes ?? []).length
  const receita = (data?.reativacoes ?? []).reduce((s, r) => s + (r.valor_primeiro_pedido ?? 0), 0)

  function notify(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500) }

  function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadOrders(id)
  }

  async function handleStart(c: ClienteInativo) {
    if (!seller) return
    setStartingId(c.id)
    try {
      await iniciarReativacao({ companyId: seller.company_id, sellerId: seller.id, clientId: c.id, clientName: c.name })
      notify(true, `Reativação iniciada: ${c.name}`)
      refetch()
      nav(`/clientes/inativos/${c.id}`)
    } catch (e) { notify(false, String(e)) } finally { setStartingId(null) }
  }

  function handleDismiss(id: string) {
    setHidden(p => new Set(p).add(id))
    notify(true, 'Removido da fila')
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <button onClick={() => nav('/clientes')} className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#374151] mb-2 transition-colors">
            <ChevronLeft size={14} /> Clientes
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Reativação de Clientes</h1>
              <p className="text-sm text-[#9CA3AF] mt-0.5">
                {loading ? 'Carregando...' : `${clientes.length} clientes ranqueados por score`}
              </p>
            </div>
            <ViewModeToggle mode={mode} onChange={switchMode} />
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">

        {/* Banner interativo */}
        {mode === 'interativo' && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#111827] to-[#1E293B] rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Modo Interativo</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">Animações e game layer chegam em breve</p>
            </div>
            <span className="text-[10px] font-medium text-amber-400 border border-amber-400/30 px-2.5 py-1 rounded-full">EM BREVE</span>
          </motion.div>
        )}

        <PainelGuerra
          totalInativos={clientes.length}
          emReativacao={data?.emReativacao ?? 0}
          resgatados={resgatados}
          receita={receita}
          loading={loading}
        />

        <BarraMeta resgatados={resgatados} loading={loading} />

        {/* Fila header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#111827]">Fila de reativação</h2>
            <span className="text-xs text-[#9CA3AF] tabular-nums">{clientes.length} clientes</span>
          </div>
          <FilaReativacao
            clientes={clientes}
            loading={loading}
            expandedId={expandedId}
            ordersCache={ordersCache}
            startingId={startingId}
            onExpand={handleExpand}
            onOpenModal={setModalClient}
            onDismiss={handleDismiss}
            onStart={handleStart}
          />
        </div>

        <SecaoJanelaLonga clientes={janelaClientes} />
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
      {modalClient && <ClienteModal client={modalClient} onClose={() => setModalClient(null)} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

interface ModalOrder { id: string; order_number: string | null; total: number; status: string; created_at: string }
interface ModalTask { id: string; title: string; status: string; status_crm: string | null; due_date: string | null }

const OSC: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700',
  invoiced: 'bg-[#EEF2FF] text-[#3B5BDB]',
  pending: 'bg-amber-50 text-amber-700',
}

function ClienteModal({ client: c, onClose }: { client: ClienteInativo; onClose: () => void }) {
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
    supabase.from('tasks').select('id,title,status,status_crm,due_date')
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
            {c.cnpj && <span className="text-xs text-[#9CA3AF] font-mono">{fmtCnpj(c.cnpj)}</span>}
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
                <LV label="Nome" value={c.name} />
                <LV label="CNPJ" value={fmtCnpj(c.cnpj)} />
                <LV label="Telefone" value={c.phone} />
                <LV label="Email" value={c.email} />
                <LV label="Endereço" value={addr || null} span />
                <LV label="Cidade / UF" value={[c.city, c.state].filter(Boolean).join(' — ') || null} />
                <LV label="CEP" value={c.zip_code} />
                <LV label="Vendedor" value={c.sellers?.name ?? null} />
                <LV label="Status" value={c.status} />
                <LV label="Origem" value={c.origem ? (ORIGEM[c.origem] ?? c.origem) : null} />
                <LV label="Tipo de unidade" value={c.unit_type} />
                <LV label="Prazo pagamento" value={c.payment_term} />
                <LV label="Cadastro" value={fmtDate(c.created_at)} />
                <LV label="Último pedido" value={fmtDate(c.last_order_at)} />
                <LV label="Total pedidos" value={String(c.total_orders ?? 0)} />
                <LV label="Receita total" value={money(c.total_revenue ?? 0)} />
                <LV label="Score" value={String(Math.round(c.reativacao_score ?? 0))} />
                {c.notes && <LV label="Observações" value={c.notes} span />}
              </div>
            </TabsContent>

            <TabsContent value="pedidos" className="mt-5">
              {orders === null ? <Loader /> : orders.length === 0 ? <EmptyMsg text="Nenhum pedido" /> : (
                <>
                  <div className="space-y-1">
                    {orders.map(o => (
                      <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-[#F9FAFB] last:border-0">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-[#9CA3AF] tabular-nums w-20">{fmtDate(o.created_at)}</span>
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
              {tasks === null ? <Loader /> : tasks.length === 0 ? <EmptyMsg text="Nenhuma tarefa nos últimos 90 dias" /> : (
                <div className="space-y-6">
                  {openTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Abertas ({openTasks.length})</p>
                      {openTasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between py-2.5 px-3 bg-[#F9FAFB] rounded-lg mb-1">
                          <span className="text-sm text-[#111827]">{t.title}</span>
                          <span className="text-xs text-[#9CA3AF] tabular-nums">{fmtDate(t.due_date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {doneTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Concluídas ({doneTasks.length})</p>
                      {doneTasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between py-2 px-3 mb-1">
                          <span className="text-sm text-[#D1D5DB]">{t.title}</span>
                          <span className="text-xs text-[#D1D5DB] tabular-nums">{fmtDate(t.due_date)}</span>
                        </div>
                      ))}
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

function LV({ label, value, span }: { label: string; value: string | null | undefined; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[11px] text-[#9CA3AF] font-medium mb-1">{label}</p>
      <p className="text-sm text-[#111827]">{value || '—'}</p>
    </div>
  )
}

function Loader() { return <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" /></div> }
function EmptyMsg({ text }: { text: string }) { return <p className="py-16 text-center text-sm text-[#9CA3AF]">{text}</p> }
