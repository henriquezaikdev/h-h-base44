import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft, Printer, Edit2, Save, X,
  Calendar, CreditCard, Clock,
  Package, User, Phone,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { EmitirNFeButton } from '../../components/EmitirNFeButton'
import { PaymentSection, InstallmentsDisplay } from './PaymentSection'
import { isPresetTerm, type Installment } from './paymentUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderDetail {
  id: string
  order_number: string | null
  order_date: string | null
  status: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  payment_method: string | null
  payment_term: string | null
  due_dates: Installment[] | null
  seller_id: string | null
  seller_name: string | null
  company_id: string
  client_id: string | null
  nfe_status: string | null
  nfe_ref: string | null
  nfe_key: string | null
  nfe_url: string | null
  nfe_issued_at: string | null
  approved_at: string | null
  created_at: string
  clients: { id: string; name: string; cnpj: string | null; phone: string | null } | null
}

interface OrderItemDetail {
  id: string
  product_id: string | null
  qty: number
  unit_price: number
  discount: number
  total: number
  cost_at_sale: number | null
  products: { name: string; sku: string | null } | null
}

interface EditableItem {
  id: string
  qty: number
  unit_price: number
  discount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIGRATION_JUNK = ['Sem vendedor na API']

function cleanNotes(notes: string | null): string {
  if (!notes) return ''
  return MIGRATION_JUNK.includes(notes.trim()) ? '' : notes
}


function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtCNPJ(v: string | null) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendente',  cls: 'bg-amber-50 text-amber-700' },
    approved:  { label: 'Aprovado',  cls: 'bg-emerald-50 text-emerald-700' },
    rejected:  { label: 'Recusado',  cls: 'bg-red-50 text-red-600' },
    invoiced:  { label: 'Faturado',  cls: 'bg-blue-50 text-blue-700' },
    delivered: { label: 'Entregue',  cls: 'bg-emerald-100 text-emerald-800' },
    cancelled: { label: 'Cancelado', cls: 'bg-neutral-100 text-neutral-500' },
    picked:    { label: 'Separado',  cls: 'bg-indigo-50 text-indigo-700' },
  }
  const c = cfg[status] ?? { label: status, cls: 'bg-neutral-100 text-neutral-500' }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>{c.label}</span>
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-[#E5E7EB] rounded-xl p-5 ${className}`}>{children}</div>
}

function CardTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F3F4F6]">
      <Icon size={14} className="text-[#9CA3AF]" />
      <h3 className="text-sm font-semibold text-[#111827]">{children}</h3>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-[#6B7280]">{label}</span>
      <span className="text-sm text-[#111827] font-medium">{value || '—'}</span>
    </div>
  )
}

const SELECT_CLS = "w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white transition"
const INPUT_CLS = "w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"

// ─── Print styles ─────────────────────────────────────────────────────────────

const printStyles = `
@media print {
  nav, aside, header, [data-sidebar], [data-no-print] { display: none !important; }
  body { background: white !important; }
  .print-container { padding: 0 !important; margin: 0 !important; }
  .no-print { display: none !important; }
}
`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()

  const canEdit = role ? ['owner', 'admin', 'manager', 'seller'].includes(role) : false

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: order, loading, error, refetch } = useSupabaseQuery<OrderDetail>(
    ({ company_id }) =>
      supabase
        .from('orders')
        .select('*, clients(id, name, cnpj, phone)')
        .eq('company_id', company_id)
        .eq('id', id!)
        .single(),
    [id],
  )

  const { data: items, refetch: refetchItems } = useSupabaseQuery<OrderItemDetail[]>(
    () =>
      supabase
        .from('order_items')
        .select('*, products(name, sku)')
        .eq('order_id', id!),
    [id],
  )

  // Lista de sellers ativos (para dropdown de edição)
  const { data: sellersList } = useSupabaseQuery<{ id: string; name: string }[]>(
    ({ company_id }) =>
      supabase
        .from('sellers')
        .select('id, name')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .order('name'),
    [],
  )

  // Busca o nome do vendedor separadamente (orders tem múltiplas FKs para sellers)
  const { data: sellerData } = useSupabaseQuery<{ id: string; name: string }>(
    () =>
      order?.seller_id
        ? supabase
            .from('sellers')
            .select('id, name')
            .eq('id', order.seller_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    [order?.seller_id],
  )

  const sellerName = sellerData?.name ?? null

  // ── Edit state ───────────────────────────────────────────────────────────

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    status: '',
    payment_method: '',
    payment_term: '',
    notes: '',
    seller_id: '',
  })
  const [customTerm,      setCustomTerm]      = useState('')
  const [numInstallments, setNumInstallments] = useState(1)
  const [editInstallments, setEditInstallments] = useState<Installment[]>([])
  const [editItems, setEditItems] = useState<EditableItem[]>([])

  function startEditing() {
    if (!order || !items) return
    const term = order.payment_term ?? ''
    const preset = isPresetTerm(term)
    setEditForm({
      status:         order.status,
      payment_method: order.payment_method ?? '',
      payment_term:   preset ? term : (term ? 'Personalizado' : ''),
      notes:          cleanNotes(order.notes),
      seller_id:      order.seller_id ?? '',
    })
    setCustomTerm(preset ? '' : term)
    setEditInstallments(order.due_dates ?? [])
    setNumInstallments(order.due_dates?.length || 1)
    setEditItems(items.map(i => ({
      id: i.id,
      qty: i.qty,
      unit_price: i.unit_price,
      discount: i.discount,
    })))
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  async function handleSave() {
    if (!order || !id) return
    setSaving(true)

    const newSubtotal = editItems.reduce((s, ei) => s + ei.qty * ei.unit_price, 0)
    const newDiscount = editItems.reduce((s, ei) => s + ei.discount, 0)
    const newTotal = newSubtotal - newDiscount

    const { error: orderErr } = await supabase
      .from('orders')
      .update({
        status:         editForm.status,
        payment_method: editForm.payment_method || null,
        payment_term:   (editForm.payment_term === 'Personalizado' ? customTerm : editForm.payment_term) || null,
        due_dates:      editInstallments.length > 0 ? editInstallments : null,
        notes:          editForm.notes || null,
        seller_id:      editForm.seller_id || null,
        subtotal:       newSubtotal,
        discount:       newDiscount,
        total:          newTotal,
      })
      .eq('id', id)

    if (!orderErr) {
      for (const ei of editItems) {
        const itemTotal = Math.max(0, ei.qty * ei.unit_price - ei.discount)
        await supabase
          .from('order_items')
          .update({ qty: ei.qty, unit_price: ei.unit_price, discount: ei.discount, total: itemTotal })
          .eq('id', ei.id)
      }
    }

    setSaving(false)
    setEditing(false)
    refetch()
    refetchItems()
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const safeItems = items ?? []
  const safeSellers = sellersList ?? []

  const financials = useMemo(() => {
    const custo = safeItems.reduce((s, i) => s + ((i.cost_at_sale ?? 0) * i.qty), 0)
    const total = order?.total ?? 0
    const lucro = total - custo
    const margem = total > 0 && custo > 0 ? (lucro / total) * 100 : null
    return { custo, lucro, margem }
  }, [safeItems, order?.total])

  // ── Loading / error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <span className="text-sm text-[#9CA3AF]">Carregando pedido…</span>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">{error ?? 'Pedido não encontrado.'}</p>
          <button onClick={() => navigate('/pedidos')} className="text-sm text-[#3B5BDB] hover:underline">
            ← Voltar para pedidos
          </button>
        </div>
      </div>
    )
  }

  const orderLabel = order.order_number ?? order.id.substring(0, 8).toUpperCase()

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9] print-container">
      <style>{printStyles}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4 no-print" data-no-print>
        <button
          onClick={() => navigate('/pedidos')}
          className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors"
        >
          <ChevronLeft size={14} /> Pedidos
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-[#111827]">Pedido #{orderLabel}</h1>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-[#6B7280]">
              {order.clients && (
                <Link
                  to={`/clientes/${order.clients.id}`}
                  className="text-[#3B5BDB] hover:underline font-medium"
                >
                  {order.clients.name}
                </Link>
              )}
            </div>
            {sellerName && (
              <p className="text-sm text-[#6B7280] mt-0.5">
                Vendedor: <span className="font-medium text-[#374151]">{sellerName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !editing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                <Edit2 size={14} /> Editar
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#9CA3AF] hover:text-[#374151] transition-colors"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors"
                >
                  <Save size={14} /> {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            >
              <Printer size={14} /> Imprimir
            </button>
            {(order.status === 'approved' || order.status === 'invoiced') && (
              <EmitirNFeButton
                order={{
                  id: order.id,
                  total: order.total,
                  company_id: order.company_id,
                  nfe_status: order.nfe_status,
                  nfe_ref: order.nfe_ref,
                  nfe_key: order.nfe_key,
                  nfe_url: order.nfe_url,
                }}
                clientName={order.clients?.name ?? '—'}
                onSuccess={refetch}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Print header (only visible when printing) ──────────────────── */}
      <div className="hidden print:block px-6 py-4 border-b border-[#E5E7EB]">
        <h1 className="text-lg font-semibold">Pedido #{orderLabel}</h1>
        <p className="text-sm text-[#6B7280]">
          {order.clients?.name} · {fmtDate(order.order_date ?? order.created_at)}
        </p>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="px-6 py-5 flex gap-5 items-start">

        {/* ── Coluna esquerda ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Dados do Pedido */}
          <Card>
            <CardTitle icon={Calendar}>Dados do Pedido</CardTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Data do Pedido" value={fmtDate(order.order_date ?? order.created_at)} />
              <InfoRow label="Vendedor Responsável" value={sellerName ?? '—'} />
              {editing ? (
                <div className="col-span-2">
                  <PaymentSection
                    paymentMethod={editForm.payment_method}
                    onPaymentMethodChange={v => setEditForm(p => ({ ...p, payment_method: v }))}
                    paymentTerm={editForm.payment_term}
                    onPaymentTermChange={v => setEditForm(p => ({ ...p, payment_term: v }))}
                    customTerm={customTerm}
                    onCustomTermChange={setCustomTerm}
                    numInstallments={numInstallments}
                    onNumInstallmentsChange={setNumInstallments}
                    installments={editInstallments}
                    onInstallmentsChange={setEditInstallments}
                    total={order.total}
                    inputCls={SELECT_CLS}
                    labelCls="text-xs text-[#6B7280] block mb-1"
                  />
                </div>
              ) : (
                <>
                  <InfoRow label="Forma de Pagamento" value={order.payment_method ?? '—'} />
                  <InfoRow label="Condição de Pagamento" value={order.payment_term ?? '—'} />
                  {order.due_dates && order.due_dates.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-xs text-[#6B7280] block mb-1">Parcelas</span>
                      <InstallmentsDisplay installments={order.due_dates} />
                    </div>
                  )}
                </>
              )}
              {editing && (
                <div>
                  <span className="text-xs text-[#6B7280] block mb-1">Status</span>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className={SELECT_CLS}
                  >
                    <option value="pending">Pendente</option>
                    <option value="approved">Aprovado</option>
                    <option value="rejected">Recusado</option>
                    <option value="invoiced">Faturado</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              )}
              {editing && (
                <div>
                  <span className="text-xs text-[#6B7280] block mb-1">Vendedor</span>
                  <select
                    value={editForm.seller_id}
                    onChange={e => setEditForm(p => ({ ...p, seller_id: e.target.value }))}
                    className={SELECT_CLS}
                  >
                    <option value="">Selecionar…</option>
                    {safeSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-xs text-[#6B7280] block mb-1">Observações do Vendedor</span>
                {editing ? (
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    placeholder="Observações…"
                    className={`${INPUT_CLS} resize-none`}
                  />
                ) : (
                  <p className="text-sm text-[#374151] min-h-[20px]">{cleanNotes(order.notes) || '—'}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Resultado Financeiro */}
          <Card>
            <CardTitle icon={CreditCard}>Resultado Financeiro</CardTitle>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#FAFAF9] rounded-lg p-4 text-center">
                <p className="text-xs text-[#6B7280] mb-1">Custo Total</p>
                <p className="text-lg font-semibold text-[#111827] tabular-nums">{fmt(financials.custo)}</p>
              </div>
              <div className="bg-[#FAFAF9] rounded-lg p-4 text-center">
                <p className="text-xs text-[#6B7280] mb-1">Lucro</p>
                <p className={`text-lg font-semibold tabular-nums ${financials.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(financials.lucro)}
                </p>
              </div>
              <div className="bg-[#FAFAF9] rounded-lg p-4 text-center">
                <p className="text-xs text-[#6B7280] mb-1">Margem</p>
                {financials.margem !== null ? (
                  <p className={`text-lg font-semibold tabular-nums ${
                    financials.margem >= 15 ? 'text-emerald-600' : financials.margem >= 10 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {financials.margem.toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-[#9CA3AF]">—</p>
                )}
              </div>
            </div>
          </Card>

          {/* Itens do Pedido */}
          <Card>
            <CardTitle icon={Package}>Itens do Pedido</CardTitle>
            {safeItems.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-6">Nenhum item neste pedido.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F4F6]">
                      <th className="text-left pb-2.5 text-xs font-medium text-[#6B7280]">Produto</th>
                      <th className="text-left pb-2.5 text-xs font-medium text-[#6B7280]">SKU</th>
                      <th className="text-right pb-2.5 text-xs font-medium text-[#6B7280]">Qtd</th>
                      <th className="text-right pb-2.5 text-xs font-medium text-[#6B7280]">Preço Unit.</th>
                      <th className="text-right pb-2.5 text-xs font-medium text-[#6B7280]">Subtotal</th>
                      <th className="text-right pb-2.5 text-xs font-medium text-[#6B7280]">Custo Unit.</th>
                      <th className="text-right pb-2.5 text-xs font-medium text-[#6B7280]">Lucro Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9FAFB]">
                    {safeItems.map((item) => {
                      const ei = editing ? editItems.find(e => e.id === item.id) : null
                      const qty = ei?.qty ?? item.qty
                      const price = ei?.unit_price ?? item.unit_price
                      const subtotal = qty * price
                      const lucroItem = item.cost_at_sale != null
                        ? (price - item.cost_at_sale) * qty
                        : null
                      return (
                        <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-2.5 pr-3">
                            <span className="text-[#111827] font-medium">{item.products?.name ?? '—'}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-[#6B7280]">{item.products?.sku ?? '—'}</td>
                          <td className="py-2.5 text-right tabular-nums">
                            {editing && ei ? (
                              <input
                                type="number"
                                min={1}
                                value={ei.qty}
                                onChange={e => setEditItems(prev => prev.map(x => x.id === item.id ? { ...x, qty: Number(e.target.value) || 0 } : x))}
                                className="w-16 text-right text-sm border border-[#E5E7EB] rounded px-2 py-1 outline-none focus:border-[#3B5BDB]"
                              />
                            ) : (
                              <span className="text-[#374151]">{item.qty}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {editing && ei ? (
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={ei.unit_price}
                                onChange={e => setEditItems(prev => prev.map(x => x.id === item.id ? { ...x, unit_price: Number(e.target.value) || 0 } : x))}
                                className="w-24 text-right text-sm border border-[#E5E7EB] rounded px-2 py-1 outline-none focus:border-[#3B5BDB]"
                              />
                            ) : (
                              <span className="text-[#374151]">{fmt(item.unit_price)}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-[#111827] font-medium">{fmt(subtotal)}</td>
                          <td className="py-2.5 text-right tabular-nums text-[#6B7280]">
                            {item.cost_at_sale != null ? fmt(item.cost_at_sale) : '—'}
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-medium">
                            {lucroItem !== null ? (
                              <span className={lucroItem >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {fmt(lucroItem)}
                              </span>
                            ) : (
                              <span className="text-[#9CA3AF]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#E5E7EB]">
                      <td colSpan={2} className="py-3 text-xs text-[#6B7280]">{safeItems.length} ite{safeItems.length !== 1 ? 'ns' : 'm'}</td>
                      <td className="py-3 text-right tabular-nums text-xs text-[#6B7280]">
                        {safeItems.reduce((s, i) => s + i.qty, 0)}
                      </td>
                      <td className="py-3" />
                      <td className="py-3 text-right tabular-nums text-sm font-semibold text-[#111827]">
                        {fmt(order.subtotal)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-sm text-[#6B7280]">
                        {fmt(financials.custo)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-sm font-semibold">
                        <span className={financials.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {fmt(financials.lucro)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ── Coluna direita ─────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 space-y-4">

          {/* Resumo */}
          <Card>
            <div className="text-center pb-4 mb-4 border-b border-[#F3F4F6]">
              <p className="text-xs text-[#6B7280] mb-1">Total do Pedido</p>
              <p className="text-3xl font-bold text-[#3B5BDB] tabular-nums">{fmt(order.total)}</p>
            </div>
            <div className="space-y-2">
              <InfoRow label="Subtotal" value={fmt(order.subtotal)} />
              <InfoRow label="Desconto" value={order.discount > 0 ? `- ${fmt(order.discount)}` : '—'} />
              <div className="pt-2 border-t border-[#F3F4F6]">
                <InfoRow label="Total Líquido" value={fmt(order.total)} />
              </div>
            </div>
          </Card>

          {/* Cliente */}
          {order.clients && (
            <Card>
              <CardTitle icon={User}>Cliente</CardTitle>
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-[#111827]">{order.clients.name}</p>
                {order.clients.cnpj && (
                  <p className="text-xs text-[#6B7280]">{fmtCNPJ(order.clients.cnpj)}</p>
                )}
                {order.clients.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <Phone size={12} />
                    <span>{order.clients.phone}</span>
                  </div>
                )}
                <Link
                  to={`/clientes/${order.clients.id}`}
                  className="inline-flex items-center gap-1 text-xs text-[#3B5BDB] hover:underline mt-1"
                >
                  Ver ficha completa →
                </Link>
              </div>
            </Card>
          )}

          {/* Linha do Tempo */}
          <Card>
            <CardTitle icon={Clock}>Linha do Tempo</CardTitle>
            <div className="space-y-3">
              <TimelineItem
                label="Criado em"
                date={order.created_at}
                active
              />
              <TimelineItem
                label="Aprovado em"
                date={order.approved_at}
                active={!!order.approved_at}
              />
              <TimelineItem
                label="Faturado em"
                date={order.nfe_issued_at}
                active={!!order.nfe_issued_at}
              />
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineItem({ label, date, active }: { label: string; date: string | null; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-[#3B5BDB]' : 'bg-[#E5E7EB]'}`} />
      <div className="flex-1">
        <p className={`text-xs ${active ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>{label}</p>
        <p className={`text-sm font-medium ${active ? 'text-[#111827]' : 'text-[#D1D5DB]'}`}>
          {date ? fmtDate(date) : '—'}
        </p>
      </div>
    </div>
  )
}
