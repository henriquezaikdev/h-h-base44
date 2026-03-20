import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Edit2, Save, X,
  Phone, MessageCircle, ShoppingCart, Clock,
  Calendar, CheckSquare, Plus, FileText, AlertTriangle, Package,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type Classification = 'novo' | 'recorrente' | '60dias' | '90dias' | '120dias' | 'inativo'

interface Client {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  seller_id: string | null
  origin: string | null
  notes: string | null
  created_at: string
  last_contact_at: string | null
  sellers: { name: string } | null
  orders: Order[]
}

interface Order {
  id: string
  number: string | null
  total: number
  created_at: string
  status: string
}

interface OrderItem {
  product_name: string | null
  quantity: number
  order_id: string
  created_at: string
}

interface TopItem {
  product_name: string
  total_qty: number
  order_count: number
  last_purchase: string
}

interface Task {
  id: string
  title: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | null
  status: string
}

interface Buyer {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

function classify(orderCount: number, days: number | null): Classification {
  if (orderCount === 0 || days === null) return 'inativo'
  if (days > 120) return 'inativo'
  if (days > 90)  return '120dias'
  if (days > 60)  return '90dias'
  if (days > 45)  return '60dias'
  if (orderCount === 1 && days <= 90) return 'novo'
  return 'recorrente'
}

function avgTicket(orders: Order[]): number | null {
  if (orders.length === 0) return null
  return orders.reduce((s, o) => s + (o.total ?? 0), 0) / orders.length
}

function buildTopItems(items: OrderItem[], orders: Order[]): TopItem[] {
  const orderDateMap = new Map(orders.map(o => [o.id, o.created_at]))
  const map = new Map<string, TopItem>()
  for (const item of items) {
    const key = item.product_name ?? 'Sem nome'
    const date = orderDateMap.get(item.order_id) ?? item.created_at
    const existing = map.get(key)
    if (existing) {
      existing.total_qty += item.quantity
      existing.order_count += 1
      if (date > existing.last_purchase) existing.last_purchase = date
    } else {
      map.set(key, { product_name: key, total_qty: item.quantity, order_count: 1, last_purchase: date })
    }
  }
  return [...map.values()].sort((a, b) => b.total_qty - a.total_qty).slice(0, 10)
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtCNPJ(v: string | null) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function pluralDays(n: number | null) {
  if (n === null) return '—'
  if (n === 0) return 'hoje'
  if (n === 1) return '1 dia atrás'
  return `${n} dias atrás`
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CLASS_CFG: Record<Classification, { label: string; text: string; bg: string; dot: string }> = {
  novo:       { label: 'Novo',       text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  recorrente: { label: 'Recorrente', text: 'text-[#3B5BDB]',  bg: 'bg-[#EEF2FF]', dot: 'bg-[#3B5BDB]'  },
  '60dias':   { label: '60 dias',    text: 'text-amber-700',  bg: 'bg-amber-50',  dot: 'bg-amber-500'   },
  '90dias':   { label: '90 dias',    text: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500'  },
  '120dias':  { label: '120 dias',   text: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500'     },
  inativo:    { label: 'Inativo',    text: 'text-gray-500',   bg: 'bg-gray-100',  dot: 'bg-gray-400'    },
}

const PRIORITY_CFG = {
  high:   { label: 'Alta',  text: 'text-red-600',   bg: 'bg-red-50'   },
  medium: { label: 'Média', text: 'text-amber-600', bg: 'bg-amber-50' },
  low:    { label: 'Baixa', text: 'text-slate-500', bg: 'bg-slate-50' },
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-[#E5E7EB] rounded-xl p-4 ${className}`}>{children}</div>
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconCls }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; iconBg: string; iconCls: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6B7280] mb-1">{label}</p>
          <p className="text-xl font-semibold text-[#111827] tabular-nums leading-tight">{value}</p>
          {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
        </div>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={15} className={iconCls} />
        </div>
      </div>
    </Card>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#6B7280] mb-1">{children}</label>
}

function ReadValue({ value }: { value: string | null | undefined }) {
  return <p className="text-sm text-[#111827] min-h-[20px]">{value || '—'}</p>
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()

  const canEdit = role ? ['owner', 'admin', 'manager', 'seller'].includes(role) : false

  // ── Data state ─────────────────────────────────────────────────────────────
  const [client,    setClient]    = useState<Client | null>(null)
  const [orderItems,setOrderItems]= useState<OrderItem[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [buyers,    setBuyers]    = useState<Buyer[]>([])
  const [sellers,   setSellers]   = useState<{ id: string; name: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [buyersOpen,    setBuyersOpen]    = useState(true)
  const [newBuyerName,  setNewBuyerName]  = useState('')
  const [addingBuyer,   setAddingBuyer]   = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cnpj: '', status: 'active' as 'active' | 'inactive',
    origin: '', notes: '', seller_id: '',
  })

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      // 1. Client + orders (query principal conforme especificado)
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('*, sellers(name), orders(id, total, created_at, status)')
        .eq('id', id)
        .single()

      if (cancelled) return

      if (clientErr || !clientData) {
        console.error('[ClientePage]', clientErr)
        setError('Cliente não encontrado.')
        setLoading(false)
        return
      }

      const c = clientData as unknown as Client
      setClient(c)
      setForm({
        name:      c.name,
        email:     c.email     ?? '',
        phone:     c.phone     ?? '',
        cnpj:      c.cnpj      ?? '',
        status:    c.status,
        origin:    c.origin    ?? '',
        notes:     c.notes     ?? '',
        seller_id: c.seller_id ?? '',
      })

      // 2. Order items para Top 10 (busca separada pelos order ids)
      const orderIds = (c.orders ?? []).map(o => o.id)
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, quantity, order_id, created_at')
          .in('order_id', orderIds)
        if (!cancelled) setOrderItems((items ?? []) as OrderItem[])
      }

      // 3. Tasks e buyers em paralelo
      const [tasksRes, buyersRes, sellersRes] = await Promise.all([
        supabase.from('tasks').select('id, title, due_date, priority, status').eq('client_id', id).neq('status', 'done').order('due_date'),
        supabase.from('buyers').select('id, name, email, phone, role').eq('client_id', id).order('name'),
        supabase.from('sellers').select('id, name').eq('active', true).order('name'),
      ])

      if (!cancelled) {
        setTasks((tasksRes.data ?? []) as Task[])
        setBuyers((buyersRes.data ?? []) as Buyer[])
        setSellers((sellersRes.data ?? []) as { id: string; name: string }[])
        setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [id])

  // ── Derived ────────────────────────────────────────────────────────────────

  const orders         = client?.orders ?? []
  const sortedOrders   = useMemo(() => [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)), [orders])
  const lastOrderDate  = sortedOrders[0]?.created_at ?? null
  const daysSinceOrder = daysSince(lastOrderDate)
  const classification = classify(orders.length, daysSinceOrder)
  const totalRevenue   = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const avgTkt         = avgTicket(orders)
  const topItems       = useMemo(() => buildTopItems(orderItems, orders), [orderItems, orders])
  const recentOrders   = sortedOrders.slice(0, 5)
  const cls            = CLASS_CFG[classification]

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!id) return
    setSaving(true)
    const { error: err } = await supabase
      .from('clients')
      .update({
        name:      form.name,
        email:     form.email     || null,
        phone:     form.phone     || null,
        cnpj:      form.cnpj      || null,
        status:    form.status,
        origin:    form.origin    || null,
        notes:     form.notes     || null,
        seller_id: form.seller_id || null,
      })
      .eq('id', id)

    if (err) {
      console.error('[ClientePage] save error:', err)
    } else {
      setClient(prev => prev ? { ...prev, ...form } as unknown as Client : prev)
      setEditing(false)
    }
    setSaving(false)
  }

  // ── Add buyer ──────────────────────────────────────────────────────────────

  async function handleAddBuyer() {
    if (!newBuyerName.trim() || !id) return
    setAddingBuyer(true)
    const { data, error: err } = await supabase
      .from('buyers')
      .insert({ client_id: id, name: newBuyerName.trim() })
      .select('id, name, email, phone, role')
      .single()

    if (!err && data) {
      setBuyers(prev => [...prev, data as Buyer])
      setNewBuyerName('')
    }
    setAddingBuyer(false)
  }

  async function handleDeleteBuyer(buyerId: string) {
    await supabase.from('buyers').delete().eq('id', buyerId)
    setBuyers(prev => prev.filter(b => b.id !== buyerId))
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <span className="text-sm text-[#9CA3AF]">Carregando ficha…</span>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">{error ?? 'Cliente não encontrado.'}</p>
          <button onClick={() => navigate('/clientes')} className="text-sm text-[#3B5BDB] hover:underline">
            ← Voltar para listagem
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <button
          onClick={() => navigate('/clientes')}
          className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors"
        >
          <ChevronLeft size={14} /> Carteira de Clientes
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-[#111827]">{client.name}</h1>
              <Badge cls={client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                {client.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
              <Badge cls={`${cls.bg} ${cls.text}`}>{cls.label}</Badge>
              {orders.length >= 10 && (
                <Badge cls="bg-amber-50 text-amber-700">Top cliente</Badge>
              )}
            </div>
            <p className="text-sm text-[#9CA3AF] mt-1">
              {fmtCNPJ(client.cnpj)}
              {client.sellers && <span className="ml-3">· {client.sellers.name}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {client.phone && (
              <a
                href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="p-2 rounded-lg text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            )}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F9FAFB] transition-colors">
              <FileText size={14} /> Simular Preço
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#3B5BDB] rounded-lg text-white hover:bg-[#3451C7] transition-colors">
              <ShoppingCart size={14} /> Gerar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="px-6 py-5 flex gap-5 items-start">

        {/* ── Coluna esquerda (2/3) ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Top 10 produtos */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Top 10 Produtos Mais Comprados</h3>
            {topItems.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-6 text-center">Nenhum item encontrado nos pedidos.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    <th className="text-left pb-2 text-xs font-medium text-[#6B7280]">Produto</th>
                    <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Qtd Total</th>
                    <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Pedidos</th>
                    <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Última Compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {topItems.map((item, i) => (
                    <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-[#F3F4F6] text-[10px] font-semibold text-[#6B7280] flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-[#111827] font-medium truncate max-w-60">{item.product_name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-[#374151]">{item.total_qty}</td>
                      <td className="py-2 text-right tabular-nums text-[#374151]">{item.order_count}</td>
                      <td className="py-2 text-right text-[#9CA3AF]">{fmtDate(item.last_purchase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Formulário */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111827]">Informações do Cliente</h3>
              {canEdit && (
                editing ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(false); setForm({ name: client.name, email: client.email ?? '', phone: client.phone ?? '', cnpj: client.cnpj ?? '', status: client.status, origin: client.origin ?? '', notes: client.notes ?? '', seller_id: client.seller_id ?? '' }) }}
                      className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#3B5BDB] transition-colors"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              <div>
                <FieldLabel>Nome da Empresa</FieldLabel>
                {editing ? <TextInput value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} /> : <ReadValue value={client.name} />}
              </div>

              <div>
                <FieldLabel>Vendedor Responsável</FieldLabel>
                {editing ? (
                  <select
                    value={form.seller_id}
                    onChange={e => setForm(p => ({ ...p, seller_id: e.target.value }))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white transition"
                  >
                    <option value="">Selecionar…</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : <ReadValue value={client.sellers?.name} />}
              </div>

              <div>
                <FieldLabel>E-mail</FieldLabel>
                {editing ? <TextInput value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="email@empresa.com" /> : <ReadValue value={client.email} />}
              </div>

              <div>
                <FieldLabel>Telefone / WhatsApp</FieldLabel>
                {editing ? <TextInput value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="(00) 00000-0000" /> : <ReadValue value={client.phone} />}
              </div>

              <div>
                <FieldLabel>CNPJ</FieldLabel>
                {editing ? <TextInput value={form.cnpj} onChange={v => setForm(p => ({ ...p, cnpj: v }))} placeholder="00.000.000/0001-00" /> : <ReadValue value={fmtCNPJ(client.cnpj)} />}
              </div>

              <div>
                <FieldLabel>Status</FieldLabel>
                {editing ? (
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as 'active' | 'inactive' }))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white transition"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                ) : <ReadValue value={client.status === 'active' ? 'Ativo' : 'Inativo'} />}
              </div>

              <div>
                <FieldLabel>Classificação</FieldLabel>
                <div className="mt-0.5">
                  <Badge cls={`${cls.bg} ${cls.text}`}>{cls.label}</Badge>
                </div>
              </div>

              <div>
                <FieldLabel>Origem</FieldLabel>
                {editing ? <TextInput value={form.origin} onChange={v => setForm(p => ({ ...p, origin: v }))} placeholder="Ex: Indicação, Google…" /> : <ReadValue value={client.origin} />}
              </div>

              <div className="col-span-2">
                <FieldLabel>Observações</FieldLabel>
                {editing ? (
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="Anotações sobre o cliente…"
                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition resize-none"
                  />
                ) : <ReadValue value={client.notes} />}
              </div>

            </div>

            {/* Botão Salvar */}
            {editing && (
              <div className="mt-5 pt-4 border-t border-[#F3F4F6] flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors"
                >
                  <Save size={14} /> {saving ? 'Salvando…' : 'Salvar Cliente'}
                </button>
              </div>
            )}
          </Card>

          {/* Compradores */}
          <Card>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setBuyersOpen(p => !p)}
            >
              <h3 className="text-sm font-semibold text-[#111827]">Compradores ({buyers.length})</h3>
              {buyersOpen ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
            </button>

            {buyersOpen && (
              <div className="mt-3 space-y-3">
                {buyers.length === 0 && (
                  <p className="text-sm text-[#9CA3AF] text-center py-2">Nenhum comprador cadastrado.</p>
                )}

                {buyers.map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center text-xs font-semibold shrink-0 select-none">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827]">{b.name}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {[b.role, b.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {b.phone && (
                        <>
                          <a href={`tel:${b.phone}`} className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                            <Phone size={13} />
                          </a>
                          <a href={`https://wa.me/55${b.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                             className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <MessageCircle size={13} />
                          </a>
                        </>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteBuyer(b.id)}
                          className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remover"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {canEdit && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newBuyerName}
                      onChange={e => setNewBuyerName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddBuyer()}
                      placeholder="Nome do comprador…"
                      className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
                    />
                    <button
                      onClick={handleAddBuyer}
                      disabled={!newBuyerName.trim() || addingBuyer}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#3B5BDB] border border-[#C7D2FE] rounded-lg hover:bg-[#EEF2FF] disabled:opacity-40 transition-colors"
                    >
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

        </div>

        {/* ── Coluna direita (1/3) ────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* KPI cards */}
          <KpiCard
            label="Faturamento Total"
            value={fmt(totalRevenue)}
            sub={`${orders.length} pedido${orders.length !== 1 ? 's' : ''}`}
            icon={ShoppingCart} iconBg="bg-[#EEF2FF]" iconCls="text-[#3B5BDB]"
          />
          <KpiCard
            label="Nº de Pedidos"
            value={String(orders.length)}
            sub={`Desde ${fmtDate(client.created_at)}`}
            icon={Package} iconBg="bg-slate-50" iconCls="text-slate-500"
          />
          <KpiCard
            label="Dias sem comprar"
            value={daysSinceOrder !== null ? String(daysSinceOrder) : '—'}
            sub={lastOrderDate ? `Último: ${fmtDate(lastOrderDate)}` : 'Sem pedidos'}
            icon={daysSinceOrder !== null && daysSinceOrder > 60 ? AlertTriangle : Clock}
            iconBg={daysSinceOrder !== null && daysSinceOrder > 60 ? 'bg-red-50' : 'bg-amber-50'}
            iconCls={daysSinceOrder !== null && daysSinceOrder > 60 ? 'text-red-500' : 'text-amber-500'}
          />
          <KpiCard
            label="Prazo Médio Tíquete"
            value={avgTkt !== null ? fmt(avgTkt) : '—'}
            sub="por pedido"
            icon={Calendar} iconBg="bg-emerald-50" iconCls="text-emerald-600"
          />

          {/* Pedidos recentes */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Pedidos Recentes</h3>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-3">Sem pedidos.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {recentOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">
                        {o.number ? `#${o.number}` : 'S/N'}
                      </p>
                      <p className="text-xs text-[#9CA3AF]">{fmtDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#111827] tabular-nums">{fmt(o.total)}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280] capitalize">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Tarefas pendentes */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Tarefas ({tasks.length})</h3>
              <button className="flex items-center gap-1 text-xs font-medium text-[#3B5BDB] hover:text-[#3451C7] transition-colors">
                <Plus size={12} /> Nova Tarefa
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-sm text-[#9CA3AF]">
                <CheckSquare size={14} />
                <span>Sem tarefas pendentes</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map(t => {
                  const p = t.priority ? PRIORITY_CFG[t.priority] : PRIORITY_CFG.low
                  const overdue = t.due_date ? (daysSince(t.due_date) ?? 0) > 0 : false
                  return (
                    <div key={t.id} className="flex items-start gap-2">
                      <CheckSquare size={13} className="text-[#9CA3AF] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#374151] leading-tight">{t.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.bg} ${p.text}`}>
                            {p.label}
                          </span>
                          {t.due_date && (
                            <span className={`text-[10px] ${overdue ? 'text-red-500' : 'text-[#9CA3AF]'}`}>
                              {overdue ? 'Vencida · ' : ''}{fmtDate(t.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Info rápida */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Info Rápida</h3>
            <div className="space-y-2 text-sm">
              {[
                { icon: ShoppingCart, value: `${orders.length} pedido${orders.length !== 1 ? 's' : ''}` },
                { icon: Clock,        value: `${pluralDays(daysSinceOrder)}` },
                { icon: Calendar,     value: `Cliente desde ${fmtDate(client.created_at)}` },
              ].map(({ icon: Icon, value }, i) => (
                <div key={i} className="flex items-center gap-2 text-[#374151]">
                  <Icon size={13} className="text-[#9CA3AF] shrink-0" />
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
