import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Search, AlertCircle,
  Edit2, Trash2, ChevronDown,
  Plus, CheckCircle, XCircle, RefreshCw, FileText, X,
  Loader2, ShoppingCart, UserPlus, Package,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { EmitirNFeButton } from '../../components/EmitirNFeButton'
import { PaymentSection } from './PaymentSection'
import type { Installment } from './paymentUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab    = 'quotes' | 'orders'
type OrderTab   = 'all' | 'done' | 'pending' | 'no_seller' | 'no_class'
type QuoteStatus = 'pending' | 'approved' | 'rejected' | 'converted'

interface ClientResult {
  id: string
  name: string
  cnpj: string | null
}

interface ProductResult {
  id: string
  sku: string
  name: string
  price: number
  cost: number | null
  unit: string | null
}

interface LineItem {
  product_id: string
  sku: string
  name: string
  unit: string | null
  qty: number
  unit_price: number
  discount: number
  cost: number | null
}

interface RawQuote {
  id: string
  company_id: string
  client_id: string | null
  seller_id: string | null
  status: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  rejection_reason: string | null
  rejection_competitor_price: number | null
  rejection_competitor_name: string | null
  created_at: string
  updated_at: string
  clients: { name: string } | null
}

interface OrderItem {
  id: string
  product_id: string | null
  qty: number
  unit_price: number
  cost_at_sale: number | null
  products: { name: string } | null
}

interface RawOrder {
  id: string
  created_at: string
  order_number: string | null
  order_date: string | null
  total: number
  status: string
  seller_id: string | null
  company_id: string
  nfe_status: string | null
  nfe_ref: string | null
  nfe_key: string | null
  nfe_url: string | null
  client_id: string | null
  clients: { name: string } | null
  order_items: OrderItem[]
}

interface Order extends RawOrder {
  firstProduct: string
  itemCount: number
}

interface RejectTarget {
  id: string
  mode: 'quote' | 'order'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOrder(r: RawOrder): Order {
  const items = r.order_items ?? []
  const first = items[0]?.products?.name ?? items[0]?.product_id ?? '—'
  return { ...r, firstProduct: first, itemCount: items.length }
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$\u00a0${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `R$\u00a0${(v / 1_000).toFixed(0)}k`
  return fmt(v)
}
function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}
function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function isDone(status: string) {
  return ['invoiced','delivered','cancelled'].includes(status.toLowerCase())
}
function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function lineTotal(item: LineItem) {
  return Math.max(0, item.qty * item.unit_price - item.discount)
}

function calcMargem(o: Order): number | null {
  const items = o.order_items ?? []
  if (items.length === 0) return null
  const custo = items.reduce((s, i) => s + ((i.cost_at_sale ?? 0) * i.qty), 0)
  if (custo === 0 || o.total === 0) return null
  return (o.total - custo) / o.total
}

const FULL_ACCESS = ['owner', 'admin', 'manager']

const inputCls = 'w-full px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'
const labelCls = 'block text-xs font-medium text-[#374151] mb-1'

// ─── Badges ───────────────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'quote':      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Orçamento</span>
    case 'pending':    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><AlertCircle size={10} />Pendente</span>
    case 'approved':   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Aprovado</span>
    case 'rejected':   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Recusado</span>
    case 'invoiced':   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Faturado</span>
    case 'delivered':  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Entregue</span>
    case 'cancelled':  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Cancelado</span>
    default:           return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">{status}</span>
  }
}

function QuoteStatusBadge({ status }: { status: string }) {
  switch (status as QuoteStatus) {
    case 'pending':   return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pendente</span>
    case 'approved':  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-[#3B5BDB]">Aprovado</span>
    case 'rejected':  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Recusado</span>
    case 'converted': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Convertido</span>
    default:          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">{status}</span>
  }
}


const FALLBACK_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

// ─── Modal: Novo Orçamento / Novo Pedido ──────────────────────────────────────

interface DocModalProps {
  mode: 'quote' | 'order'
  companyId: string
  sellerId: string
  sellers: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

function DocModal({ mode, companyId, sellerId, sellers, onClose, onSaved }: DocModalProps) {

  // ── Section 1: Header ──────────────────────────────────────────────────────
  const [tipo,           setTipo]           = useState<'quote' | 'order'>(mode)
  const [docStatus,      setDocStatus]      = useState('pending')
  const [numero,         setNumero]         = useState('')
  const [saleDate,       setSaleDate]       = useState(() => new Date().toISOString().split('T')[0])
  const [assignedSeller, setAssignedSeller] = useState(sellerId)

  // ── Section 2: Items ───────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>([])

  // ── Section 3: Payment ─────────────────────────────────────────────────────
  const [paymentMethod,    setPaymentMethod]    = useState('')
  const [paymentTerm,      setPaymentTerm]      = useState('')
  const [customTerm,       setCustomTerm]       = useState('')
  const [numInstallments,  setNumInstallments]  = useState(1)
  const [installments,     setInstallments]     = useState<Installment[]>([])

  // ── Section 4: Notes ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')

  // ── Section 5: Fiscal ──────────────────────────────────────────────────────
  const [cfop,       setCfop]       = useState('5102')
  const [fiscalNotes, setFiscalNotes] = useState('')

  // ── Submission ─────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Client search ──────────────────────────────────────────────────────────
  const [clientQ,        setClientQ]       = useState('')
  const [clientResults,  setClientResults] = useState<ClientResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)

  // ── Product search ─────────────────────────────────────────────────────────
  const [productQ,       setProductQ]       = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const productInputRef = useRef<HTMLDivElement>(null)
  const [productDropRect, setProductDropRect] = useState<DOMRect | null>(null)

  // ── Sub-modal: Novo Cliente ────────────────────────────────────────────────
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState({ name: '', cnpj: '', email: '', phone: '', city: '', state: '' })
  const [savingClient,  setSavingClient]  = useState(false)
  const [clientFormErr, setClientFormErr] = useState<string | null>(null)

  // ── Sub-modal: Novo Produto ────────────────────────────────────────────────
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductForm, setNewProductForm] = useState({ name: '', sku: '', ncm: '', unit: '', price: '', cost: '' })
  const [savingProduct,  setSavingProduct]  = useState(false)
  const [productFormErr, setProductFormErr] = useState<string | null>(null)

  // ── Auto-generate sequential number ──────────────────────────────────────

  useEffect(() => {
    const cid = companyId || FALLBACK_COMPANY_ID
    async function genNumber() {
      const table = tipo === 'order' ? 'orders' : 'quotes'
      const { data } = await supabase
        .from(table)
        .select('order_number')
        .eq('company_id', cid)
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false })
        .limit(1)
      const last = data?.[0]?.order_number
      const lastNum = last ? parseInt(last.replace(/\D/g, '')) : 0
      const next = lastNum + 1
      setNumero(
        tipo === 'order'
          ? String(next)
          : `ORC-${String(next).padStart(4, '0')}`
      )
    }
    genNumber()
  }, [tipo, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search handlers ────────────────────────────────────────────────────────

  async function handleClientChange(val: string) {
    setClientQ(val)
    const term = val.trim()
    if (term.length < 2) { setClientResults([]); return }
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, cnpj')
      .ilike('name', `%${term}%`)
      .eq('company_id', FALLBACK_COMPANY_ID)
      .limit(10)
    if (error) console.error('[busca cliente]', error)
    setClientResults((data ?? []) as ClientResult[])
  }

  async function handleProductChange(val: string) {
    setProductQ(val)
    const term = val.trim()
    if (term.length < 2) { setProductResults([]); return }
    const [byName, bySku] = await Promise.all([
      supabase.from('products').select('id, sku, name, price, cost, unit')
        .eq('company_id', FALLBACK_COMPANY_ID).eq('is_active', true)
        .ilike('name', `%${term}%`).limit(10),
      supabase.from('products').select('id, sku, name, price, cost, unit')
        .eq('company_id', FALLBACK_COMPANY_ID).eq('is_active', true)
        .ilike('sku', `%${term}%`).limit(10),
    ])
    const seen = new Set<string>()
    const merged: ProductResult[] = []
    for (const p of [...(byName.data ?? []), ...(bySku.data ?? [])]) {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p as ProductResult) }
      if (merged.length === 10) break
    }
    setProductResults(merged)
    if (productInputRef.current) setProductDropRect(productInputRef.current.getBoundingClientRect())
  }

  // ── Item helpers ──────────────────────────────────────────────────────────

  function selectClient(c: ClientResult) {
    setSelectedClient(c)
    setClientQ('')
    setClientResults([])
  }

  function addProduct(p: ProductResult) {
    setItems(prev => [...prev, {
      product_id: p.id,
      sku:        p.sku,
      name:       p.name,
      unit:       p.unit,
      qty:        1,
      unit_price: p.price,
      discount:   0,
      cost:       p.cost,
    }])
    setProductQ('')
    setProductResults([])
    setProductDropRect(null)
  }

  function updateItem(idx: number, field: 'qty' | 'unit_price' | 'discount', raw: string) {
    const val = parseFloat(raw) || 0
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'qty') return { ...item, qty: Math.max(1, val) }
      return { ...item, [field]: Math.max(0, val) }
    }))
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal      = items.reduce((s, it) => s + it.qty * it.unit_price, 0)
  const totalDiscount = items.reduce((s, it) => s + it.discount, 0)
  const total         = Math.max(0, subtotal - totalDiscount)

  // ── Sub-modal: save new client ────────────────────────────────────────────

  async function saveNewClient() {
    if (!newClientForm.name.trim()) { setClientFormErr('Nome é obrigatório.'); return }
    setSavingClient(true)
    setClientFormErr(null)
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          company_id: companyId || FALLBACK_COMPANY_ID,
          name:       newClientForm.name.trim(),
          cnpj:       newClientForm.cnpj.trim()  || null,
          email:      newClientForm.email.trim() || null,
          phone:      newClientForm.phone.trim() || null,
          city:       newClientForm.city.trim()  || null,
          state:      newClientForm.state.trim() || null,
        })
        .select('id, name, cnpj')
        .single()
      if (error) throw error
      selectClient(data as ClientResult)
      setShowNewClient(false)
      setNewClientForm({ name: '', cnpj: '', email: '', phone: '', city: '', state: '' })
    } catch (err: unknown) {
      console.error('[saveNewClient] erro:', err)
      const e = err as { message?: string; details?: string } | null
      setClientFormErr([e?.message, e?.details].filter(Boolean).join(' — ') || String(err))
    } finally {
      setSavingClient(false)
    }
  }

  // ── Sub-modal: save new product ───────────────────────────────────────────

  async function saveNewProduct() {
    if (!newProductForm.name.trim()) { setProductFormErr('Nome é obrigatório.'); return }
    if (!newProductForm.price)       { setProductFormErr('Preço de venda é obrigatório.'); return }
    setSavingProduct(true)
    setProductFormErr(null)
    try {
      const price        = parseFloat(newProductForm.price)
      const purchaseCost = newProductForm.cost ? parseFloat(newProductForm.cost) : null
      const cost         = purchaseCost !== null ? purchaseCost * 1.15 : null
      const { data, error } = await supabase
        .from('products')
        .insert({
          company_id: companyId || FALLBACK_COMPANY_ID,
          name:       newProductForm.name.trim(),
          sku:        newProductForm.sku.trim()  || null,
          ncm:        newProductForm.ncm.trim()  || null,
          unit:       newProductForm.unit.trim() || null,
          price,
          cost,
          stock_qty:  0,
          is_active:  true,
        })
        .select('id, sku, name, price, cost, unit')
        .single()
      if (error) throw error
      addProduct(data as ProductResult)
      setShowNewProduct(false)
      setNewProductForm({ name: '', sku: '', ncm: '', unit: '', price: '', cost: '' })
    } catch (err: unknown) {
      console.error('[saveNewProduct] erro:', err)
      const e = err as { message?: string; details?: string } | null
      setProductFormErr([e?.message, e?.details].filter(Boolean).join(' — ') || String(err))
    } finally {
      setSavingProduct(false)
    }
  }

  // ── Main save ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedClient)    { setSaveError('Selecione um cliente.'); return }
    if (items.length === 0) { setSaveError('Adicione ao menos um item.'); return }

    setSaving(true)
    setSaveError(null)

    try {
      if (tipo === 'quote') {
        const { data: quote, error: qErr } = await supabase
          .from('quotes')
          .insert({
            company_id: companyId || FALLBACK_COMPANY_ID,
            client_id:  selectedClient.id,
            seller_id:  assignedSeller || null,
            status:     docStatus,
            subtotal,
            discount:   totalDiscount,
            total,
            notes:      notes.trim() || null,
          })
          .select('id')
          .single()

        if (qErr) throw qErr

        const { error: qiErr } = await supabase
          .from('quote_items')
          .insert(items.map(it => ({
            quote_id:   quote.id,
            product_id: it.product_id,
            qty:        it.qty,
            unit_price: it.unit_price,
            discount:   it.discount,
            total:      lineTotal(it),
          })))

        if (qiErr) throw qiErr

      } else {
        const { data: order, error: oErr } = await supabase
          .from('orders')
          .insert({
            company_id:     companyId || FALLBACK_COMPANY_ID,
            client_id:      selectedClient.id,
            seller_id:      assignedSeller || null,
            status:         docStatus,
            subtotal,
            discount:       totalDiscount,
            total,
            notes:          notes.trim() || null,
            payment_method: paymentMethod || null,
            payment_term:   (paymentTerm === 'Personalizado' ? customTerm : paymentTerm) || null,
            due_dates:      installments.length > 0 ? installments : null,
          })
          .select('id')
          .single()

        if (oErr) throw oErr

        const { error: oiErr } = await supabase
          .from('order_items')
          .insert(items.map(it => ({
            order_id:       order.id,
            product_id:     it.product_id,
            qty:            it.qty,
            unit_price:     it.unit_price,
            discount:       it.discount,
            total:          lineTotal(it),
            cost_at_sale:   it.cost,
            commission_pct: 0,
            picked:         false,
          })))

        if (oiErr) throw oiErr
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      console.error('[handleSave] erro completo:', err)
      const e = err as { message?: string; details?: string; hint?: string; code?: string } | null
      setSaveError(e?.message || e?.details || e?.hint || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />

        <div className="relative z-10 bg-[#FAFAF9] rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-4xl mx-4 flex flex-col" style={{ maxHeight: '95vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white rounded-t-xl shrink-0">
            <div className="flex items-center gap-3">
              <ShoppingCart size={15} className="text-[#3B5BDB]" />
              <span className="font-semibold text-[#111827] text-sm">
                {tipo === 'quote' ? 'Novo Orçamento' : 'Novo Pedido'}
              </span>
              {numero && (
                <span className="text-xs font-mono text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-md">
                  #{numero}
                </span>
              )}
            </div>
            {!saving && (
              <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-6 space-y-8">

            {/* ── 1. Cabeçalho ── */}
            <div>
              <SectionTitle>Cabeçalho</SectionTitle>
              <div className="space-y-4">

                {/* Tipo + Status + Data */}
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className={labelCls}>Tipo</p>
                    <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
                      {([
                        { value: 'quote', label: 'Orçamento'    },
                        { value: 'order', label: 'Venda avulsa' },
                      ] as { value: 'quote' | 'order'; label: string }[]).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTipo(opt.value)}
                          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                            tipo === opt.value
                              ? 'bg-[#3B5BDB] text-white'
                              : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-40">
                    <label className={labelCls}>Status</label>
                    <select value={docStatus} onChange={e => setDocStatus(e.target.value)} className={inputCls}>
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                    </select>
                  </div>

                  <div className="w-44">
                    <label className={labelCls}>Data da venda</label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={e => setSaleDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Cliente */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Cliente</label>
                    <button
                      type="button"
                      onClick={() => { setShowNewClient(true); setClientFormErr(null) }}
                      className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:text-[#3451C7] font-medium transition-colors"
                    >
                      <UserPlus size={12} /> Novo Cliente
                    </button>
                  </div>
                  {selectedClient ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FF] border border-indigo-200 rounded-lg w-fit">
                      <span className="text-sm text-[#3B5BDB] font-medium">{selectedClient.name}</span>
                      <button onClick={() => setSelectedClient(null)} className="text-[#3B5BDB]/60 hover:text-[#3B5BDB] transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        placeholder="Buscar cliente por nome…"
                        value={clientQ}
                        onChange={e => handleClientChange(e.target.value)}
                        onBlur={() => setTimeout(() => setClientResults([]), 150)}
                        className={`${inputCls} pl-8`}
                      />
                      {clientResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg overflow-hidden z-50">
                          {clientResults.map(c => (
                            <button
                              key={c.id}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => selectClient(c)}
                              className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] transition-colors"
                            >
                              <p className="text-sm font-medium text-[#111827]">{c.name}</p>
                              {c.cnpj && <p className="text-xs text-[#6B7280] font-mono">{c.cnpj}</p>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Vendedor */}
                {sellers.length > 0 && (
                  <div className="w-72">
                    <label className={labelCls}>Vendedor responsável</label>
                    <select value={assignedSeller} onChange={e => setAssignedSeller(e.target.value)} className={inputCls}>
                      <option value="">Sem vendedor</option>
                      {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. Itens ── */}
            <div>
              <SectionTitle>Itens</SectionTitle>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Buscar produto</label>
                    <button
                      type="button"
                      onClick={() => { setShowNewProduct(true); setProductFormErr(null) }}
                      className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:text-[#3451C7] font-medium transition-colors"
                    >
                      <Package size={12} /> Novo Produto
                    </button>
                  </div>
                  <div ref={productInputRef} className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou SKU…"
                      value={productQ}
                      onChange={e => handleProductChange(e.target.value)}
                      onBlur={() => setTimeout(() => { setProductResults([]); setProductDropRect(null) }, 150)}
                      className={`${inputCls} pl-8`}
                    />
                    {productResults.length > 0 && productDropRect && createPortal(
                      <div
                        style={{ position: 'fixed', top: productDropRect.bottom + 4, left: productDropRect.left, width: productDropRect.width, zIndex: 9999 }}
                        className="bg-white border border-[#E5E7EB] rounded-lg shadow-lg overflow-hidden"
                      >
                        {productResults.map(p => (
                          <button
                            key={p.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => addProduct(p)}
                            className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] transition-colors flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#111827] truncate">{p.name}</p>
                              <p className="text-xs text-[#9CA3AF]">{p.sku}{p.unit ? ` · ${p.unit}` : ''}</p>
                            </div>
                            <span className="text-sm font-medium text-[#374151] whitespace-nowrap tabular-nums shrink-0">
                              {fmt(p.price)}
                            </span>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>

                {items.length > 0 ? (
                  <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="text-left px-3 py-2 text-xs font-medium text-[#6B7280]">Produto</th>
                          <th className="text-center px-2 py-2 text-xs font-medium text-[#6B7280] w-20">Qtd</th>
                          <th className="text-right px-2 py-2 text-xs font-medium text-[#6B7280] w-32">Preço Unit.</th>
                          <th className="text-right px-2 py-2 text-xs font-medium text-[#6B7280] w-28">Desconto (R$)</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-[#6B7280] w-28">Total</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} className="border-b border-[#F3F4F6] last:border-0">
                            <td className="px-3 py-2.5">
                              <p className="text-[#111827] font-medium truncate max-w-52">{it.name}</p>
                              <p className="text-xs text-[#9CA3AF]">{it.sku ?? '—'}{it.unit ? ` · ${it.unit}` : ''}</p>
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number" min="1" step="1"
                                value={it.qty}
                                onChange={e => updateItem(idx, 'qty', e.target.value)}
                                className="w-16 text-center py-1 px-2 text-sm border border-[#E5E7EB] rounded-md outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB]/20 tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number" min="0" step="0.01"
                                value={it.unit_price}
                                onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                                className="w-28 text-right py-1 px-2 text-sm border border-[#E5E7EB] rounded-md outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB]/20 tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number" min="0" step="0.01"
                                value={it.discount}
                                onChange={e => updateItem(idx, 'discount', e.target.value)}
                                className="w-24 text-right py-1 px-2 text-sm border border-[#E5E7EB] rounded-md outline-none focus:border-[#3B5BDB] focus:ring-1 focus:ring-[#3B5BDB]/20 tabular-nums"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-[#111827] tabular-nums whitespace-nowrap">
                              {fmt(lineTotal(it))}
                            </td>
                            <td className="px-2 py-2.5">
                              <button onClick={() => removeItem(idx)} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-end gap-6 text-sm">
                      <span className="text-[#6B7280]">
                        Itens: <span className="font-medium text-[#374151] tabular-nums">{fmt(subtotal)}</span>
                      </span>
                      {totalDiscount > 0 && (
                        <span className="text-[#6B7280]">
                          Desconto: <span className="font-medium text-red-500 tabular-nums">−{fmt(totalDiscount)}</span>
                        </span>
                      )}
                      <span className="font-semibold text-[#111827]">
                        Total líquido: <span className="tabular-nums text-[#3B5BDB]">{fmt(total)}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#E5E7EB] rounded-lg py-10 text-center text-sm text-[#9CA3AF] bg-white">
                    Nenhum item adicionado. Busque um produto acima.
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. Pagamento ── */}
            <PaymentSection
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              paymentTerm={paymentTerm}
              onPaymentTermChange={setPaymentTerm}
              customTerm={customTerm}
              onCustomTermChange={setCustomTerm}
              numInstallments={numInstallments}
              onNumInstallmentsChange={setNumInstallments}
              installments={installments}
              onInstallmentsChange={setInstallments}
              total={total}
              inputCls={inputCls}
              labelCls={labelCls}
              sectionTitle={<SectionTitle>Pagamento</SectionTitle>}
            />

            {/* ── 4. Observações ── */}
            <div>
              <SectionTitle>Observações</SectionTitle>
              <textarea
                rows={3}
                placeholder="Observações internas ou para o cliente…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* ── 5. Informações Fiscais ── */}
            <div>
              <SectionTitle>Informações Fiscais</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>CFOP</label>
                  <input
                    type="text"
                    value={cfop}
                    onChange={e => setCfop(e.target.value)}
                    className={inputCls}
                    placeholder="5102"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Observações fiscais</label>
                  <input
                    type="text"
                    value={fiscalNotes}
                    onChange={e => setFiscalNotes(e.target.value)}
                    className={inputCls}
                    placeholder="Informações adicionais para a nota fiscal…"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E5E7EB] px-6 py-4 shrink-0 bg-white rounded-b-xl">
            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                {saveError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-[#3B5BDB] hover:bg-[#3451C7] rounded-lg transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {tipo === 'quote' ? 'Salvar Orçamento' : 'Salvar Pedido'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modal: Novo Cliente */}
      {showNewClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingClient && setShowNewClient(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <UserPlus size={15} className="text-[#3B5BDB]" />
                <span className="font-semibold text-[#111827] text-sm">Novo Cliente</span>
              </div>
              {!savingClient && (
                <button onClick={() => setShowNewClient(false)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className={labelCls}>Nome <span className="text-red-500">*</span></label>
                <input type="text" value={newClientForm.name}
                  onChange={e => setNewClientForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="Razão social ou nome" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <input type="text" value={newClientForm.cnpj}
                    onChange={e => setNewClientForm(f => ({ ...f, cnpj: e.target.value }))}
                    className={inputCls} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input type="text" value={newClientForm.phone}
                    onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputCls} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" value={newClientForm.email}
                  onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls} placeholder="contato@empresa.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cidade</label>
                  <input type="text" value={newClientForm.city}
                    onChange={e => setNewClientForm(f => ({ ...f, city: e.target.value }))}
                    className={inputCls} placeholder="Goiânia" />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <input type="text" value={newClientForm.state} maxLength={2}
                    onChange={e => setNewClientForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                    className={inputCls} placeholder="GO" />
                </div>
              </div>
              {clientFormErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{clientFormErr}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#E5E7EB] flex justify-end gap-2">
              <button onClick={() => setShowNewClient(false)} disabled={savingClient}
                className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] font-medium transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={saveNewClient} disabled={savingClient}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#3B5BDB] hover:bg-[#3451C7] rounded-lg transition-colors disabled:opacity-60">
                {savingClient && <Loader2 size={13} className="animate-spin" />}
                Salvar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Novo Produto */}
      {showNewProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingProduct && setShowNewProduct(false)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <Package size={15} className="text-[#3B5BDB]" />
                <span className="font-semibold text-[#111827] text-sm">Novo Produto</span>
              </div>
              {!savingProduct && (
                <button onClick={() => setShowNewProduct(false)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className={labelCls}>Nome <span className="text-red-500">*</span></label>
                <input type="text" value={newProductForm.name}
                  onChange={e => setNewProductForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="Nome do produto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>SKU</label>
                  <input type="text" value={newProductForm.sku}
                    onChange={e => setNewProductForm(f => ({ ...f, sku: e.target.value }))}
                    className={inputCls} placeholder="COD-001" />
                </div>
                <div>
                  <label className={labelCls}>NCM</label>
                  <input type="text" value={newProductForm.ncm}
                    onChange={e => setNewProductForm(f => ({ ...f, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    className={inputCls} placeholder="00000000" maxLength={8} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Unidade</label>
                <input type="text" value={newProductForm.unit}
                  onChange={e => setNewProductForm(f => ({ ...f, unit: e.target.value }))}
                  className={inputCls} placeholder="un, kg, cx…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Preço de venda <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">R$</span>
                    <input type="number" min="0" step="0.01" value={newProductForm.price}
                      onChange={e => setNewProductForm(f => ({ ...f, price: e.target.value }))}
                      className={`${inputCls} pl-8`} placeholder="0,00" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Custo de compra</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">R$</span>
                    <input type="number" min="0" step="0.01" value={newProductForm.cost}
                      onChange={e => setNewProductForm(f => ({ ...f, cost: e.target.value }))}
                      className={`${inputCls} pl-8`} placeholder="0,00" />
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] mt-1">Custo interno = compra × 1,15</p>
                </div>
              </div>
              {productFormErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{productFormErr}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#E5E7EB] flex justify-end gap-2">
              <button onClick={() => setShowNewProduct(false)} disabled={savingProduct}
                className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] font-medium transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={saveNewProduct} disabled={savingProduct}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#3B5BDB] hover:bg-[#3451C7] rounded-lg transition-colors disabled:opacity-60">
                {savingProduct && <Loader2 size={13} className="animate-spin" />}
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Modal: Rejeição ──────────────────────────────────────────────────────────

interface RejectModalProps {
  target: RejectTarget
  onClose: () => void
  onRejected: () => void
}

function RejectModal({ target, onClose, onRejected }: RejectModalProps) {
  const isOrder = target.mode === 'order'

  const [reason,     setReason]     = useState('')
  const [price,      setPrice]      = useState('')
  const [competitor, setCompetitor] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const canSubmit = !isOrder || reason.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) { setError('O motivo é obrigatório.'); return }

    setSaving(true)
    setError(null)

    try {
      if (isOrder) {
        const { error: err } = await supabase
          .from('orders')
          .update({ status: 'rejected', rejection_reason: reason.trim() })
          .eq('id', target.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('quotes')
          .update({
            status: 'rejected',
            rejection_reason:           reason.trim() || null,
            rejection_competitor_price: price ? parseFloat(price) : null,
            rejection_competitor_name:  competitor.trim() || null,
          })
          .eq('id', target.id)
        if (err) throw err
      }

      onRejected()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao recusar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />

      <div className="relative z-10 bg-white rounded-xl shadow-lg border border-[#E5E7EB] w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <XCircle size={16} className="text-red-500" />
            <span className="font-semibold text-[#111827] text-sm">
              Recusar {isOrder ? 'Pedido' : 'Orçamento'}
            </span>
          </div>
          {!saving && (
            <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">

            <div>
              <label className={labelCls}>
                Motivo{isOrder ? <span className="text-red-500 ml-0.5">*</span> : ' (opcional)'}
              </label>
              <textarea
                rows={3}
                placeholder={isOrder ? 'Informe o motivo da recusa…' : 'Ex.: produto fora de linha, preço elevado…'}
                value={reason}
                onChange={e => setReason(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Quote-only fields */}
            {!isOrder && (
              <>
                <div>
                  <label className={labelCls}>Preço encontrado pelo cliente (opcional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">R$</span>
                    <input
                      type="number" min="0" step="0.01"
                      placeholder="0,00"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Concorrente (opcional)</label>
                  <input
                    type="text"
                    placeholder="Nome do concorrente ou plataforma…"
                    value={competitor}
                    onChange={e => setCompetitor(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Confirmar Recusa
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const { seller, role } = useAuth()
  const navigate = useNavigate()

  const canSeeAll      = role ? FULL_ACCESS.includes(role) : false
  const canSeeVendedor = canSeeAll

  // ── Main tab ──────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('quotes')

  // ── Orders state ──────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [orderSearch,     setOrderSearch]     = useState('')
  const [sellerFilter,    setSellerFilter]    = useState('all')
  const [orderTab,        setOrderTab]        = useState<OrderTab>('all')
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  // ── Quotes state ──────────────────────────────────────────────────────────
  const [quoteSearch,       setQuoteSearch]       = useState('')
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<'all' | QuoteStatus>('all')

  // ── Modal state ───────────────────────────────────────────────────────────
  const [docModalMode,  setDocModalMode]  = useState<null | 'quote' | 'order'>(null)
  const [rejectTarget,  setRejectTarget]  = useState<RejectTarget | null>(null)
  const [convertingId,  setConvertingId]  = useState<string | null>(null)

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: rawOrders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } =
    useSupabaseQuery<RawOrder[]>(
      ({ company_id }) =>
        supabase
          .from('orders')
          .select('id, created_at, order_number, order_date, total, status, seller_id, client_id, company_id, nfe_status, nfe_ref, nfe_key, nfe_url, clients(name), order_items(id, product_id, qty, unit_price, cost_at_sale, products(name))')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }) as any,
      [],
    )

  const { data: rawQuotes, loading: quotesLoading, error: quotesError, refetch: refetchQuotes } =
    useSupabaseQuery<RawQuote[]>(
      ({ company_id }) =>
        supabase
          .from('quotes')
          .select('*, clients(name)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }),
      [],
    )

  const { data: rawSellers } = useSupabaseQuery<{ id: string; name: string }[]>(
    ({ company_id }) =>
      supabase
        .from('sellers')
        .select('id, name')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .order('name'),
    [],
  )

  const orders      = useMemo(() => (rawOrders ?? []).map(toOrder), [rawOrders])
  const quotes      = rawQuotes  ?? []
  const sellersList = rawSellers ?? []

  // ── Orders derived ────────────────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    const mKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    const q    = orderSearch.toLowerCase().trim()
    return orders.filter(o => {
      if (monthKey(o.order_date ?? o.created_at) !== mKey)                                          return false
      if (orderTab === 'done'      && !isDone(o.status))                            return false
      if (orderTab === 'pending'   &&  isDone(o.status))                            return false
      if (orderTab === 'no_seller' &&  o.seller_id !== null)                        return false

      if (canSeeVendedor && sellerFilter !== 'all' && o.seller_id !== sellerFilter) return false
      if (q) {
        const client = (o.clients?.name ?? '').toLowerCase()
        if (!client.includes(q)) return false
      }
      return true
    })
  }, [orders, currentMonth, orderTab, orderSearch, sellerFilter, canSeeVendedor])

  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total ?? 0), 0)
  const allRevenue   = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  const orderTabCounts = useMemo(() => {
    const mKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    const m    = orders.filter(o => monthKey(o.order_date ?? o.created_at) === mKey)
    return {
      all:       m.length,
      done:      m.filter(o =>  isDone(o.status)).length,
      pending:   m.filter(o => !isDone(o.status)).length,
      no_seller: m.filter(o =>  o.seller_id === null).length,
      no_class:  0,
    }
  }, [orders, currentMonth])

  const orderGroups = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of filteredOrders) {
      const k = monthKey(o.order_date ?? o.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredOrders])

  // ── Quotes derived ────────────────────────────────────────────────────────

  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.toLowerCase().trim()
    return quotes.filter(qt => {
      if (quoteStatusFilter !== 'all' && qt.status !== quoteStatusFilter) return false
      if (q && !(qt.clients?.name ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [quotes, quoteSearch, quoteStatusFilter])

  // ── Actions ───────────────────────────────────────────────────────────────

  function toggleMonth(key: string) {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDeleteOrder(id: string) {
    if (!confirm('Excluir este pedido?')) return
    await supabase.from('orders').delete().eq('id', id)
    refetchOrders()
  }

  async function handleApproveQuote(id: string) {
    await supabase.from('quotes').update({ status: 'approved' }).eq('id', id)
    refetchQuotes()
  }

  async function handleApproveOrder(id: string) {
    const { error } = await supabase.from('orders')
      .update({ status: 'approved' })
      .eq('id', id)
    if (error) { alert(`Erro ao aprovar pedido: ${error.message}`); return }
    refetchOrders()
  }

  async function handleConvertToOrder(qt: RawQuote) {
    if (!confirm('Converter este orçamento em pedido?')) return
    setConvertingId(qt.id)
    try {
      // 1. Buscar itens do orçamento
      const { data: quoteItems, error: qiErr } = await supabase
        .from('quote_items')
        .select('product_id, qty, unit_price, discount, total')
        .eq('quote_id', qt.id)
      if (qiErr) throw qiErr

      // 2. Buscar custos dos produtos
      const ids = (quoteItems ?? []).map(i => i.product_id).filter(Boolean) as string[]
      const costMap = new Map<string, number>()
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from('products').select('id, cost').in('id', ids)
        for (const p of prods ?? []) {
          if (p.cost !== null) costMap.set(p.id as string, p.cost as number)
        }
      }

      // 3. Criar pedido
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          company_id: qt.company_id,
          client_id:  qt.client_id,
          seller_id:  qt.seller_id,
          status:     'pending',
          subtotal:   qt.subtotal,
          discount:   qt.discount,
          total:      qt.total,
          notes:      qt.notes,
        })
        .select('id')
        .single()
      if (oErr) throw oErr

      // 4. Criar itens do pedido
      if ((quoteItems ?? []).length > 0) {
        const { error: oiErr } = await supabase
          .from('order_items')
          .insert((quoteItems ?? []).map(qi => ({
            order_id:      order.id,
            product_id:    qi.product_id,
            qty:           qi.qty,
            unit_price:    qi.unit_price,
            discount:      qi.discount,
            total:         qi.total,
            cost_at_sale:  qi.product_id ? (costMap.get(qi.product_id) ?? null) : null,
            commission_pct: 0,
            picked:        false,
          })))
        if (oiErr) throw oiErr
      }

      // 5. Marcar orçamento como convertido
      await supabase.from('quotes').update({ status: 'converted' }).eq('id', qt.id)

      refetchQuotes()
      refetchOrders()
    } catch (err) {
      console.error('Erro ao converter orçamento:', err)
      alert('Erro ao converter orçamento em pedido.')
    } finally {
      setConvertingId(null)
    }
  }

  // ── Tabs config ───────────────────────────────────────────────────────────

  const ORDER_TABS: { key: OrderTab; label: string }[] = [
    { key: 'all',       label: 'Todos'             },
    { key: 'done',      label: 'Concluídos'        },
    { key: 'pending',   label: 'Pendentes'         },
    { key: 'no_seller', label: 'Sem Vendedor'      },
    { key: 'no_class',  label: 'Sem Classificação' },
  ]

  const QUOTE_STATUS_OPTIONS: { value: 'all' | QuoteStatus; label: string }[] = [
    { value: 'all',       label: 'Todos os status'  },
    { value: 'pending',   label: 'Pendente'         },
    { value: 'approved',  label: 'Aprovado'         },
    { value: 'rejected',  label: 'Recusado'         },
    { value: 'converted', label: 'Convertido'       },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Vendas</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Orçamentos e pedidos</p>
          </div>
          <div className="flex items-center gap-6">
            {mainTab === 'quotes' ? (
              <>
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Orçamentos</p>
                  <p className="text-xl font-semibold text-[#111827] tabular-nums">
                    {quotesLoading ? '—' : quotes.length}
                  </p>
                </div>
                <div className="w-px h-8 bg-[#E5E7EB]" />
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Valor total</p>
                  <p className="text-xl font-semibold text-[#111827] tabular-nums">
                    {quotesLoading ? '—' : fmtShort(quotes.reduce((s, q) => s + q.total, 0))}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Total de pedidos</p>
                  <p className="text-xl font-semibold text-[#111827] tabular-nums">
                    {ordersLoading ? '—' : orders.length}
                  </p>
                </div>
                <div className="w-px h-8 bg-[#E5E7EB]" />
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Valor total</p>
                  <p className="text-xl font-semibold text-[#111827] tabular-nums">
                    {ordersLoading ? '—' : fmtShort(allRevenue)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex items-center gap-1 mt-4">
          {(['quotes', 'orders'] as MainTab[]).map(tab => {
            const label = tab === 'quotes' ? 'Orçamentos' : 'Pedidos'
            const count = tab === 'quotes' ? quotes.length : orders.length
            return (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mainTab === tab
                    ? 'bg-[#EEF2FF] text-[#3B5BDB]'
                    : 'text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    mainTab === tab ? 'bg-[#3B5BDB]/10 text-[#3B5BDB]' : 'bg-[#F3F4F6] text-[#6B7280]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* ═══════════════════════════════════════════════════════════════════
            ABA ORÇAMENTOS
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'quotes' && (
          <>
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Buscar por cliente…"
                  value={quoteSearch}
                  onChange={e => setQuoteSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
                />
              </div>

              <select
                value={quoteStatusFilter}
                onChange={e => setQuoteStatusFilter(e.target.value as 'all' | QuoteStatus)}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
              >
                {QUOTE_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] whitespace-nowrap">
                {filteredQuotes.length} orçamento{filteredQuotes.length !== 1 ? 's' : ''}
              </span>

              <button
                onClick={() => setDocModalMode('quote')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#3B5BDB] hover:bg-[#3451C7] rounded-lg transition-colors"
              >
                <Plus size={14} />
                Novo Orçamento
              </button>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {quotesError && (
                <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{quotesError}</div>
              )}
              {quotesLoading && (
                <div className="p-16 flex items-center justify-center">
                  <span className="text-sm text-[#9CA3AF]">Carregando orçamentos…</span>
                </div>
              )}
              {!quotesLoading && !quotesError && filteredQuotes.length === 0 && (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">
                  Nenhum orçamento encontrado.
                </div>
              )}
              {!quotesLoading && !quotesError && filteredQuotes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Cliente</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Valor Total</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Data</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map(qt => (
                        <tr key={qt.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-[#111827] font-medium truncate max-w-48">{qt.clients?.name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#111827] tabular-nums whitespace-nowrap">
                            {fmt(qt.total)}
                            {qt.discount > 0 && (
                              <p className="text-xs text-[#9CA3AF] font-normal">desc. {fmt(qt.discount)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3"><QuoteStatusBadge status={qt.status} /></td>
                          <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap text-xs">{fmtDate(qt.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {qt.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveQuote(qt.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                  >
                                    <CheckCircle size={11} />Aprovar
                                  </button>
                                  <button
                                    onClick={() => setRejectTarget({ id: qt.id, mode: 'quote' })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                                  >
                                    <XCircle size={11} />Recusar
                                  </button>
                                </>
                              )}
                              {qt.status === 'approved' && (
                                <button
                                  onClick={() => handleConvertToOrder(qt)}
                                  disabled={convertingId === qt.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#3B5BDB] bg-[#EEF2FF] hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors disabled:opacity-60"
                                >
                                  {convertingId === qt.id
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <RefreshCw size={11} />}
                                  Converter em Pedido
                                </button>
                              )}
                              {qt.status === 'rejected' && qt.rejection_reason && (
                                <span className="text-xs text-[#9CA3AF] italic truncate max-w-48" title={qt.rejection_reason}>
                                  {qt.rejection_reason}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ABA PEDIDOS
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'orders' && (
          <>
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Buscar por número ou cliente…"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
                />
              </div>

              {canSeeVendedor && (
                <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
                  className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition">
                  <option value="all">Todos os vendedores</option>
                  {sellersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}


<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] whitespace-nowrap">
                {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
              </span>

              <button
                onClick={() => setDocModalMode('order')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#3B5BDB] hover:bg-[#3451C7] rounded-lg transition-colors"
              >
                <Plus size={14} />
                Novo Pedido
              </button>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
                <button
                  onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#111827]">{monthLabel(currentMonth)}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {orderTabCounts.all} pedido{orderTabCounts.all !== 1 ? 's' : ''} · {fmt(totalRevenue)}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center px-4 border-b border-[#F3F4F6] overflow-x-auto">
                {ORDER_TABS.map(tab => (
                  <button key={tab.key} onClick={() => setOrderTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                      orderTab === tab.key
                        ? 'text-[#3B5BDB] border-b-2 border-[#3B5BDB] -mb-px'
                        : 'text-[#6B7280] hover:text-[#374151]'
                    }`}>
                    {tab.label}
                    {orderTabCounts[tab.key] > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        orderTab === tab.key ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}>
                        {orderTabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {ordersError && (
                <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{ordersError}</div>
              )}
              {ordersLoading && (
                <div className="p-16 flex items-center justify-center">
                  <span className="text-sm text-[#9CA3AF]">Carregando pedidos…</span>
                </div>
              )}
              {!ordersLoading && !ordersError && filteredOrders.length === 0 && (
                <div className="p-16 text-center text-sm text-[#9CA3AF]">
                  Nenhum pedido encontrado para este período.
                </div>
              )}
              {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Nº Pedido</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Data</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Cliente</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Produtos</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Total</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Margem</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Itens</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6B7280] uppercase tracking-wide">NF-e</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {orderGroups.map(([key, groupOrders]) => {
                        const collapsed  = collapsedMonths.has(key)
                        const groupTotal = groupOrders.reduce((s, o) => s + (o.total ?? 0), 0)
                        const [year, mon] = key.split('-').map(Number)
                        const label = new Date(year, mon - 1, 1)
                          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                          .replace(/^\w/, c => c.toUpperCase())

                        return [
                          <tr key={`hdr-${key}`}
                            onClick={() => toggleMonth(key)}
                            className="bg-[#F9FAFB] cursor-pointer hover:bg-[#F3F4F6] transition-colors border-y border-[#E5E7EB]">
                            <td colSpan={9} className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {collapsed
                                  ? <ChevronRight size={13} className="text-[#9CA3AF]" />
                                  : <ChevronDown  size={13} className="text-[#9CA3AF]" />}
                                <span className="text-xs font-semibold text-[#374151]">{label}</span>
                                <span className="text-xs text-[#9CA3AF]">
                                  · {groupOrders.length} pedido{groupOrders.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <span className="text-sm font-semibold text-emerald-600 tabular-nums">{fmt(groupTotal)}</span>
                            </td>
                          </tr>,

                          ...(!collapsed ? groupOrders.map(o => (
                            <tr key={o.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-4 py-3">
                                <button onClick={() => navigate(`/pedidos/${o.id}`)}
                                  className="text-[#3B5BDB] font-medium hover:underline">
                                  #{o.order_number ?? o.id.substring(0, 8).toUpperCase()}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{fmtDate(o.order_date ?? o.created_at)}</td>
                              <td className="px-4 py-3">
                                {o.client_id ? (
                                  <Link to={`/clientes/${o.client_id}`} className="text-[#111827] hover:text-[#3B5BDB] hover:underline truncate max-w-40 block">
                                    {o.clients?.name ?? '—'}
                                  </Link>
                                ) : (
                                  <p className="text-[#111827] truncate max-w-40">{o.clients?.name ?? '—'}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[#374151] truncate max-w-44">{o.firstProduct}</p>
                                {o.itemCount > 1 && (
                                  <p className="text-xs text-[#9CA3AF]">+{o.itemCount - 1} item{o.itemCount - 1 !== 1 ? 's' : ''}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-[#111827] tabular-nums whitespace-nowrap">
                                {fmt(o.total)}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-sm">
                                {(() => {
                                  const m = calcMargem(o)
                                  if (m === null) return <span className="text-[#9CA3AF]">—</span>
                                  const pct = m * 100
                                  const color = pct >= 15 ? 'text-emerald-600' : pct >= 10 ? 'text-amber-600' : 'text-red-600'
                                  return <span className={`font-medium ${color}`}>{pct.toFixed(1)}%</span>
                                })()}
                              </td>
                              <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                              <td className="px-4 py-3 text-center text-[#6B7280] tabular-nums">{o.itemCount}</td>
                              <td className="px-4 py-3">
                                {(o.status === 'approved' || o.status === 'invoiced') && (
                                  <EmitirNFeButton
                                    order={{ id: o.id, total: o.total, company_id: o.company_id, nfe_status: o.nfe_status, nfe_ref: o.nfe_ref, nfe_key: o.nfe_key, nfe_url: o.nfe_url }}
                                    clientName={o.clients?.name ?? '—'}
                                    onSuccess={refetchOrders}
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {o.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleApproveOrder(o.id)}
                                        className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                        title="Aprovar"
                                      >
                                        <CheckCircle size={13} />
                                      </button>
                                      <button
                                        onClick={() => setRejectTarget({ id: o.id, mode: 'order' })}
                                        className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Recusar"
                                      >
                                        <XCircle size={13} />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => navigate(`/pedidos/${o.id}`)}
                                    className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                                    title="Ver detalhes"
                                  >
                                    <FileText size={13} />
                                  </button>
                                  <button
                                    onClick={() => navigate(`/pedidos/${o.id}`)}
                                    className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(o.id)}
                                    className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )) : []),
                        ]
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modais */}
      {docModalMode && (
        <DocModal
          mode={docModalMode}
          companyId={seller?.company_id ?? ''}
          sellerId={seller?.id ?? ''}
          sellers={sellersList}
          onClose={() => setDocModalMode(null)}
          onSaved={() => { refetchQuotes(); refetchOrders() }}
        />
      )}

      {rejectTarget && (
        <RejectModal
          target={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            if (rejectTarget.mode === 'quote') refetchQuotes()
            else refetchOrders()
          }}
        />
      )}
    </div>
  )
}
