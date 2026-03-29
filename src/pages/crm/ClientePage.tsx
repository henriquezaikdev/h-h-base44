import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, ChevronUp, Edit2, Save, X,
  Phone, MessageCircle, ShoppingCart, Clock,
  Calendar, CheckSquare, Plus, FileText, AlertTriangle, Package, MapPin,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { toTitleCase, fetchCodigoIbge } from '../../lib'
import { ClientAIChat } from '../../components/client/ClientAIChat'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientStatus = 'active' | 'inactive' | 'reorder' | 'delayed' | 'at_risk'

interface Client {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  status: ClientStatus
  classification: string | null
  ranking_tier: string | null
  seller_id: string | null
  origem: string | null
  city: string | null
  state: string | null
  notes: string | null
  ie: string | null
  zip_code: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  neighborhood: string | null
  birthday_day: number | null
  birthday_month: number | null
  unit_type: string | null
  payment_term: string | null
  codigo_ibge: string | null
  total_revenue: number | null
  total_orders: number | null
  last_order_at: string | null
  last_contact_at: string | null
  created_at: string
  sellers: { name: string } | null
}

interface Order {
  id: string
  order_number: string | null
  order_date: string | null
  total: number
  status: string
  created_at: string
}

interface OrderItemRaw {
  product_id: string
  order_id: string
  qty: number
  unit_price: number
  products: { name: string; sku: string | null } | null
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
  priority: string | null
  status: string
  assigned_to: string | null
}

interface Buyer {
  id: string
  name: string
  email: string | null
  whatsapp: string | null
}

interface Interaction {
  id: string
  interaction_type: string | null
  notes: string | null
  contact_reason: string | null
  interaction_date: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
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
function fmtBirthday(day: number | null, month: number | null): string {
  if (!day || !month) return '—'
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

function buildTopItems(items: OrderItemRaw[], allOrders: Order[]): TopItem[] {
  const orderDateMap = new Map(allOrders.map(o => [o.id, o.order_date ?? o.created_at]))
  const map = new Map<string, { name: string; qty: number; orderIds: Set<string>; lastDate: string }>()
  for (const item of items) {
    const key = item.product_id
    const name = item.products?.name ?? 'Sem nome'
    const date = orderDateMap.get(item.order_id) ?? ''
    const existing = map.get(key)
    if (existing) {
      existing.qty += item.qty
      existing.orderIds.add(item.order_id)
      if (date > existing.lastDate) existing.lastDate = date
    } else {
      map.set(key, { name, qty: item.qty, orderIds: new Set([item.order_id]), lastDate: date })
    }
  }
  return [...map.values()]
    .map(v => ({ product_name: v.name, total_qty: v.qty, order_count: v.orderIds.size, last_purchase: v.lastDate }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 10)
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; text: string; bg: string }> = {
  active:   { label: 'Ativo',      text: 'text-emerald-700', bg: 'bg-emerald-50' },
  inactive: { label: 'Inativo',    text: 'text-gray-500',    bg: 'bg-gray-100'   },
  reorder:  { label: 'Recompra',   text: 'text-[#3B5BDB]',  bg: 'bg-[#EEF2FF]'  },
  delayed:  { label: 'Atrasado',   text: 'text-amber-700',   bg: 'bg-amber-50'   },
  at_risk:  { label: 'Em Risco',   text: 'text-red-700',     bg: 'bg-red-50'     },
}

const ORIGEM_DISPLAY: Record<string, string> = {
  prospeccao: 'Prospecção',
  ligacao: 'Prospecção',
  google: 'Google',
  indicacao: 'Indicação',
  filial: 'Filial',
  porta_loja: 'Veio à loja',
  conta_azul: 'Conta Azul',
  conquistado: 'Conquistado',
  outro: 'Outro',
}

const PRIORITY_CFG: Record<string, { label: string; text: string; bg: string }> = {
  high:   { label: 'Alta',  text: 'text-red-600',   bg: 'bg-red-50'   },
  medium: { label: 'Média', text: 'text-amber-600', bg: 'bg-amber-50' },
  low:    { label: 'Baixa', text: 'text-slate-500', bg: 'bg-slate-50' },
}

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

// ─── Micro-components ─────────────────────────────────────────────────────────

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
}

function ClientOriginBadges({ client }: { client: Client }) {
  const badges: { label: string; bg: string; text: string }[] = []
  const createdDaysAgo = daysSince(client.created_at)
  const isNew = createdDaysAgo !== null && createdDaysAgo <= 30

  if (client.origem === 'filial') {
    badges.push({ label: 'Filial', bg: 'bg-purple-50', text: 'text-purple-700' })
  } else if (isNew) {
    if (client.origem === 'indicacao') {
      badges.push({ label: 'Novo · Indicação', bg: 'bg-emerald-50', text: 'text-emerald-700' })
    } else if (client.origem === 'google') {
      badges.push({ label: 'Novo · Google', bg: 'bg-slate-100', text: 'text-slate-600' })
    } else if (client.origem && ['ligacao', 'prospeccao', 'porta_loja', 'conquistado'].includes(client.origem)) {
      badges.push({ label: 'Novo · Prospecção', bg: 'bg-[#EEF2FF]', text: 'text-[#3B5BDB]' })
    } else {
      badges.push({ label: 'Novo', bg: 'bg-[#EEF2FF]', text: 'text-[#3B5BDB]' })
    }
  }

  if (client.status === 'inactive') {
    badges.push({ label: 'Inativo', bg: 'bg-red-50', text: 'text-red-600' })
  }

  // reativado_em may not exist yet — safe access
  const reativadoEm = (client as unknown as Record<string, unknown>).reativado_em as string | null | undefined
  if (reativadoEm && client.status === 'active') {
    badges.push({ label: 'Reativado', bg: 'bg-amber-50', text: 'text-amber-700' })
  }

  if (badges.length === 0) return null
  return (
    <>
      {badges.map((b, i) => (
        <span key={i} className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${b.bg} ${b.text}`}>
          {b.label}
        </span>
      ))}
    </>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-[#E5E7EB] rounded-xl p-4 ${className}`}>{children}</div>
}

function MetricCard({ label, value, sub, icon: Icon, iconBg, iconCls }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; iconBg: string; iconCls: string
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
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
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#6B7280] mb-1">{children}</label>
}

function ReadValue({ value }: { value: string | null | undefined }) {
  return <p className="text-sm text-[#111827] min-h-[20px] truncate" title={value ?? undefined}>{value || '—'}</p>
}

function TextInput({ value, onChange, placeholder, onBlur }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onBlur?: () => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
    />
  )
}

function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-[#F3F4F6]">
      <Icon size={13} className="text-[#9CA3AF]" />
      <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{children}</span>
    </div>
  )
}

const SELECT_CLS = "w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white transition"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, seller } = useAuth()
  const companyId = seller?.company_id ?? ''

  const canEdit = role ? ['owner', 'admin', 'manager', 'seller'].includes(role) : false

  // ── Queries via useSupabaseQuery ──────────────────────────────────────────

  const { data: client, loading: clientLoading, error: clientError, refetch: refetchClient } = useSupabaseQuery<Client>(
    ({ company_id }) =>
      supabase
        .from('clients')
        .select('*, sellers(name)')
        .eq('company_id', company_id)
        .eq('id', id!)
        .single(),
    [id],
  )

  const { data: orders } = useSupabaseQuery<Order[]>(
    ({ company_id }) =>
      supabase
        .from('orders')
        .select('id, order_number, order_date, total, status, created_at')
        .eq('company_id', company_id)
        .eq('client_id', id!)
        .order('created_at', { ascending: false }),
    [id],
  )

  const orderIds = (orders ?? []).slice(0, 50).map(o => o.id)
  const { data: orderItemsRaw } = useSupabaseQuery<OrderItemRaw[]>(
    (_ctx) => {
      if (orderIds.length === 0) return Promise.resolve({ data: [] as OrderItemRaw[], error: null })
      return supabase
        .from('order_items')
        .select('product_id, order_id, qty, unit_price, products(name, sku)')
        .in('order_id', orderIds) as any
    },
    [id, orders],
  )

  const { data: tasks, refetch: refetchTasks } = useSupabaseQuery<Task[]>(
    ({ company_id }) =>
      supabase
        .from('tasks')
        .select('id, title, due_date, priority, status, assigned_to')
        .eq('company_id', company_id)
        .eq('client_id', id!)
        .not('status', 'in', '(done,cancelled,completed)')
        .order('due_date', { ascending: true, nullsFirst: false }),
    [id],
  )

  const { data: buyers, refetch: refetchBuyers } = useSupabaseQuery<Buyer[]>(
    (_ctx) =>
      supabase
        .from('buyers')
        .select('id, name, email, whatsapp')
        .eq('client_id', id!)
        // buyers may not have company_id — filter via client_id (RLS on clients)
        .order('name') as any,
    [id],
  )

  const { data: interactions } = useSupabaseQuery<Interaction[]>(
    ({ company_id }) =>
      supabase
        .from('interactions')
        .select('*')
        .eq('company_id', company_id)
        .eq('client_id', id!)
        .order('created_at', { ascending: false })
        .limit(30),
    [id],
  )

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

  // ── UI state ──────────────────────────────────────────────────────────────

  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [cnpjLoading,   setCnpjLoading]   = useState(false)
  const [cepLoading,    setCepLoading]    = useState(false)
  const [buyersOpen,    setBuyersOpen]    = useState(true)
  const [newBuyerName,  setNewBuyerName]  = useState('')
  const [addingBuyer,   setAddingBuyer]   = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [newTask,       setNewTask]       = useState({ title: '', priority: 'medium', due_date: '' })
  const [savingTask,    setSavingTask]    = useState(false)

  const EMPTY_FORM = {
    name: '', email: '', phone: '', cnpj: '',
    status: 'active' as ClientStatus,
    classification: '',
    origem: '', notes: '', seller_id: '',
    city: '', state: '',
    ie: '', zip_code: '', street: '', street_number: '', complement: '', neighborhood: '',
    birthday_day: '', birthday_month: '',
    unit_type: '', payment_term: '',
    codigo_ibge: '',
  }

  const [form, setForm] = useState(EMPTY_FORM)

  // Sync form with client data when client loads or editing starts
  const populateForm = useCallback((c: Client) => {
    setForm({
      name:           c.name,
      email:          c.email          ?? '',
      phone:          c.phone          ?? '',
      cnpj:           c.cnpj           ?? '',
      status:         c.status,
      classification: c.classification ?? '',
      origem:         c.origem         ?? '',
      city:           c.city           ?? '',
      state:          c.state          ?? '',
      notes:          c.notes          ?? '',
      seller_id:      c.seller_id      ?? '',
      ie:             c.ie             ?? '',
      zip_code:       c.zip_code       ?? '',
      street:         c.street         ?? '',
      street_number:  c.street_number  ?? '',
      complement:     c.complement     ?? '',
      neighborhood:   c.neighborhood   ?? '',
      birthday_day:   c.birthday_day   != null ? String(c.birthday_day)   : '',
      birthday_month: c.birthday_month != null ? String(c.birthday_month) : '',
      unit_type:      c.unit_type      ?? '',
      payment_term:   c.payment_term   ?? '',
      codigo_ibge:    c.codigo_ibge    ?? '',
    })
  }, [])

  // Populate form when client loads for the first time
  const formInitialized = useState(false)
  if (client && !formInitialized[0]) {
    populateForm(client)
    formInitialized[1](true)
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const safeOrders     = orders ?? []
  const safeTasks      = tasks ?? []
  const safeBuyers     = buyers ?? []
  const safeInteractions = interactions ?? []
  const safeSellers    = sellersList ?? []

  const sortedOrders   = useMemo(() => [...safeOrders].sort((a, b) => (b.order_date ?? b.created_at).localeCompare(a.order_date ?? a.created_at)), [safeOrders])
  const recentOrders   = sortedOrders.slice(0, 5)
  const totalRevenue   = client?.total_revenue ?? safeOrders.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalOrderCount = client?.total_orders ?? safeOrders.length
  const lastOrderAt    = client?.last_order_at ?? sortedOrders[0]?.order_date ?? sortedOrders[0]?.created_at ?? null
  const daysSinceOrder = daysSince(lastOrderAt)
  const avgTkt         = totalOrderCount > 0 ? totalRevenue / totalOrderCount : null
  const topItems       = useMemo(() => buildTopItems(orderItemsRaw ?? [], safeOrders), [orderItemsRaw, safeOrders])

  const statusCfg = STATUS_CFG[client?.status ?? 'active'] ?? STATUS_CFG.active

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setSaveError(null)
    const safetyTimer = setTimeout(() => setSaving(false), 10000)
    try {
      const { error: err } = await supabase
        .from('clients')
        .update({
          name:           form.name,
          email:          form.email          || null,
          phone:          form.phone          || null,
          cnpj:           form.cnpj           || null,
          status:         form.status,
          classification: form.classification || null,
          origem:         form.origem         || null,
          city:           form.city           ? toTitleCase(form.city) : null,
          state:          form.state          || null,
          notes:          form.notes          || null,
          seller_id:      form.seller_id      || null,
          ie:             form.ie             || null,
          zip_code:       form.zip_code       || null,
          street:         form.street         || null,
          street_number:  form.street_number  || null,
          complement:     form.complement     || null,
          neighborhood:   form.neighborhood   || null,
          birthday_day:   form.birthday_day   ? parseInt(form.birthday_day)   : null,
          birthday_month: form.birthday_month ? parseInt(form.birthday_month) : null,
          unit_type:      form.unit_type      || null,
          payment_term:   form.payment_term   || null,
          codigo_ibge:    form.codigo_ibge    || null,
        })
        .eq('id', id)

      if (err) {
        console.error('[ClientePage] save error:', err)
        setSaveError(err.message)
      } else {
        setEditing(false)
        refetchClient()
      }
    } catch (e) {
      console.error('[ClientePage] save exception:', e)
      setSaveError('Erro ao salvar. Tente novamente.')
    } finally {
      clearTimeout(safetyTimer)
      setSaving(false)
    }
  }

  // ── CNPJ auto-fill (BrasilAPI) ────────────────────────────────────────────

  async function handleCnpjBlur() {
    const digits = form.cnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    setCnpjLoading(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) return
      const d = await res.json()
      const city  = d.municipio ? toTitleCase(d.municipio) : ''
      const state = (d.uf as string | undefined) || ''
      setForm(p => ({
        ...p,
        name:          d.razao_social        || p.name,
        ie:            d.inscricao_estadual  || p.ie,
        zip_code:      d.cep ? d.cep.replace(/\D/g, '') : p.zip_code,
        street:        d.logradouro          || p.street,
        street_number: d.numero              || p.street_number,
        neighborhood:  d.bairro              || p.neighborhood,
        city:          city                  || p.city,
        state:         state                 || p.state,
      }))
      if (city && state) {
        const ibge = await fetchCodigoIbge(city, state)
        if (ibge) setForm(p => ({ ...p, codigo_ibge: ibge }))
      }
    } catch { /* ignore */ } finally { setCnpjLoading(false) }
  }

  // ── CEP auto-fill (ViaCEP) ────────────────────────────────────────────────

  async function handleCepBlur() {
    const digits = form.zip_code.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return
      const d = await res.json()
      if (d.erro) return
      setForm(p => ({
        ...p,
        street:       d.logradouro || p.street,
        neighborhood: d.bairro     || p.neighborhood,
        city:         d.localidade || p.city,
        state:        d.uf         || p.state,
      }))
    } catch { /* ignore */ } finally { setCepLoading(false) }
  }

  // ── Add buyer ─────────────────────────────────────────────────────────────

  async function handleAddBuyer() {
    if (!newBuyerName.trim() || !id) return
    setAddingBuyer(true)
    const { error: err } = await supabase
      .from('buyers')
      .insert({ client_id: id, name: newBuyerName.trim() })

    if (!err) {
      setNewBuyerName('')
      refetchBuyers()
    }
    setAddingBuyer(false)
  }

  async function handleDeleteBuyer(buyerId: string) {
    await supabase.from('buyers').delete().eq('id', buyerId)
    refetchBuyers()
  }

  // ── Add task ──────────────────────────────────────────────────────────────

  async function handleAddTask() {
    if (!newTask.title.trim() || !id || !seller) return
    setSavingTask(true)
    const { error: err } = await supabase.from('tasks').insert({
      title:      newTask.title.trim(),
      priority:   newTask.priority,
      due_date:   newTask.due_date || null,
      client_id:  id,
      assigned_to: seller.id,
      status:     'open',
      company_id: seller.company_id,
    })
    if (!err) {
      setNewTask({ title: '', priority: 'medium', due_date: '' })
      setTaskModalOpen(false)
      refetchTasks()
    }
    setSavingTask(false)
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <span className="text-sm text-[#9CA3AF]">Carregando ficha…</span>
      </div>
    )
  }

  if (clientError || !client) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">{clientError ?? 'Cliente não encontrado.'}</p>
          <button onClick={() => navigate('/clientes')} className="text-sm text-[#3B5BDB] hover:underline">
            ← Voltar para listagem
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
              <Badge cls={`${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</Badge>
              <ClientOriginBadges client={client} />
              {client.classification && (
                <Badge cls="bg-[#EEF2FF] text-[#3B5BDB]">{client.classification}</Badge>
              )}
              {(client.total_orders ?? 0) >= 10 && (
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
                    <th className="text-right pb-2 pl-4 text-xs font-medium text-[#6B7280] w-20">Qtd Total</th>
                    <th className="text-right pb-2 pl-4 text-xs font-medium text-[#6B7280] w-16">Pedidos</th>
                    <th className="text-right pb-2 pl-4 text-xs font-medium text-[#6B7280] w-24 whitespace-nowrap">Última Compra</th>
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
                      <td className="py-2 pl-4 text-right tabular-nums text-[#374151]">{item.total_qty}</td>
                      <td className="py-2 pl-4 text-right tabular-nums text-[#374151]">{item.order_count}</td>
                      <td className="py-2 pl-4 text-right text-[#9CA3AF] whitespace-nowrap">{fmtDate(item.last_purchase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Métricas em linha */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              label="Faturamento Total"
              value={fmt(totalRevenue)}
              sub={`${totalOrderCount} pedido${totalOrderCount !== 1 ? 's' : ''}`}
              icon={ShoppingCart} iconBg="bg-[#EEF2FF]" iconCls="text-[#3B5BDB]"
            />
            <MetricCard
              label="Nº de Pedidos"
              value={String(totalOrderCount)}
              sub={`Desde ${fmtDate(client.created_at)}`}
              icon={Package} iconBg="bg-slate-50" iconCls="text-slate-500"
            />
            <MetricCard
              label="Dias sem comprar"
              value={daysSinceOrder !== null ? String(daysSinceOrder) : '—'}
              sub={lastOrderAt ? `Último: ${fmtDate(lastOrderAt)}` : 'Sem pedidos'}
              icon={daysSinceOrder !== null && daysSinceOrder > 60 ? AlertTriangle : Clock}
              iconBg={daysSinceOrder !== null && daysSinceOrder > 60 ? 'bg-red-50' : 'bg-amber-50'}
              iconCls={daysSinceOrder !== null && daysSinceOrder > 60 ? 'text-red-500' : 'text-amber-500'}
            />
            <MetricCard
              label="Ticket Médio"
              value={avgTkt !== null ? fmt(avgTkt) : '—'}
              sub="por pedido"
              icon={Calendar} iconBg="bg-emerald-50" iconCls="text-emerald-600"
            />
          </div>

          {/* Formulário - Informações do Cliente */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111827]">Informações do Cliente</h3>
              {canEdit && (
                editing ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(false); if (client) populateForm(client) }}
                      className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { if (client) populateForm(client); setEditing(true) }}
                    className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#3B5BDB] transition-colors"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                )
              )}
            </div>

            <div className="space-y-6">

              {/* Dados Principais */}
              <div>
                <SectionHeading icon={FileText}>Dados Principais</SectionHeading>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                  <div>
                    <FieldLabel>Nome da Empresa</FieldLabel>
                    {editing
                      ? <TextInput value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
                      : <ReadValue value={client.name} />}
                  </div>

                  <div>
                    <FieldLabel>Vendedor Responsável</FieldLabel>
                    {editing ? (
                      <select
                        value={form.seller_id}
                        onChange={e => setForm(p => ({ ...p, seller_id: e.target.value }))}
                        className={SELECT_CLS}
                      >
                        <option value="">Selecionar…</option>
                        {safeSellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : <ReadValue value={client.sellers?.name} />}
                  </div>

                  <div>
                    <FieldLabel>E-mail</FieldLabel>
                    {editing
                      ? <TextInput value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="email@empresa.com" />
                      : <ReadValue value={client.email} />}
                  </div>

                  <div>
                    <FieldLabel>Telefone / WhatsApp</FieldLabel>
                    {editing
                      ? <TextInput value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="(00) 00000-0000" />
                      : <ReadValue value={client.phone} />}
                  </div>

                  <div>
                    <FieldLabel>CNPJ</FieldLabel>
                    {editing ? (
                      <div className="relative">
                        <TextInput
                          value={form.cnpj}
                          onChange={v => setForm(p => ({ ...p, cnpj: v }))}
                          onBlur={handleCnpjBlur}
                          placeholder="00.000.000/0001-00"
                        />
                        {cnpjLoading && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#3B5BDB]">buscando…</span>
                        )}
                      </div>
                    ) : <ReadValue value={fmtCNPJ(client.cnpj)} />}
                  </div>

                  <div>
                    <FieldLabel>Inscrição Estadual (IE)</FieldLabel>
                    {editing
                      ? <TextInput value={form.ie} onChange={v => setForm(p => ({ ...p, ie: v }))} placeholder="Isento ou número" />
                      : <ReadValue value={client.ie} />}
                  </div>

                  <div>
                    <FieldLabel>Status</FieldLabel>
                    {editing ? (
                      <select
                        value={form.status}
                        onChange={e => setForm(p => ({ ...p, status: e.target.value as ClientStatus }))}
                        className={SELECT_CLS}
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                        <option value="reorder">Recompra</option>
                        <option value="delayed">Atrasado</option>
                        <option value="at_risk">Em Risco</option>
                      </select>
                    ) : (
                      <div className="mt-0.5">
                        <Badge cls={`${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</Badge>
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Classificação</FieldLabel>
                    {editing ? (
                      <TextInput value={form.classification} onChange={v => setForm(p => ({ ...p, classification: v }))} placeholder="Ex: A, B, C" />
                    ) : <ReadValue value={client.classification} />}
                  </div>

                  <div>
                    <FieldLabel>Origem</FieldLabel>
                    {editing ? (
                      <select
                        value={form.origem}
                        onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}
                        className={SELECT_CLS}
                      >
                        <option value="">Não informado</option>
                        <option value="prospeccao">Prospecção</option>
                        <option value="google">Google</option>
                        <option value="indicacao">Indicação</option>
                        <option value="filial">Filial</option>
                        <option value="porta_loja">Veio à loja</option>
                        <option value="conta_azul">Conta Azul</option>
                        <option value="conquistado">Conquistado</option>
                        <option value="outro">Outro</option>
                      </select>
                    ) : <ReadValue value={ORIGEM_DISPLAY[client.origem ?? ''] ?? client.origem ?? 'Não informado'} />}
                  </div>

                  <div>
                    <FieldLabel>Aniversário do Cliente</FieldLabel>
                    {editing ? (
                      <div className="flex gap-2">
                        <select
                          value={form.birthday_day}
                          onChange={e => setForm(p => ({ ...p, birthday_day: e.target.value }))}
                          className={`flex-1 ${SELECT_CLS}`}
                        >
                          <option value="">Dia</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={String(d)}>{String(d).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <select
                          value={form.birthday_month}
                          onChange={e => setForm(p => ({ ...p, birthday_month: e.target.value }))}
                          className={`flex-1 ${SELECT_CLS}`}
                        >
                          <option value="">Mês</option>
                          {MONTHS.map((m, i) => (
                            <option key={i + 1} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                      </div>
                    ) : <ReadValue value={fmtBirthday(client.birthday_day, client.birthday_month)} />}
                  </div>

                  <div>
                    <FieldLabel>Tipo de Unidade</FieldLabel>
                    {editing ? (
                      <select
                        value={form.unit_type}
                        onChange={e => setForm(p => ({ ...p, unit_type: e.target.value }))}
                        className={SELECT_CLS}
                      >
                        <option value="">Selecionar…</option>
                        <option value="Matriz">Matriz</option>
                        <option value="Filial">Filial</option>
                      </select>
                    ) : <ReadValue value={client.unit_type} />}
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
              </div>

              {/* Endereço */}
              <div>
                <SectionHeading icon={MapPin}>Endereço</SectionHeading>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                  <div>
                    <FieldLabel>CEP</FieldLabel>
                    {editing ? (
                      <div className="relative">
                        <TextInput
                          value={form.zip_code}
                          onChange={v => setForm(p => ({ ...p, zip_code: v }))}
                          onBlur={handleCepBlur}
                          placeholder="00000-000"
                        />
                        {cepLoading && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#3B5BDB]">buscando…</span>
                        )}
                      </div>
                    ) : <ReadValue value={client.zip_code} />}
                  </div>

                  <div />

                  <div className="col-span-2">
                    <FieldLabel>Logradouro</FieldLabel>
                    {editing
                      ? <TextInput value={form.street} onChange={v => setForm(p => ({ ...p, street: v }))} placeholder="Rua, Av., etc." />
                      : <ReadValue value={client.street} />}
                  </div>

                  <div>
                    <FieldLabel>Número</FieldLabel>
                    {editing
                      ? <TextInput value={form.street_number} onChange={v => setForm(p => ({ ...p, street_number: v }))} placeholder="123" />
                      : <ReadValue value={client.street_number} />}
                  </div>

                  <div>
                    <FieldLabel>Complemento</FieldLabel>
                    {editing
                      ? <TextInput value={form.complement} onChange={v => setForm(p => ({ ...p, complement: v }))} placeholder="Sala, Andar, etc." />
                      : <ReadValue value={client.complement} />}
                  </div>

                  <div>
                    <FieldLabel>Bairro</FieldLabel>
                    {editing
                      ? <TextInput value={form.neighborhood} onChange={v => setForm(p => ({ ...p, neighborhood: v }))} placeholder="Bairro" />
                      : <ReadValue value={client.neighborhood} />}
                  </div>

                  <div>
                    <FieldLabel>Cidade</FieldLabel>
                    {editing
                      ? <TextInput value={form.city} onChange={v => setForm(p => ({ ...p, city: v }))} placeholder="Cidade" />
                      : <ReadValue value={client.city} />}
                  </div>

                  <div>
                    <FieldLabel>Estado</FieldLabel>
                    {editing
                      ? <TextInput value={form.state} onChange={v => setForm(p => ({ ...p, state: v }))} placeholder="UF" />
                      : <ReadValue value={client.state} />}
                  </div>

                </div>
              </div>

            </div>

            {/* Botao Salvar */}
            {editing && (
              <div className="mt-5 pt-4 border-t border-[#F3F4F6] flex items-center justify-between">
                {saveError
                  ? <p className="text-xs text-red-600 max-w-sm">{saveError}</p>
                  : <span />
                }
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
              <h3 className="text-sm font-semibold text-[#111827]">Compradores ({safeBuyers.length})</h3>
              {buyersOpen ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
            </button>

            {buyersOpen && (
              <div className="mt-3 space-y-3">
                {safeBuyers.length === 0 && (
                  <p className="text-sm text-[#9CA3AF] text-center py-2">Nenhum comprador cadastrado.</p>
                )}

                {safeBuyers.map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b border-[#F3F4F6] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center text-xs font-semibold shrink-0 select-none">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827]">{b.name}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {[b.whatsapp, b.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {b.whatsapp && (
                        <>
                          <a href={`tel:${b.whatsapp}`} className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                            <Phone size={13} />
                          </a>
                          <a href={`https://wa.me/55${b.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
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

          {/* Histórico de Contatos */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Histórico de Contatos</h3>
            {safeInteractions.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-3">Nenhuma interação registrada.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {safeInteractions.map(i => (
                  <div key={i.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[#9CA3AF]">{fmtDate(i.interaction_date ?? i.created_at)}</span>
                      {i.interaction_type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#3B5BDB] font-medium capitalize">
                          {i.interaction_type}
                        </span>
                      )}
                    </div>
                    {i.contact_reason && (
                      <p className="text-sm font-medium text-[#374151]">{i.contact_reason}</p>
                    )}
                    {i.notes && (
                      <p className="text-sm text-[#6B7280] mt-0.5">{i.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

        {/* ── Coluna direita (1/3) ────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Pedidos recentes */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Pedidos Recentes</h3>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-3">Sem pedidos.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {recentOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <button
                        onClick={() => setSelectedOrderId(o.id)}
                        className="text-sm font-medium text-[#3B5BDB] hover:underline truncate block text-left"
                      >
                        #{o.order_number ?? o.id.substring(0, 8).toUpperCase()}
                      </button>
                      <p className="text-xs text-[#9CA3AF] whitespace-nowrap">{fmtDate(o.order_date ?? o.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
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
              <h3 className="text-sm font-semibold text-[#111827]">Tarefas ({safeTasks.length})</h3>
              <button
                onClick={() => setTaskModalOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-[#3B5BDB] hover:text-[#3451C7] transition-colors"
              >
                <Plus size={12} /> Nova Tarefa
              </button>
            </div>

            {/* Modal nova tarefa */}
            {taskModalOpen && (
              <div className="mb-3 p-3 border border-[#E5E7EB] rounded-lg bg-[#FAFAF9] space-y-3">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  placeholder="Título da tarefa…"
                  autoFocus
                  className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white"
                />
                <div className="flex gap-2">
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] bg-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                    className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] bg-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setTaskModalOpen(false); setNewTask({ title: '', priority: 'medium', due_date: '' }) }}
                    className="text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors px-2 py-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={!newTask.title.trim() || savingTask}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-40 transition-colors"
                  >
                    <Plus size={12} /> {savingTask ? 'Salvando…' : 'Criar'}
                  </button>
                </div>
              </div>
            )}

            {safeTasks.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-sm text-[#9CA3AF]">
                <CheckSquare size={14} />
                <span>Sem tarefas pendentes</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {safeTasks.map(t => {
                  const p = (t.priority ? PRIORITY_CFG[t.priority] : undefined) ?? PRIORITY_CFG.low
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

          {/* Info rapida */}
          <Card>
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Info Rápida</h3>
            <div className="space-y-2 text-sm">
              {[
                { icon: ShoppingCart, value: `${totalOrderCount} pedido${totalOrderCount !== 1 ? 's' : ''}` },
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

        {/* Assistente Comercial IA */}
        {client && (
          <ClientAIChat
            clientId={client.id}
            clientName={client.name}
            companyId={companyId}
          />
        )}

      </div>

      {/* ── Modal Detalhe do Pedido ── */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  )
}

// ─── Order Detail Modal ──────────────────────────────────────────────────────

interface ModalOrderDetail {
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
  due_dates: { date: string; amount: number }[] | null
  seller_id: string | null
  seller_name: string | null
  nfe_status: string | null
  nfe_key: string | null
  created_at: string
}

interface ModalOrderItem {
  id: string
  product_id: string | null
  qty: number
  unit_price: number
  discount: number
  total: number
  cost_at_sale: number | null
  products: { name: string; sku: string | null } | null
}

function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder]   = useState<ModalOrderDetail | null>(null)
  const [items, setItems]   = useState<ModalOrderItem[]>([])
  const [seller, setSeller] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)

      const { data: o, error: oErr } = await supabase
        .from('orders')
        .select('id, order_number, order_date, status, subtotal, discount, total, notes, payment_method, payment_term, due_dates, seller_id, seller_name, nfe_status, nfe_key, created_at')
        .eq('id', orderId)
        .single()

      if (cancelled) return
      if (oErr || !o) { setError(oErr?.message ?? 'Pedido não encontrado'); setLoading(false); return }

      const { data: oi } = await supabase
        .from('order_items')
        .select('id, product_id, qty, unit_price, discount, total, cost_at_sale, products(name, sku)')
        .eq('order_id', orderId)

      if (cancelled) return

      // seller name
      if (o.seller_id) {
        const { data: s } = await supabase
          .from('sellers')
          .select('name')
          .eq('id', o.seller_id)
          .single()
        if (!cancelled && s) setSeller(s.name)
      }

      setOrder(o as ModalOrderDetail)
      setItems((oi as ModalOrderItem[] | null) ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orderId])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusLabels: Record<string, string> = {
    pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado',
    invoiced: 'Faturado', delivered: 'Entregue', cancelled: 'Cancelado', picked: 'Separado',
  }
  const statusCls: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700', approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600', invoiced: 'bg-blue-50 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-neutral-100 text-neutral-500',
    picked: 'bg-indigo-50 text-indigo-700',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            {order && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#111827]">
                    Pedido #{order.order_number ?? order.id.substring(0, 8).toUpperCase()}
                  </h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCls[order.status] ?? 'bg-neutral-100 text-neutral-500'}`}>
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  {fmtDate(order.order_date ?? order.created_at)}
                  {seller && <span> · {seller}</span>}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#9CA3AF] hover:text-[#374151]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {loading && <p className="text-sm text-[#9CA3AF] text-center py-8">Carregando…</p>}
          {error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}

          {order && !loading && (
            <>
              {/* Itens */}
              <div>
                <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Itens</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F4F6]">
                      <th className="text-left pb-2 text-xs font-medium text-[#6B7280]">Produto</th>
                      <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Qtd</th>
                      <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Preço Unit.</th>
                      <th className="text-right pb-2 text-xs font-medium text-[#6B7280]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9FAFB]">
                    {items.map(it => (
                      <tr key={it.id}>
                        <td className="py-2 pr-3">
                          <span className="text-[#111827] font-medium">{it.products?.name ?? '—'}</span>
                          {it.products?.sku && <span className="text-xs text-[#9CA3AF] ml-1.5">{it.products.sku}</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#374151]">{it.qty}</td>
                        <td className="py-2 text-right tabular-nums text-[#374151]">{fmt(it.unit_price)}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-[#111827]">{fmt(it.qty * it.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totais */}
              <div className="bg-[#FAFAF9] rounded-lg p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Subtotal</span>
                  <span className="font-medium text-[#111827] tabular-nums">{fmt(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Desconto</span>
                    <span className="font-medium text-red-600 tabular-nums">- {fmt(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-[#E5E7EB]">
                  <span className="font-semibold text-[#111827]">Total</span>
                  <span className="font-bold text-[#3B5BDB] tabular-nums">{fmt(order.total)}</span>
                </div>
              </div>

              {/* Pagamento */}
              {(order.payment_method || order.payment_term) && (
                <div>
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Pagamento</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {order.payment_method && (
                      <>
                        <span className="text-[#6B7280]">Forma</span>
                        <span className="text-[#111827] font-medium">{order.payment_method}</span>
                      </>
                    )}
                    {order.payment_term && (
                      <>
                        <span className="text-[#6B7280]">Condição</span>
                        <span className="text-[#111827] font-medium">{order.payment_term}</span>
                      </>
                    )}
                  </div>
                  {/* Parcelas */}
                  {order.due_dates && order.due_dates.length > 0 && (
                    <div className="mt-3 border border-[#F3F4F6] rounded-lg overflow-hidden">
                      {order.due_dates.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-[#F3F4F6] last:border-b-0">
                          <span className="text-xs text-[#6B7280]">
                            Parcela {i + 1}/{order.due_dates!.length} — {fmtDate(p.date)}
                          </span>
                          <span className="text-xs font-medium text-[#111827] tabular-nums">{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              {order.notes && order.notes.trim() !== '' && order.notes !== 'Sem vendedor na API' && (
                <div>
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Observações</h3>
                  <p className="text-sm text-[#374151]">{order.notes}</p>
                </div>
              )}

              {/* Info fiscal */}
              {order.nfe_status && (
                <div>
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Fiscal</h3>
                  <div className="text-sm text-[#374151]">
                    <span className="text-[#6B7280]">NF-e: </span>
                    <span className="font-medium">{order.nfe_status === 'autorizado' ? 'Autorizada' : order.nfe_status}</span>
                    {order.nfe_key && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono truncate">{order.nfe_key}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
