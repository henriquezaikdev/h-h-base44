import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, RefreshCw, Clock, AlertTriangle, XCircle,
  Search, LayoutGrid, List, ChevronRight, ChevronLeft,
  Phone, MessageCircle, ArrowRight, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

type Classification = 'novo' | 'recorrente' | '60dias' | '90dias' | '120dias' | 'inativo'
type ViewMode       = 'table' | 'cards'
type StatusFilter   = 'all' | 'active' | 'inactive'
type KpiKey         = 'all' | Classification

interface RawOrder {
  id: string
  total: number
  created_at: string
}

interface RawClient {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  status: 'active' | 'inactive'
  seller_id: string
  created_at: string
  last_contact_at: string | null
  sellers: { name: string } | null
  orders: RawOrder[]
}

interface ClientRow {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  status: 'active' | 'inactive'
  seller_id: string
  seller_name: string
  last_contact_at: string | null
  classification: Classification
  totalRevenue: number
  orderCount: number
  lastOrderDate: string | null
  daysSinceLastOrder: number | null
  daysSinceContact: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

function classify(orderCount: number, days: number | null): Classification {
  if (orderCount === 0 || days === null) return 'inativo'
  if (days > 120)                        return 'inativo'
  if (days > 90)                         return '120dias'
  if (days > 60)                         return '90dias'
  if (days > 45)                         return '60dias'
  if (orderCount === 1 && days <= 90)    return 'novo'
  return 'recorrente'
}

function toRow(c: RawClient): ClientRow {
  const sorted    = [...(c.orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const lastOrder = sorted[0] ?? null
  const days      = daysSince(lastOrder?.created_at ?? null)
  return {
    id:                 c.id,
    name:               c.name,
    cnpj:               c.cnpj,
    phone:              c.phone,
    status:             c.status,
    seller_id:          c.seller_id,
    seller_name:        c.sellers?.name ?? '—',
    last_contact_at:    c.last_contact_at,
    classification:     classify(c.orders?.length ?? 0, days),
    totalRevenue:       (c.orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0),
    orderCount:         c.orders?.length ?? 0,
    lastOrderDate:      lastOrder?.created_at ?? null,
    daysSinceLastOrder: days,
    daysSinceContact:   daysSince(c.last_contact_at),
  }
}

function formatCNPJ(v: string | null): string {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function pluralDays(n: number | null): string {
  if (n === null) return '—'
  if (n === 0)    return 'hoje'
  if (n === 1)    return '1 dia atrás'
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

const KPI_CFG: { key: KpiKey; label: string; icon: React.ElementType; iconCls: string; iconBg: string }[] = [
  { key: 'all',        label: 'Total',       icon: Users,         iconCls: 'text-slate-500',   iconBg: 'bg-slate-50'   },
  { key: 'novo',       label: 'Novos',       icon: UserPlus,      iconCls: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  { key: 'recorrente', label: 'Recorrentes', icon: TrendingUp,    iconCls: 'text-[#3B5BDB]',  iconBg: 'bg-[#EEF2FF]'  },
  { key: '60dias',     label: '60 dias',     icon: Clock,         iconCls: 'text-amber-600',   iconBg: 'bg-amber-50'   },
  { key: '90dias',     label: '90 dias',     icon: RefreshCw,     iconCls: 'text-orange-600',  iconBg: 'bg-orange-50'  },
  { key: '120dias',    label: '120 dias',    icon: AlertTriangle, iconCls: 'text-red-600',     iconBg: 'bg-red-50'     },
  { key: 'inativo',    label: 'Inativos',    icon: XCircle,       iconCls: 'text-gray-400',    iconBg: 'bg-gray-50'    },
]

const FULL_ACCESS = ['owner', 'admin', 'manager']
const PAGE_SIZE   = 15

// ─── Micro-components ─────────────────────────────────────────────────────────

function ClassBadge({ cls }: { cls: Classification }) {
  const { label, text, bg } = CLASS_CFG[cls]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>{label}</span>
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return status === 'active'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Ativo</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>
}

function HealthDot({ cls }: { cls: Classification }) {
  return <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${CLASS_CFG[cls].dot}`} />
}

function ContactDot({ days }: { days: number | null }) {
  const cls = days === null ? 'bg-gray-300' : days <= 7 ? 'bg-emerald-500' : days <= 30 ? 'bg-amber-400' : 'bg-red-400'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ClientesQueryResult {
  clients: RawClient[]
  sellersList: { id: string; name: string }[]
}

export default function ClientesPage() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const canSeeAll      = role ? FULL_ACCESS.includes(role) : false
  const canSeeVendedor = canSeeAll

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sellerFilter, setSellerFilter] = useState('all')
  const [classFilter,  setClassFilter]  = useState<KpiKey>('all')
  const [viewMode,     setViewMode]     = useState<ViewMode>('table')
  const [page,         setPage]         = useState(1)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const { data, loading, error } = useSupabaseQuery<ClientesQueryResult>(
    async ({ company_id }) => {
      const [clientsRes, sellersRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*, sellers(name), orders(id, total, created_at)')
          .eq('company_id', company_id)
          .order('name'),
        canSeeVendedor
          ? supabase.from('sellers').select('id, name').eq('company_id', company_id).eq('active', true).order('name')
          : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      ])
      if (clientsRes.error) return { data: null, error: clientsRes.error }
      return {
        data: {
          clients:     (clientsRes.data ?? []) as unknown as RawClient[],
          sellersList: (sellersRes.data ?? []) as { id: string; name: string }[],
        },
        error: null,
      }
    },
    [canSeeVendedor],
  )

  const clients     = useMemo(() => (data?.clients     ?? []).map(toRow), [data])
  const sellersList = data?.sellersList ?? []

  useEffect(() => { setPage(1) }, [search, statusFilter, sellerFilter, classFilter])

  // ── Derived ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return clients.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter)                      return false
      if (canSeeVendedor && sellerFilter !== 'all' && c.seller_id !== sellerFilter) return false
      if (classFilter   !== 'all' && c.classification !== classFilter)              return false
      if (q) {
        const digits = (c.cnpj ?? '').replace(/\D/g, '')
        if (!c.name.toLowerCase().includes(q) && !digits.includes(q))              return false
      }
      return true
    })
  }, [clients, search, statusFilter, sellerFilter, classFilter, canSeeVendedor])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const kpi = useMemo(() => {
    const counts: Record<KpiKey, number> = {
      all: clients.length, novo: 0, recorrente: 0,
      '60dias': 0, '90dias': 0, '120dias': 0, inativo: 0,
    }
    for (const c of clients) counts[c.classification]++
    return counts
  }, [clients])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Carteira de Clientes</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {loading ? 'Carregando…' : `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('table')}
            title="Tabela"
            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'text-[#9CA3AF] hover:bg-[#F9FAFB]'}`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            title="Cards"
            className={`p-2 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'text-[#9CA3AF] hover:bg-[#F9FAFB]'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-7 gap-3">
          {KPI_CFG.map(({ key, label, icon: Icon, iconCls, iconBg }) => {
            const active = classFilter === key
            return (
              <button
                key={key}
                onClick={() => setClassFilter(active ? 'all' : key)}
                className={`bg-white border rounded-xl p-3 text-left transition-all hover:shadow-[0_1px_4px_0_rgb(0,0,0,0.08)] ${
                  active ? 'border-[#3B5BDB] ring-1 ring-[#3B5BDB]/20' : 'border-[#E5E7EB]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
                  <Icon size={15} className={iconCls} />
                </div>
                <p className="text-xl font-semibold text-[#111827] leading-none tabular-nums">
                  {loading ? '—' : kpi[key]}
                </p>
                <p className="text-xs text-[#6B7280] mt-1 leading-tight">{label}</p>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="sticky top-0 z-10 bg-[#FAFAF9] py-1">
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>

            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value as KpiKey)}
              className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
            >
              <option value="all">Todas as classificações</option>
              <option value="novo">Novo</option>
              <option value="recorrente">Recorrente</option>
              <option value="60dias">60 dias</option>
              <option value="90dias">90 dias</option>
              <option value="120dias">120 dias</option>
              <option value="inativo">Inativo</option>
            </select>

            {canSeeVendedor && (
              <select
                value={sellerFilter}
                onChange={e => setSellerFilter(e.target.value)}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition"
              >
                <option value="all">Todos os vendedores</option>
                {sellersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            <span className="text-xs text-[#9CA3AF] ml-auto whitespace-nowrap">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 flex items-center justify-center">
            <span className="text-sm text-[#9CA3AF]">Carregando clientes…</span>
          </div>
        )}

        {/* ── Tabela ──────────────────────────────────────────────────────── */}
        {!loading && viewMode === 'table' && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Classificação</th>
                    {canSeeAll && <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Vendedor</th>}
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Faturamento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Último Pedido</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Último Contato</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={canSeeAll ? 8 : 7} className="px-4 py-16 text-center text-sm text-[#9CA3AF]">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : paginated.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/clientes/${c.id}`)}
                      className="hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <HealthDot cls={c.classification} />
                          <div className="min-w-0">
                            <p className="font-medium text-[#111827] truncate max-w-52">{c.name}</p>
                            <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">{formatCNPJ(c.cnpj)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3"><ClassBadge cls={c.classification} /></td>
                      {canSeeAll && <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{c.seller_name}</td>}
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-[#111827] tabular-nums">{formatCurrency(c.totalRevenue)}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{c.orderCount} pedido{c.orderCount !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[#374151]">{formatDate(c.lastOrderDate)}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{pluralDays(c.daysSinceLastOrder)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ContactDot days={c.daysSinceContact} />
                          <div>
                            <p className="text-[#374151] whitespace-nowrap">{formatDate(c.last_contact_at)}</p>
                            <p className="text-xs text-[#9CA3AF] mt-0.5">{pluralDays(c.daysSinceContact)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {c.phone && (
                            <>
                              <a href={`tel:${c.phone}`} title="Ligar"
                                 className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                                <Phone size={14} />
                              </a>
                              <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`}
                                 target="_blank" rel="noreferrer" title="WhatsApp"
                                 className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <MessageCircle size={14} />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/clientes/${c.id}`)}
                            title="Ver ficha"
                            className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[#6B7280]">
                  Página {page} de {totalPages} · {filtered.length} clientes
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </div>
        )}

        {/* ── Cards ───────────────────────────────────────────────────────── */}
        {!loading && viewMode === 'cards' && (
          <>
            {paginated.length === 0 ? (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 text-center text-sm text-[#9CA3AF]">
                Nenhum cliente encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {paginated.map(c => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className="bg-white border border-[#E5E7EB] rounded-xl p-4 cursor-pointer hover:shadow-[0_1px_4px_0_rgb(0,0,0,0.08)] hover:border-[#C7D2FE] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <HealthDot cls={c.classification} />
                        <div className="min-w-0">
                          <p className="font-medium text-[#111827] text-sm truncate leading-tight">{c.name}</p>
                          <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">{formatCNPJ(c.cnpj)}</p>
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <ClassBadge cls={c.classification} />
                      {canSeeAll && <span className="text-xs text-[#9CA3AF]">{c.seller_name}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[#9CA3AF]">Faturamento</p>
                        <p className="font-medium text-[#111827] mt-0.5 tabular-nums">{formatCurrency(c.totalRevenue)}</p>
                        <p className="text-[#9CA3AF]">{c.orderCount} pedido{c.orderCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-[#9CA3AF]">Último pedido</p>
                        <p className="font-medium text-[#111827] mt-0.5">{formatDate(c.lastOrderDate)}</p>
                        <p className="text-[#9CA3AF]">{pluralDays(c.daysSinceLastOrder)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F3F4F6]"
                         onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <ContactDot days={c.daysSinceContact} />
                        <span className="text-xs text-[#9CA3AF]">
                          {c.last_contact_at ? pluralDays(c.daysSinceContact) : 'Sem contato'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {c.phone && (
                          <>
                            <a href={`tel:${c.phone}`} title="Ligar"
                               className="p-1 rounded text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                              <Phone size={13} />
                            </a>
                            <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`}
                               target="_blank" rel="noreferrer" title="WhatsApp"
                               className="p-1 rounded text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <MessageCircle size={13} />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/clientes/${c.id}`)}
                          className="p-1 rounded text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void
}) {
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4)            return [1, 2, 3, 4, 5, 6, 7]
    if (page >= totalPages - 3) return Array.from({ length: 7 }, (_, i) => totalPages - 6 + i)
    return [page - 3, page - 2, page - 1, page, page + 1, page + 2, page + 3]
  }, [page, totalPages])

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      {pages.map(n => (
        <button key={n} onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
            page === n ? 'bg-[#3B5BDB] text-white' : 'text-[#374151] hover:bg-[#F3F4F6]'
          }`}
        >
          {n}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
