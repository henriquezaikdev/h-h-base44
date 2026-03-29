import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Phone, MessageCircle, Mail, MapPin,
  Check, AlertTriangle, Plus, Clock, FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useSupabaseQuery } from '../hooks/useSupabaseQuery'
import { confirmarReativacao, marcarPerdido, registrarContato } from '../hooks/useReativacao'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface Cliente {
  id: string; name: string; cnpj: string | null; phone: string | null; email: string | null
  seller_id: string | null; origem: string | null; last_order_at: string | null
  total_orders: number | null; total_revenue: number | null; reativacao_score: number | null
  reativacao_status: string | null; reativacao_sugestao_ia: string | null
  created_at: string; status: string; city: string | null; state: string | null
  street: string | null; street_number: string | null; neighborhood: string | null
  zip_code: string | null; ie: string | null; notes: string | null
  sellers: { name: string } | null
}

interface Contato {
  id: string; tipo: string; resultado: string | null; observacao: string | null; created_at: string
}

interface Pedido {
  id: string; order_number: string | null; total: number; status: string; created_at: string
}

interface Tarefa {
  id: string; title: string; status: string; status_crm: string | null; due_date: string | null
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════════════════ */

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtDate = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') }
const fmtDateTime = (d: string) => new Date(String(d).replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtCnpj = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : v }
const daysAgo = (d: string | null) => { if (!d) return 0; return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000) }

const ORIGEM: Record<string, string> = { prospeccao:'Prospecção', ligacao:'Prospecção', google:'Google', indicacao:'Indicação', filial:'Filial', porta_loja:'Veio à loja', conta_azul:'Conta Azul', conquistado:'Conquistado', outro:'Outro' }

const TIPOS_CONTATO = [
  { value: 'ligacao', label: 'Ligação', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'visita', label: 'Visita', icon: MapPin },
  { value: 'outro', label: 'Outro', icon: FileText },
]

const RESULTADOS = [
  { value: 'nao_atendeu', label: 'Não atendeu' },
  { value: 'sem_interesse', label: 'Atendeu, sem interesse' },
  { value: 'com_interesse', label: 'Atendeu, com interesse' },
]

const MOTIVOS_PERDA = [
  'Compra na concorrência',
  'Encerrou atividades',
  'Não tem interesse',
  'Sem contato possível',
  'Outro',
]

const STATUS_PILL: Record<string, { label: string; bg: string; text: string }> = {
  em_reativacao: { label: 'Em reativação', bg: 'bg-[#EEF2FF]', text: 'text-[#3B5BDB]' },
  resgatado: { label: 'Resgatado', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  perdido: { label: 'Perdido', bg: 'bg-red-50', text: 'text-red-600' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ReativacaoCliente() {
  const { clientId } = useParams<{ clientId: string }>()
  const nav = useNavigate()
  const { seller } = useAuth()

  const [showContatoForm, setShowContatoForm] = useState(false)
  const [contatoTipo, setContatoTipo] = useState('ligacao')
  const [contatoResultado, setContatoResultado] = useState('')
  const [contatoObs, setContatoObs] = useState('')
  const [savingContato, setSavingContato] = useState(false)

  const [showConfirmar, setShowConfirmar] = useState(false)
  const [valorPedido, setValorPedido] = useState('')
  const [savingConfirmar, setSavingConfirmar] = useState(false)

  const [showPerder, setShowPerder] = useState(false)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [savingPerder, setSavingPerder] = useState(false)

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [savingNewTask, setSavingNewTask] = useState(false)

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: cliente, loading: clienteLoading } = useSupabaseQuery<Cliente>(
    ({ company_id }) => supabase.from('clients').select('*,sellers(name)')
      .eq('company_id', company_id).eq('id', clientId!).single(),
    [clientId],
  )

  const { data: contatos, refetch: refetchContatos } = useSupabaseQuery<Contato[]>(
    ({ company_id }) => supabase.from('reativacao_contatos').select('*')
      .eq('company_id', company_id).eq('client_id', clientId!)
      .order('created_at', { ascending: false }),
    [clientId],
  )

  // Lazy-loaded tabs
  const [tabDir, setTabDir] = useState('dados')
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)

  useEffect(() => {
    if (tabDir !== 'historico' || pedidos !== null || !clientId) return
    supabase.from('orders').select('id,order_number,total,status,created_at')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setPedidos((data ?? []) as Pedido[]))
  }, [tabDir, clientId, pedidos])

  useEffect(() => {
    if (tabDir !== 'tarefas' || tarefas !== null || !clientId) return
    supabase.from('tasks').select('id,title,status,status_crm,due_date')
      .eq('client_id', clientId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setTarefas((data ?? []) as Tarefa[]))
  }, [tabDir, clientId, tarefas])

  function notify(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000) }

  async function handleCreateTask() {
    if (!seller || !clientId || !newTaskTitle.trim()) return
    setSavingNewTask(true)
    try {
      const due = newTaskDue || new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
      const { error } = await supabase.from('tasks').insert({
        company_id: seller.company_id, title: newTaskTitle.trim(),
        status: 'open', status_crm: 'pendente', priority: 'high', priority_crm: 'alta',
        client_id: clientId, assigned_to_seller_id: seller.id, assigned_to: seller.id,
        created_by_seller_id: seller.id, due_date: due, task_date: due,
        task_category: 'reativacao', source_module: 'inativos',
      })
      if (error) { notify(false, error.message); return }
      setShowNewTask(false); setNewTaskTitle(''); setNewTaskDue('')
      setTarefas(null) // force reload
      notify(true, 'Tarefa criada')
    } catch (e) { notify(false, String(e)) } finally { setSavingNewTask(false) }
  }

  // ── Actions ───────────────────────────────────────────────────────────

  async function handleSalvarContato() {
    if (!seller || !clientId || !contatoResultado) return
    setSavingContato(true)
    try {
      await registrarContato({
        companyId: seller.company_id, sellerId: seller.id, clientId,
        tipo: contatoTipo, resultado: contatoResultado, observacao: contatoObs,
      })
      setShowContatoForm(false)
      setContatoTipo('ligacao'); setContatoResultado(''); setContatoObs('')
      refetchContatos()
      notify(true, 'Contato registrado')
    } catch (e) { notify(false, String(e)) } finally { setSavingContato(false) }
  }

  async function handleConfirmar() {
    if (!seller || !clientId || !valorPedido) return
    setSavingConfirmar(true)
    try {
      const { xp } = await confirmarReativacao({
        companyId: seller.company_id, sellerId: seller.id, clientId,
        valorPrimeiroPedido: parseFloat(valorPedido), diasInativo: daysAgo(cliente?.last_order_at ?? null),
        streakDia: 0,
      })
      notify(true, `Cliente reativado! +${xp} XP`)
      setTimeout(() => nav('/clientes/inativos'), 1500)
    } catch (e) { notify(false, String(e)) } finally { setSavingConfirmar(false) }
  }

  async function handlePerder() {
    if (!clientId || !motivoPerda) return
    setSavingPerder(true)
    try {
      await marcarPerdido({ clientId, motivo: motivoPerda })
      notify(true, 'Cliente marcado como perdido')
      setTimeout(() => nav('/clientes/inativos'), 1500)
    } catch (e) { notify(false, String(e)) } finally { setSavingPerder(false) }
  }

  // ── Loading / error ──────────────────────────────────────────────────

  if (clienteLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">Cliente não encontrado</p>
        <button onClick={() => nav('/clientes/inativos')} className="text-sm text-[#3B5BDB] hover:underline">← Voltar</button>
      </div>
    )
  }

  const st = STATUS_PILL[cliente.reativacao_status ?? ''] ?? { label: 'Não iniciado', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' }
  const isFinal = cliente.reativacao_status === 'resgatado' || cliente.reativacao_status === 'perdido'
  const addr = [cliente.street, cliente.street_number, cliente.neighborhood].filter(Boolean).join(', ')
  const safeContatos = contatos ?? []

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <button onClick={() => nav('/clientes/inativos')} className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#374151] mb-2 transition-colors">
            <ChevronLeft size={14} /> Voltar para inativos
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#111827] tracking-tight">{cliente.name}</h1>
            {cliente.cnpj && <span className="text-xs text-[#9CA3AF] font-mono">{fmtCnpj(cliente.cnpj)}</span>}
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
          </div>
        </div>
      </div>

      {/* ═══ BODY — Two columns ═══ */}
      <div className="max-w-[1280px] mx-auto px-6 py-6 flex gap-6 items-start">

        {/* ── COLUNA ESQUERDA (60%) ──────────────────────────────────── */}
        <div className="flex-[3] min-w-0 space-y-6">

          {/* Stepper */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-4">
              <Step active={cliente.reativacao_status === 'em_reativacao'} done={isFinal} label="Em reativação" />
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <Step
                active={isFinal}
                done={cliente.reativacao_status === 'resgatado'}
                label={cliente.reativacao_status === 'perdido' ? 'Perdido' : 'Resgatado'}
                error={cliente.reativacao_status === 'perdido'}
              />
            </div>
          </div>

          {/* Contatos */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#111827]">Registro de contatos</h2>
              {!isFinal && (
                <button onClick={() => setShowContatoForm(p => !p)}
                  className="flex items-center gap-1 text-xs font-medium text-[#3B5BDB] hover:text-[#3451C7] transition-colors">
                  <Plus size={12} /> Registrar contato
                </button>
              )}
            </div>

            {/* Form inline */}
            <AnimatePresence>
              {showContatoForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border border-[#E5E7EB] rounded-lg p-4 mb-4 space-y-4">

                    <div>
                      <p className="text-[11px] text-[#9CA3AF] font-medium mb-2">Tipo de contato</p>
                      <div className="flex flex-wrap gap-2">
                        {TIPOS_CONTATO.map(({ value, label, icon: Ic }) => (
                          <button key={value} onClick={() => setContatoTipo(value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              contatoTipo === value
                                ? 'border-[#3B5BDB] bg-[#EEF2FF] text-[#3B5BDB]'
                                : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]'
                            }`}>
                            <Ic size={12} /> {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#9CA3AF] font-medium mb-2">Resultado</p>
                      <div className="flex flex-wrap gap-2">
                        {RESULTADOS.map(({ value, label }) => (
                          <button key={value} onClick={() => setContatoResultado(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              contatoResultado === value
                                ? 'border-[#3B5BDB] bg-[#EEF2FF] text-[#3B5BDB]'
                                : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-[#9CA3AF] font-medium mb-1">Observação</p>
                      <textarea value={contatoObs} onChange={e => setContatoObs(e.target.value)} rows={2}
                        placeholder="Detalhes do contato..."
                        className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#D1D5DB] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition resize-none" />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setShowContatoForm(false)} className="px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#374151] transition-colors">
                        Cancelar
                      </button>
                      <button onClick={handleSalvarContato} disabled={savingContato || !contatoResultado}
                        className="px-4 py-1.5 text-xs font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors">
                        {savingContato ? 'Salvando...' : 'Salvar contato'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lista contatos */}
            {safeContatos.length === 0 ? (
              <p className="text-sm text-[#D1D5DB] text-center py-8">Nenhum contato registrado ainda</p>
            ) : (
              <div className="space-y-2">
                {safeContatos.map(ct => (
                  <div key={ct.id} className="flex items-start gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 mt-0.5">
                      {ct.tipo === 'ligacao' ? <Phone size={12} className="text-[#6B7280]" /> :
                       ct.tipo === 'whatsapp' ? <MessageCircle size={12} className="text-[#6B7280]" /> :
                       ct.tipo === 'email' ? <Mail size={12} className="text-[#6B7280]" /> :
                       <FileText size={12} className="text-[#6B7280]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#9CA3AF] tabular-nums">{fmtDateTime(ct.created_at)}</span>
                        <span className="capitalize text-[#6B7280]">{ct.tipo}</span>
                        {ct.resultado && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ct.resultado === 'com_interesse' ? 'bg-emerald-50 text-emerald-700' :
                            ct.resultado === 'nao_atendeu' ? 'bg-[#F3F4F6] text-[#9CA3AF]' :
                            'bg-amber-50 text-amber-700'
                          }`}>{ct.resultado.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                      {ct.observacao && <p className="text-sm text-[#374151] mt-1">{ct.observacao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IA Suggestion */}
          {cliente.reativacao_sugestao_ia && (
            <div className="bg-[#EEF2FF] rounded-xl px-5 py-4">
              <p className="text-[10px] font-semibold text-[#3B5BDB] uppercase tracking-widest mb-1.5">Sugestão da IA</p>
              <p className="text-sm text-[#374151] leading-relaxed">{cliente.reativacao_sugestao_ia}</p>
            </div>
          )}

          {/* Criar orçamento */}
          {!isFinal && (
            <button
              onClick={() => nav('/pedidos', { state: { clientId: cliente.id, openNewOrder: true } })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#3B5BDB] border border-[#3B5BDB]/20 rounded-xl hover:bg-[#EEF2FF] transition-colors"
            >
              <FileText size={14} /> Criar orçamento para este cliente
            </button>
          )}

          {/* Ações finais */}
          {!isFinal && (
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPerder(p => !p)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                Marcar como perdido
              </button>
              <button onClick={() => setShowConfirmar(p => !p)}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                Confirmar reativação
              </button>
            </div>
          )}

          {/* Confirm inline */}
          <AnimatePresence>
            {showConfirmar && !isFinal && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-white border border-emerald-200 rounded-xl p-5 space-y-3">
                  <p className="text-sm font-medium text-[#111827]">Valor do primeiro pedido (R$)</p>
                  <input type="number" value={valorPedido} onChange={e => setValorPedido(e.target.value)}
                    placeholder="0,00" min="0" step="0.01"
                    className="w-48 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition tabular-nums" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowConfirmar(false)} className="px-3 py-1.5 text-xs text-[#6B7280]">Cancelar</button>
                    <button onClick={handleConfirmar} disabled={savingConfirmar || !valorPedido}
                      className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {savingConfirmar ? 'Confirmando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Perder inline */}
          <AnimatePresence>
            {showPerder && !isFinal && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-white border border-red-200 rounded-xl p-5 space-y-3">
                  <p className="text-sm font-medium text-[#111827]">Motivo da perda</p>
                  <div className="flex flex-wrap gap-2">
                    {MOTIVOS_PERDA.map(m => (
                      <button key={m} onClick={() => setMotivoPerda(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          motivoPerda === m ? 'border-red-400 bg-red-50 text-red-600' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]'
                        }`}>{m}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPerder(false)} className="px-3 py-1.5 text-xs text-[#6B7280]">Cancelar</button>
                    <button onClick={handlePerder} disabled={savingPerder || !motivoPerda}
                      className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {savingPerder ? 'Salvando...' : 'Confirmar perda'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── COLUNA DIREITA (40%) ───────────────────────────────────── */}
        <div className="flex-[2] min-w-0">
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden sticky top-6">
            <Tabs value={tabDir} onValueChange={setTabDir}>
              <TabsList className="w-full bg-[#F9FAFB] rounded-none border-b border-[#E5E7EB] p-0.5">
                <TabsTrigger value="dados" className="text-xs flex-1">Dados</TabsTrigger>
                <TabsTrigger value="historico" className="text-xs flex-1">Histórico</TabsTrigger>
                <TabsTrigger value="tarefas" className="text-xs flex-1">Tarefas</TabsTrigger>
              </TabsList>

              <div className="p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                <TabsContent value="dados" className="mt-0 space-y-4">
                  <Field label="Nome" value={cliente.name} />
                  <Field label="CNPJ" value={fmtCnpj(cliente.cnpj)} />
                  <Field label="Telefone" value={cliente.phone} />
                  <Field label="Email" value={cliente.email} />
                  <Field label="Vendedor" value={cliente.sellers?.name ?? null} />
                  <Field label="Origem" value={cliente.origem ? (ORIGEM[cliente.origem] ?? cliente.origem) : null} />
                  <Field label="Cadastro" value={fmtDate(cliente.created_at)} />
                  <Field label="Último pedido" value={fmtDate(cliente.last_order_at)} />
                  <Field label="Total pedidos" value={String(cliente.total_orders ?? 0)} />
                  <Field label="Receita total" value={money(cliente.total_revenue ?? 0)} />
                  <Field label="Score" value={String(Math.round(cliente.reativacao_score ?? 0))} />
                  {addr && <Field label="Endereço" value={addr} />}
                  {cliente.notes && <Field label="Observações" value={cliente.notes} />}
                </TabsContent>

                <TabsContent value="historico" className="mt-0">
                  {pedidos === null ? <Loader /> : pedidos.length === 0 ? <Empty text="Sem pedidos" /> : (
                    <div className="space-y-1">
                      {pedidos.map(o => (
                        <div key={o.id} className="flex items-center justify-between py-2 border-b border-[#F9FAFB] last:border-0">
                          <div className="text-xs">
                            <span className="text-[#9CA3AF] tabular-nums">{fmtDate(o.created_at)}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              o.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              o.status === 'invoiced' ? 'bg-[#EEF2FF] text-[#3B5BDB]' :
                              'bg-[#F3F4F6] text-[#6B7280]'
                            }`}>{o.status}</span>
                          </div>
                          <span className="text-sm font-semibold text-[#111827] tabular-nums">{money(o.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tarefas" className="mt-0">
                  {/* Botão criar tarefa */}
                  <div className="mb-3">
                    {!showNewTask ? (
                      <button onClick={() => { setShowNewTask(true); setNewTaskTitle(`Acompanhamento: ${cliente.name}`) }}
                        className="flex items-center gap-1 text-xs font-medium text-[#3B5BDB] hover:text-[#3451C7] transition-colors">
                        <Plus size={12} /> Criar tarefa
                      </button>
                    ) : (
                      <div className="border border-[#E5E7EB] rounded-lg p-3 space-y-2.5">
                        <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Título da tarefa"
                          className="w-full text-sm border border-[#E5E7EB] rounded-md px-2.5 py-1.5 text-[#111827] placeholder-[#D1D5DB] outline-none focus:border-[#3B5BDB] transition" />
                        <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                          className="w-full text-xs border border-[#E5E7EB] rounded-md px-2.5 py-1.5 text-[#6B7280] outline-none focus:border-[#3B5BDB] transition" />
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setShowNewTask(false)} className="text-xs text-[#6B7280]">Cancelar</button>
                          <button onClick={handleCreateTask} disabled={savingNewTask || !newTaskTitle.trim()}
                            className="px-3 py-1 text-xs font-medium bg-[#3B5BDB] text-white rounded-md hover:bg-[#3451C7] disabled:opacity-50 transition-colors">
                            {savingNewTask ? '...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista tarefas */}
                  {tarefas === null ? <Loader /> : tarefas.length === 0 ? <Empty text="Sem tarefas" /> : (
                    <div className="space-y-1.5">
                      {tarefas.map(t => (
                        <div key={t.id} className="py-2 border-b border-[#F9FAFB] last:border-0">
                          <p className="text-sm text-[#111827]">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#9CA3AF]">
                            <span className={t.status === 'open' ? 'text-amber-600' : 'text-[#D1D5DB]'}>
                              {t.status === 'open' ? 'Aberta' : t.status === 'done' ? 'Concluída' : t.status}
                            </span>
                            {t.due_date && <span className="tabular-nums">{fmtDate(t.due_date)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
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
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Step({ active, done, label, error }: { active: boolean; done: boolean; label: string; error?: boolean }) {
  const bg = done ? (error ? 'bg-red-500' : 'bg-emerald-500') : active ? 'bg-[#3B5BDB]' : 'bg-[#E5E7EB]'
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center`}>
        {done ? <Check size={12} className="text-white" /> :
         active ? <Clock size={12} className="text-white" /> :
         <div className="w-2 h-2 rounded-full bg-white/50" />}
      </div>
      <span className={`text-sm font-medium ${active || done ? 'text-[#111827]' : 'text-[#D1D5DB]'}`}>{label}</span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">{label}</p>
      <p className="text-sm text-[#111827]">{value || '—'}</p>
    </div>
  )
}

function Loader() { return <div className="py-12 flex justify-center"><div className="w-4 h-4 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ text }: { text: string }) { return <p className="py-12 text-center text-xs text-[#D1D5DB]">{text}</p> }
