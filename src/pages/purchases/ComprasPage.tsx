import { useState, useMemo } from 'react'
import {
  ShoppingCart, Plus, X, Check, AlertTriangle, Clock, Truck,
  ChevronRight, Building2, Phone, MapPin, Tag, BarChart2,
  Package, Users, FileText, Search, ArrowRight, Star,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type PRStatus =
  | 'NOVA_SOLICITACAO' | 'AGUARDANDO_COMPRADOR' | 'EM_COTACAO'
  | 'AGUARDANDO_APROVACAO_SOLICITANTE' | 'APROVADA_PARA_COMPRAR'
  | 'EM_COMPRA_FORNECEDOR' | 'AGUARDANDO_ENTREGA_FORNECEDOR'
  | 'ENTREGUE' | 'CANCELADO'

type Priority = 'NORMAL' | 'URGENTE' | 'CRITICO'

interface PRItem { id: string; name: string; qty: number; unit: string | null }
interface PurchaseRequest {
  id: string; title: string; status: PRStatus; priority: Priority
  client_id: string | null; requester_id: string; buyer_id: string | null; company_id: string
  deadline: string | null; created_at: string
  clients: { name: string } | null
  requester_name: string | null
  buyer_name: string | null
  purchase_request_items: PRItem[]
}

type QSStatus = 'aberta' | 'em_comparacao' | 'fechada'
interface QuoteLine { id: string; item_name: string; unit_price: number | null; quantity: number | null; winner: boolean }
interface SupplierQuote { id: string; session_id: string; supplier_name: string; lines: QuoteLine[] }
interface QuoteSession {
  id: string; title: string; status: QSStatus; origin: string | null
  company_id: string; created_at: string
  supplier_quotes: SupplierQuote[]
}

interface Supplier {
  id: string; name: string; cnpj: string | null; whatsapp: string | null
  city: string | null; status: 'active' | 'inactive'; company_id: string
}

interface PageData {
  requests: PurchaseRequest[]
  sessions: QuoteSession[]
  suppliers: Supplier[]
  clients: { id: string; name: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<Priority, { label: string; text: string; bg: string }> = {
  NORMAL:  { label: 'Normal',  text: 'text-slate-600',  bg: 'bg-slate-100'  },
  URGENTE: { label: 'Urgente', text: 'text-amber-700',  bg: 'bg-amber-50'   },
  CRITICO: { label: 'Crítico', text: 'text-red-700',    bg: 'bg-red-50'     },
}

const STATUS_NEXT: Partial<Record<PRStatus, { label: string; next: PRStatus }>> = {
  NOVA_SOLICITACAO:                { label: 'Assumir',        next: 'AGUARDANDO_COMPRADOR'             },
  AGUARDANDO_COMPRADOR:            { label: 'Cotar',          next: 'EM_COTACAO'                       },
  EM_COTACAO:                      { label: 'Enviar p/ aprox',next: 'AGUARDANDO_APROVACAO_SOLICITANTE' },
  AGUARDANDO_APROVACAO_SOLICITANTE:{ label: 'Aprovar',        next: 'APROVADA_PARA_COMPRAR'            },
  APROVADA_PARA_COMPRAR:           { label: 'Comprar',        next: 'EM_COMPRA_FORNECEDOR'             },
  EM_COMPRA_FORNECEDOR:            { label: 'Ag. Entrega',    next: 'AGUARDANDO_ENTREGA_FORNECEDOR'    },
  AGUARDANDO_ENTREGA_FORNECEDOR:   { label: 'Entregue',       next: 'ENTREGUE'                         },
}

const KANBAN_COLS: { id: string; label: string; statuses: PRStatus[] }[] = [
  { id: 'aguardando',   label: 'Aguardando',         statuses: ['NOVA_SOLICITACAO','AGUARDANDO_COMPRADOR'] },
  { id: 'cotacao',      label: 'Em Cotação',          statuses: ['EM_COTACAO'] },
  { id: 'aprovacao',    label: 'Aguard. Aprovação',   statuses: ['AGUARDANDO_APROVACAO_SOLICITANTE'] },
  { id: 'aprovados',    label: 'Aprovados',            statuses: ['APROVADA_PARA_COMPRAR'] },
  { id: 'entrega',      label: 'Aguardando Entrega',  statuses: ['EM_COMPRA_FORNECEDOR','AGUARDANDO_ENTREGA_FORNECEDOR'] },
  { id: 'finalizados',  label: 'Finalizados',          statuses: ['ENTREGUE','CANCELADO'] },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtPrice(v: number | null) {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      {children}
    </div>
  )
}

function PriorityBadge({ p }: { p: Priority }) {
  const c = PRIORITY_CFG[p]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>{c.label}</span>
}

function ModalShell({ title, icon: Icon, onClose, children, footer }: {
  title: string; icon: React.ElementType; onClose: () => void
  children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <Icon size={15} className="text-[#3B5BDB]" />
            </div>
            <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"><X size={15} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9] shrink-0">{footer}</div>
      </div>
    </div>
  )
}

// ─── Nova Solicitação Modal ───────────────────────────────────────────────────

interface NovaSolModalProps {
  companyId: string; sellerId: string
  clients: { id: string; name: string }[]
  onClose: () => void; onSaved: () => void
}

function NovaSolicitacaoModal({ companyId, sellerId, clients, onClose, onSaved }: NovaSolModalProps) {
  const [title,      setTitle]    = useState('')
  const [priority,   setPriority] = useState<Priority>('NORMAL')
  const [clientId,   setClientId] = useState('')
  const [deadline,   setDeadline] = useState('')
  const [items,      setItems]    = useState([{ name: '', quantity: '1', unit: '' }])
  const [saving,     setSaving]   = useState(false)
  const [err,        setErr]      = useState<string | null>(null)
  const [clientQ,    setClientQ]  = useState('')

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientQ.toLowerCase()))

  function addItem() { setItems(prev => [...prev, { name: '', quantity: '1', unit: '' }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function setItem(i: number, k: 'name' | 'quantity' | 'unit', v: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  }

  async function handleSave() {
    if (!title.trim()) { setErr('Título é obrigatório.'); return }
    const validItems = items.filter(it => it.name.trim())
    if (validItems.length === 0) { setErr('Adicione ao menos 1 item.'); return }
    setSaving(true); setErr(null)
    try {
      const { data: req, error: reqErr } = await supabase.from('purchase_requests').insert({
        company_id: companyId, requester_id: sellerId, title: title.trim(),
        priority, client_id: clientId || null, deadline: deadline || null,
        status: 'NOVA_SOLICITACAO',
      }).select('id').single()
      if (reqErr || !req) { setErr(reqErr?.message ?? 'Erro'); return }
      await supabase.from('purchase_request_items').insert(
        validItems.map(it => ({
          request_id: req.id, name: it.name.trim(),
          qty: parseFloat(it.quantity) || 1, unit: it.unit.trim() || null,
        }))
      )
      onSaved(); onClose()
    } catch (err: any) {
      setErr(err?.message ?? 'Erro ao salvar solicitação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Nova Solicitação" icon={ShoppingCart} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
          <Check size={14} />{saving ? 'Salvando…' : 'Salvar'}
        </button>
      </>
    }>
      <Field label="Título *">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Compra de embalagens" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prioridade">
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={inputCls}>
            <option value="NORMAL">Normal</option>
            <option value="URGENTE">Urgente</option>
            <option value="CRITICO">Crítico</option>
          </select>
        </Field>
        <Field label="Prazo">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Cliente (opcional)">
        <div className="space-y-1">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={clientQ} onChange={e => setClientQ(e.target.value)} placeholder="Buscar cliente…"
              className={`${inputCls} pl-8`} />
          </div>
          {clientQ && (
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden max-h-36 overflow-y-auto">
              {filteredClients.slice(0, 6).map(c => (
                <button key={c.id} onClick={() => { setClientId(c.id); setClientQ(c.name) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F3F4F6] transition-colors ${clientId === c.id ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'text-[#111827]'}`}>
                  {c.name}
                </button>
              ))}
              {filteredClients.length === 0 && <p className="px-3 py-2 text-xs text-[#9CA3AF]">Nenhum resultado.</p>}
            </div>
          )}
        </div>
      </Field>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[#6B7280]">Itens *</label>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:underline">
            <Plus size={12} />Adicionar item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="Nome do item"
                className={`${inputCls} flex-1`} />
              <input value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qtd"
                className={`${inputCls} w-16`} />
              <input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} placeholder="UN"
                className={`${inputCls} w-16`} />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="p-1.5 text-[#9CA3AF] hover:text-red-500 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}
    </ModalShell>
  )
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ req, onAdvance }: { req: PurchaseRequest; onAdvance: () => void }) {
  const advance = STATUS_NEXT[req.status]
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:border-[#C7D2FE] transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-[#111827] leading-snug flex-1">{req.title}</p>
        <PriorityBadge p={req.priority} />
      </div>
      <div className="space-y-0.5 mb-3">
        {req.clients && (
          <p className="text-[11px] text-[#6B7280] flex items-center gap-1">
            <Building2 size={10} className="shrink-0" />{req.clients.name}
          </p>
        )}
        <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
          <Users size={10} className="shrink-0" />{req.requester_name ?? '—'}
        </p>
        <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
          <Clock size={10} className="shrink-0" />{fmtDate(req.created_at)}
          {req.deadline && <span className="ml-1 text-amber-600">· {fmtDate(req.deadline)}</span>}
        </p>
      </div>
      {advance && (
        <button onClick={onAdvance}
          className="w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium bg-[#EEF2FF] text-[#3B5BDB] hover:bg-[#3B5BDB] hover:text-white transition-colors">
          {advance.label}<ArrowRight size={10} />
        </button>
      )}
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ requests, onAdvance }: {
  requests: PurchaseRequest[]
  onAdvance: (id: string, next: PRStatus) => Promise<void>
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
      {KANBAN_COLS.map(col => {
        const cards = requests.filter(r => col.statuses.includes(r.status))
        return (
          <div key={col.id} className="shrink-0 w-56">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#374151]">{col.label}</p>
              <span className="text-[10px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl h-20 flex items-center justify-center">
                  <p className="text-[11px] text-[#D1D5DB]">Vazio</p>
                </div>
              ) : (
                cards.map(r => (
                  <KanbanCard key={r.id} req={r} onAdvance={() => {
                    const adv = STATUS_NEXT[r.status]
                    if (adv) onAdvance(r.id, adv.next)
                  }} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Solicitante List ─────────────────────────────────────────────────────────

const SOL_FILTERS = [
  { key: 'all',      label: 'Todas' },
  { key: 'aprovar',  label: 'Para Aprovar', statuses: ['AGUARDANDO_APROVACAO_SOLICITANTE'] },
  { key: 'cotacao',  label: 'Em Cotação',   statuses: ['EM_COTACAO'] },
  { key: 'entregue', label: 'Entregues',    statuses: ['ENTREGUE'] },
] as const

const STATUS_LABEL: Partial<Record<PRStatus, string>> = {
  NOVA_SOLICITACAO: 'Nova', AGUARDANDO_COMPRADOR: 'Ag. Comprador',
  EM_COTACAO: 'Em Cotação', AGUARDANDO_APROVACAO_SOLICITANTE: 'Para Aprovar',
  APROVADA_PARA_COMPRAR: 'Aprovada', EM_COMPRA_FORNECEDOR: 'Em Compra',
  AGUARDANDO_ENTREGA_FORNECEDOR: 'Ag. Entrega', ENTREGUE: 'Entregue', CANCELADO: 'Cancelado',
}
const STATUS_BADGE: Partial<Record<PRStatus, string>> = {
  NOVA_SOLICITACAO: 'bg-slate-100 text-slate-600',
  AGUARDANDO_COMPRADOR: 'bg-slate-100 text-slate-600',
  EM_COTACAO: 'bg-blue-50 text-blue-700',
  AGUARDANDO_APROVACAO_SOLICITANTE: 'bg-amber-50 text-amber-700',
  APROVADA_PARA_COMPRAR: 'bg-emerald-50 text-emerald-700',
  EM_COMPRA_FORNECEDOR: 'bg-violet-50 text-violet-700',
  AGUARDANDO_ENTREGA_FORNECEDOR: 'bg-violet-50 text-violet-700',
  ENTREGUE: 'bg-emerald-50 text-emerald-700',
  CANCELADO: 'bg-red-50 text-red-700',
}

function SolicitanteList({ requests }: { requests: PurchaseRequest[] }) {
  const [filter, setFilter] = useState<'all' | 'aprovar' | 'cotacao' | 'entregue'>('all')
  const visible = useMemo(() => {
    if (filter === 'all') return requests
    const f = SOL_FILTERS.find(f => f.key === filter)
    if (!f || !('statuses' in f)) return requests
    return requests.filter(r => (f.statuses as readonly string[]).includes(r.status))
  }, [requests, filter])

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {SOL_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key
                ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#3B5BDB] hover:text-[#3B5BDB]'
            }`}>{f.label}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-12">
          <p className="text-sm text-[#9CA3AF]">Nenhuma solicitação.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {visible.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111827] truncate">{r.title}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  {r.clients?.name ?? '—'} · {fmtDate(r.created_at)}
                  {r.deadline && <span className="text-amber-600"> · prazo {fmtDate(r.deadline)}</span>}
                </p>
              </div>
              <PriorityBadge p={r.priority} />
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Aba 1: Painel do Comprador ───────────────────────────────────────────────

function PainelComprador({
  requests, clients, companyId, sellerId, role, onRefetch,
}: {
  requests: PurchaseRequest[]; clients: { id: string; name: string }[]
  companyId: string; sellerId: string; role: string | null; onRefetch: () => void
}) {
  type View = 'comprador' | 'solicitante'
  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager'
  const [view, setView] = useState<View>(isAdmin ? 'comprador' : 'solicitante')
  const [showModal, setShowModal] = useState(false)

  const myRequests = view === 'solicitante'
    ? requests.filter(r => r.requester_id === sellerId)
    : requests

  async function advanceStatus(id: string, next: PRStatus) {
    await supabase.from('purchase_requests').update({ status: next }).eq('id', id)
    onRefetch()
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        {isAdmin ? (
          <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 gap-0.5">
            {(['comprador', 'solicitante'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === v ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                }`}>
                {v === 'comprador' ? 'Comprador' : 'Solicitante'}
              </button>
            ))}
          </div>
        ) : <div />}
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors">
          <Plus size={14} />Nova Solicitação
        </button>
      </div>

      {view === 'comprador' ? (
        <KanbanBoard requests={myRequests} onAdvance={advanceStatus} />
      ) : (
        <SolicitanteList requests={myRequests} />
      )}

      {showModal && (
        <NovaSolicitacaoModal
          companyId={companyId} sellerId={sellerId} clients={clients}
          onClose={() => setShowModal(false)} onSaved={onRefetch}
        />
      )}
    </div>
  )
}

// ─── Quote Session Detail ─────────────────────────────────────────────────────

function QuoteSessionDetail({ session, onClose, onRefetch }: {
  session: QuoteSession; onClose: () => void; onRefetch: () => void
}) {
  const [supplierName, setSupplierName] = useState('')
  const [lines,        setLines]        = useState([{ item_name: '', unit_price: '', quantity: '' }])
  const [adding,       setAdding]       = useState(false)
  const [saving,       setSaving]       = useState(false)

  function addLine() { setLines(prev => [...prev, { item_name: '', unit_price: '', quantity: '' }]) }
  function setLine(i: number, k: 'item_name' | 'unit_price' | 'quantity', v: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }

  async function handleAddSupplier() {
    if (!supplierName.trim()) return
    setSaving(true)
    const { data: sq } = await supabase.from('supplier_quotes').insert({
      session_id: session.id, supplier_name: supplierName.trim(),
    }).select('id').single()
    if (sq) {
      const validLines = lines.filter(l => l.item_name.trim())
      await supabase.from('supplier_quote_lines').insert(
        validLines.map(l => ({
          quote_id: sq.id, item_name: l.item_name.trim(),
          unit_price: l.unit_price ? parseFloat(l.unit_price.replace(',', '.')) : null,
          quantity: l.quantity ? parseFloat(l.quantity) : null, winner: false,
        }))
      )
    }
    setSaving(false); setAdding(false); setSupplierName(''); setLines([{ item_name: '', unit_price: '', quantity: '' }])
    onRefetch()
  }

  async function markWinner(lineId: string, quoteId: string) {
    const siblingIds = session.supplier_quotes.flatMap(q => q.lines).map(l => l.id)
    await supabase.from('supplier_quote_lines').update({ winner: false }).in('id', siblingIds)
    await supabase.from('supplier_quote_lines').update({ winner: true }).eq('id', lineId).eq('quote_id', quoteId)
    onRefetch()
  }

  async function closeSession() {
    await supabase.from('quote_sessions').update({ status: 'fechada' }).eq('id', session.id)
    onRefetch(); onClose()
  }

  const quotes = session.supplier_quotes ?? []
  const hasComparison = quotes.length >= 2

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">{session.title}</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Cotação · {session.status}</p>
          </div>
          <div className="flex items-center gap-2">
            {session.status !== 'fechada' && (
              <button onClick={closeSession} className="px-3 py-1.5 text-xs font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">
                Fechar sessão
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"><X size={15} /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Comparativo */}
          {hasComparison && (
            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3">Comparativo</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Item</th>
                      {quotes.map(q => (
                        <th key={q.id} className="px-3 py-2 text-center font-medium text-[#6B7280]">{q.supplier_name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(quotes.flatMap(q => q.lines.map(l => l.item_name)))).map(item => (
                      <tr key={item} className="border-b border-[#F3F4F6] last:border-0">
                        <td className="px-3 py-2 text-[#374151]">{item}</td>
                        {quotes.map(q => {
                          const line = q.lines.find(l => l.item_name === item)
                          return (
                            <td key={q.id} className={`px-3 py-2 text-center ${line?.winner ? 'bg-emerald-50' : ''}`}>
                              {line ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`font-medium ${line.winner ? 'text-emerald-700' : 'text-[#111827]'}`}>
                                    {fmtPrice(line.unit_price)}
                                  </span>
                                  {session.status !== 'fechada' && !line.winner && (
                                    <button onClick={() => markWinner(line.id, q.id)}
                                      className="flex items-center gap-0.5 text-[10px] text-[#9CA3AF] hover:text-amber-500 transition-colors">
                                      <Star size={9} />Eleger
                                    </button>
                                  )}
                                  {line.winner && <Star size={11} className="text-amber-400 fill-amber-400" />}
                                </div>
                              ) : <span className="text-[#D1D5DB]">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fornecedores adicionados */}
          {quotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#374151] mb-2">Fornecedores ({quotes.length})</p>
              <div className="space-y-2">
                {quotes.map(q => (
                  <div key={q.id} className="border border-[#E5E7EB] rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-[#111827] mb-2">{q.supplier_name}</p>
                    <div className="space-y-1">
                      {q.lines.map(l => (
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <span className="text-[#374151]">{l.item_name}</span>
                          <span className={`font-medium tabular-nums ${l.winner ? 'text-emerald-600' : 'text-[#6B7280]'}`}>
                            {fmtPrice(l.unit_price)} {l.winner && '★'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adicionar fornecedor */}
          {session.status !== 'fechada' && (
            <div className="border border-[#E5E7EB] rounded-xl p-4">
              {!adding ? (
                <button onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 text-sm text-[#3B5BDB] hover:underline">
                  <Plus size={14} />Adicionar fornecedor
                </button>
              ) : (
                <div className="space-y-3">
                  <Field label="Nome do Fornecedor">
                    <input value={supplierName} onChange={e => setSupplierName(e.target.value)} className={inputCls} placeholder="Ex: Embalagens ABC" />
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#6B7280]">Itens</label>
                      <button onClick={addLine} className="text-xs text-[#3B5BDB] hover:underline flex items-center gap-0.5"><Plus size={11} />Linha</button>
                    </div>
                    <div className="space-y-1.5">
                      {lines.map((l, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={l.item_name} onChange={e => setLine(i, 'item_name', e.target.value)} placeholder="Item" className={`${inputCls} flex-1`} />
                          <input value={l.unit_price} onChange={e => setLine(i, 'unit_price', e.target.value)} placeholder="R$ unit." className={`${inputCls} w-24`} />
                          <input value={l.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} placeholder="Qtd" className={`${inputCls} w-16`} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">Cancelar</button>
                    <button onClick={handleAddSupplier} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
                      <Check size={12} />{saving ? 'Salvando…' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Aba 2: Central de Cotação ────────────────────────────────────────────────

function CentralCotacao({ sessions, companyId, onRefetch }: {
  sessions: QuoteSession[]; companyId: string; onRefetch: () => void
}) {
  const [showNew,  setShowNew]  = useState(false)
  const [detail,   setDetail]   = useState<QuoteSession | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving,   setSaving]   = useState(false)

  const QS_STATUS_CFG = {
    aberta:         { label: 'Aberta',        cls: 'bg-emerald-50 text-emerald-700' },
    em_comparacao:  { label: 'Em Comparação', cls: 'bg-blue-50 text-blue-700'       },
    fechada:        { label: 'Fechada',       cls: 'bg-gray-100 text-gray-500'      },
  }

  async function createSession() {
    if (!newTitle.trim()) return
    setSaving(true)
    await supabase.from('quote_sessions').insert({
      company_id: companyId, title: newTitle.trim(), status: 'aberta', origin: 'avulsa',
    })
    setSaving(false); setNewTitle(''); setShowNew(false); onRefetch()
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-[#374151]">Sessões de Cotação</p>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors">
          <Plus size={14} />Nova Cotação Avulsa
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-4 flex gap-3 items-end">
          <Field label="Título da sessão">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSession()}
              placeholder="Ex: Cotação de embalagens Abril/25" className={`${inputCls} w-72`} />
          </Field>
          <button onClick={createSession} disabled={saving || !newTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
            <Check size={13} />{saving ? 'Salvando…' : 'Criar'}
          </button>
          <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">Cancelar</button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
          <div className="text-center">
            <Tag size={26} className="text-[#D1D5DB] mx-auto mb-2" />
            <p className="text-sm text-[#9CA3AF]">Nenhuma sessão de cotação.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {sessions.map((s, i) => {
            const cfg = QS_STATUS_CFG[s.status] ?? QS_STATUS_CFG.aberta
            return (
              <div key={s.id}
                className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[#FAFAF9] transition-colors ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}
                onClick={() => setDetail(s)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111827] truncate">{s.title}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {s.origin ?? 'avulsa'} · {fmtDate(s.created_at)} · {s.supplier_quotes?.length ?? 0} fornecedores
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                <ChevronRight size={14} className="text-[#9CA3AF]" />
              </div>
            )
          })}
        </div>
      )}

      {detail && (
        <QuoteSessionDetail session={detail} onClose={() => setDetail(null)} onRefetch={onRefetch} />
      )}
    </div>
  )
}

// ─── Aba 3: Fornecedores ──────────────────────────────────────────────────────

interface SupplierModalProps {
  companyId: string; onClose: () => void; onSaved: () => void
}
function SupplierModal({ companyId, onClose, onSaved }: SupplierModalProps) {
  const [form, setForm] = useState({ name: '', cnpj: '', whatsapp: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  function set(k: keyof typeof form) { return (v: string) => setForm(p => ({ ...p, [k]: v })) }
  async function handleSave() {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase.from('suppliers').insert({
      company_id: companyId, name: form.name.trim(), cnpj: form.cnpj.trim() || null,
      whatsapp: form.whatsapp.trim() || null, city: form.city.trim() || null, status: 'active',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(); onClose()
  }
  return (
    <ModalShell title="Novo Fornecedor" icon={Building2} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
          <Check size={14} />{saving ? 'Salvando…' : 'Salvar'}
        </button>
      </>
    }>
      <Field label="Nome *"><input value={form.name} onChange={e => set('name')(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="CNPJ"><input value={form.cnpj} onChange={e => set('cnpj')(e.target.value)} placeholder="00.000.000/0001-00" className={inputCls} /></Field>
        <Field label="WhatsApp"><input value={form.whatsapp} onChange={e => set('whatsapp')(e.target.value)} placeholder="(11) 99999-9999" className={inputCls} /></Field>
      </div>
      <Field label="Cidade"><input value={form.city} onChange={e => set('city')(e.target.value)} className={inputCls} /></Field>
      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}
    </ModalShell>
  )
}

function FornecedoresTab({ suppliers, companyId, onRefetch }: {
  suppliers: Supplier[]; companyId: string; onRefetch: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [search,    setSearch]    = useState('')
  const visible = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor…"
            className="pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg w-56 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white text-[#111827] placeholder-[#9CA3AF] transition" />
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors">
          <Plus size={14} />Novo Fornecedor
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
          <div className="text-center">
            <Building2 size={26} className="text-[#D1D5DB] mx-auto mb-2" />
            <p className="text-sm text-[#9CA3AF]">{search ? 'Nenhum resultado.' : 'Nenhum fornecedor cadastrado.'}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-40">CNPJ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">WhatsApp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Cidade</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s, i) => (
                <tr key={s.id} className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF9] transition-colors ${i > 0 ? '' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#111827]">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">{s.cnpj ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.whatsapp ? (
                      <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                        <Phone size={11} />{s.whatsapp}
                      </span>
                    ) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.city ? (
                      <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                        <MapPin size={11} />{s.city}
                      </span>
                    ) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.status === 'active'
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Ativo</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <SupplierModal companyId={companyId} onClose={() => setShowModal(false)} onSaved={onRefetch} />}
    </div>
  )
}

// ─── Aba 4: Relatórios ────────────────────────────────────────────────────────

function RelatoriosTab({ requests }: { requests: PurchaseRequest[] }) {
  const total      = requests.length
  const pendentes  = requests.filter(r => !['ENTREGUE','CANCELADO'].includes(r.status)).length
  const finalizados= requests.filter(r => r.status === 'ENTREGUE').length

  const avgDays = useMemo(() => {
    const delivered = requests.filter(r => r.status === 'ENTREGUE')
    if (delivered.length === 0) return null
    const sum = delivered.reduce((acc, r) => {
      const diff = (Date.now() - new Date(r.created_at).getTime()) / 86_400_000
      return acc + diff
    }, 0)
    return Math.round(sum / delivered.length)
  }, [requests])

  const lastDelivered = requests.filter(r => r.status === 'ENTREGUE').slice(0, 8)

  const kpis = [
    { label: 'Total Solicitações', value: String(total),         icon: FileText,  iconBg: 'bg-slate-50',   iconCls: 'text-slate-500'   },
    { label: 'Pendentes',          value: String(pendentes),     icon: Clock,     iconBg: 'bg-amber-50',   iconCls: 'text-amber-500'   },
    { label: 'Finalizados',        value: String(finalizados),   icon: Package,   iconBg: 'bg-emerald-50', iconCls: 'text-emerald-500' },
    { label: 'Tempo Médio',        value: avgDays ? `${avgDays}d` : '—', icon: BarChart2, iconBg: 'bg-[#EEF2FF]', iconCls: 'text-[#3B5BDB]' },
  ]

  return (
    <div className="px-6 py-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">{k.label}</p>
                <p className="text-2xl font-semibold text-[#111827] tabular-nums leading-tight">{k.value}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                <k.icon size={15} className={k.iconCls} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <p className="text-sm font-semibold text-[#374151]">Últimas Entregas</p>
        </div>
        {lastDelivered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-[#9CA3AF]">Nenhuma entrega registrada.</p>
          </div>
        ) : (
          lastDelivered.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Truck size={13} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111827] truncate">{r.title}</p>
                <p className="text-xs text-[#9CA3AF]">{r.clients?.name ?? '—'} · {fmtDate(r.created_at)}</p>
              </div>
              <PriorityBadge p={r.priority} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabKey = 'painel' | 'cotacao' | 'fornecedores' | 'relatorios'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'painel',       label: 'Painel do Comprador', icon: ShoppingCart },
  { key: 'cotacao',      label: 'Central de Cotação',  icon: Tag          },
  { key: 'fornecedores', label: 'Fornecedores',         icon: Building2    },
  { key: 'relatorios',   label: 'Relatórios',           icon: BarChart2    },
]

export default function ComprasPage() {
  const { role, seller } = useAuth()
  const [tab,       setTab]       = useState<TabKey>('painel')
  const [companyId, setCompanyId] = useState('')
  const [sellerId,  setSellerId]  = useState('')

  const { data, loading, error, refetch } = useSupabaseQuery<PageData>(
    async ({ company_id, seller: s }) => {
      setCompanyId(company_id)
      setSellerId(s.id)
      const [reqRes, sesRes, supRes, cliRes, sellersRes] = await Promise.all([
        supabase.from('purchase_requests')
          .select('*, clients(name), purchase_request_items(id, name, qty, unit)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }),
        supabase.from('quote_sessions')
          .select('*, supplier_quotes(id, supplier_name, supplier_quote_lines(id, item_name, unit_price, quantity, winner))')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers')
          .select('id, name, cnpj, whatsapp, city, status, company_id')
          .eq('company_id', company_id)
          .order('name'),
        supabase.from('clients')
          .select('id, name')
          .eq('company_id', company_id)
          .order('name'),
        supabase.from('sellers')
          .select('id, name')
          .eq('company_id', company_id),
      ])
      if (reqRes.error) return { data: null, error: reqRes.error }

      // Merge seller names into requests on the frontend
      const sellerMap = new Map<string, string>(
        (sellersRes.data ?? []).map(s => [s.id, s.name])
      )
      const rawReqs = (reqRes.data ?? []) as unknown as Omit<PurchaseRequest, 'requester_name' | 'buyer_name'>[]
      const requests: PurchaseRequest[] = rawReqs.map(r => ({
        ...r,
        requester_name: sellerMap.get(r.requester_id) ?? null,
        buyer_name:     r.buyer_id ? (sellerMap.get(r.buyer_id) ?? null) : null,
      }))

      return {
        data: {
          requests,
          sessions:  (sesRes.data  ?? []) as unknown as QuoteSession[],
          suppliers: (supRes.data  ?? []) as Supplier[],
          clients:   (cliRes.data  ?? []) as { id: string; name: string }[],
        },
        error: null,
      }
    },
    [],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B7280]">Carregando módulo de compras…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#111827] mb-1">Erro ao carregar compras</p>
          <p className="text-xs text-[#6B7280]">{error}</p>
        </div>
      </div>
    )
  }

  const requests  = data?.requests  ?? []
  const sessions  = data?.sessions  ?? []
  const suppliers = data?.suppliers ?? []
  const clients   = data?.clients   ?? []

  const pendingBadge = requests.filter(r => !['ENTREGUE','CANCELADO'].includes(r.status)).length

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <h1 className="text-lg font-semibold text-[#111827]">Compras</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Solicitações · Cotações · Fornecedores</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E5E7EB] px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#3B5BDB] text-[#3B5BDB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}>
              <t.icon size={14} />
              {t.label}
              {t.key === 'painel' && pendingBadge > 0 && (
                <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold ${
                  tab === 'painel' ? 'bg-[#3B5BDB] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
                }`}>{pendingBadge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'painel' && (
        <PainelComprador
          requests={requests} clients={clients}
          companyId={companyId} sellerId={sellerId || (seller?.id ?? '')}
          role={role} onRefetch={refetch}
        />
      )}
      {tab === 'cotacao' && (
        <CentralCotacao sessions={sessions} companyId={companyId} onRefetch={refetch} />
      )}
      {tab === 'fornecedores' && (
        <FornecedoresTab suppliers={suppliers} companyId={companyId} onRefetch={refetch} />
      )}
      {tab === 'relatorios' && (
        <RelatoriosTab requests={requests} />
      )}
    </div>
  )
}
