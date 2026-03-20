import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Search, AlertCircle,
  TrendingUp, TrendingDown, Edit2, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'done' | 'pending' | 'no_seller' | 'no_class'

interface OrderItem {
  id: string
  product_id: string | null
  products: { name: string } | null
}

interface RawOrder {
  id: string
  number: string | null
  created_at: string
  total: number
  margin: number | null
  status: string
  origin: string | null
  seller_id: string | null
  classification: string | null
  company_id: string
  clients: { name: string } | null
  order_items: OrderItem[]
}

interface Order extends RawOrder {
  firstProduct: string
  itemCount: number
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
  return ['concluido','concluído','done','completed','ok','faturado'].includes(status.toLowerCase())
}

const FULL_ACCESS = ['owner', 'admin', 'manager']

// ─── Micro-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return isDone(status)
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">OK</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><AlertCircle size={10} />Pendente</span>
}

function MarginCell({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-[#9CA3AF] text-sm">—</span>
  const pos = margin >= 0
  return (
    <div className={`flex items-center gap-1 ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      <span className="text-sm font-medium tabular-nums">{margin.toFixed(1)}%</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const canSeeAll      = role ? FULL_ACCESS.includes(role) : false
  const canSeeVendedor = canSeeAll

  // Navegação por mês
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Filtros
  const [search,       setSearch]       = useState('')
  const [sellerFilter, setSellerFilter] = useState('all')
  const [originFilter, setOriginFilter] = useState('all')
  const [marginFilter, setMarginFilter] = useState('all')
  const [activeTab,    setActiveTab]    = useState<TabKey>('all')

  // UI
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  // ── Queries via useSupabaseQuery ─────────────────────────────────────────

  const { data: rawOrders, loading, error } = useSupabaseQuery<RawOrder[]>(
    ({ company_id }) =>
      supabase
        .from('orders')
        .select('*, clients(name), order_items(id, product_id, products(name))')
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
        .eq('active', true)
        .order('name'),
    [],
  )

  const orders      = useMemo(() => (rawOrders  ?? []).map(toOrder), [rawOrders])
  const sellersList = rawSellers ?? []

  // ── Derived ──────────────────────────────────────────────────────────────

  const origins = useMemo(() => {
    const set = new Set(orders.map(o => o.origin).filter(Boolean) as string[])
    return [...set].sort()
  }, [orders])

  const filtered = useMemo(() => {
    const mKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    const q    = search.toLowerCase().trim()
    return orders.filter(o => {
      if (monthKey(o.created_at) !== mKey)                                         return false
      if (activeTab === 'done'      && !isDone(o.status))                          return false
      if (activeTab === 'pending'   &&  isDone(o.status))                          return false
      if (activeTab === 'no_seller' &&  o.seller_id !== null)                      return false
      if (activeTab === 'no_class'  && !!o.classification)                         return false
      if (canSeeVendedor && sellerFilter !== 'all' && o.seller_id !== sellerFilter) return false
      if (originFilter !== 'all' && o.origin !== originFilter)                     return false
      if (marginFilter === 'positive' && (o.margin === null || o.margin < 0))      return false
      if (marginFilter === 'negative' && (o.margin === null || o.margin >= 0))     return false
      if (q) {
        const num    = (o.number ?? '').toLowerCase()
        const client = (o.clients?.name ?? '').toLowerCase()
        if (!num.includes(q) && !client.includes(q))                              return false
      }
      return true
    })
  }, [orders, currentMonth, activeTab, search, sellerFilter, originFilter, marginFilter, canSeeVendedor])

  const totalRevenue = filtered.reduce((s, o) => s + (o.total ?? 0), 0)
  const allRevenue   = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  const tabCounts = useMemo(() => {
    const mKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    const m    = orders.filter(o => monthKey(o.created_at) === mKey)
    return {
      all:       m.length,
      done:      m.filter(o =>  isDone(o.status)).length,
      pending:   m.filter(o => !isDone(o.status)).length,
      no_seller: m.filter(o =>  o.seller_id === null).length,
      no_class:  m.filter(o => !o.classification).length,
    }
  }, [orders, currentMonth])

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of filtered) {
      const k = monthKey(o.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function toggleMonth(key: string) {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este pedido?')) return
    await supabase.from('orders').delete().eq('id', id)
  }

  // ── Tabs config ───────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',       label: 'Todos'             },
    { key: 'done',      label: 'Concluídos'        },
    { key: 'pending',   label: 'Pendentes'         },
    { key: 'no_seller', label: 'Sem Vendedor'      },
    { key: 'no_class',  label: 'Sem Classificação' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Pedidos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Histórico completo de vendas</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-[#6B7280]">Total de pedidos</p>
              <p className="text-xl font-semibold text-[#111827] tabular-nums">{loading ? '—' : orders.length}</p>
            </div>
            <div className="w-px h-8 bg-[#E5E7EB]" />
            <div className="text-right">
              <p className="text-xs text-[#6B7280]">Valor total</p>
              <p className="text-xl font-semibold text-[#111827] tabular-nums">{loading ? '—' : fmtShort(allRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* Filtros */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
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

          {origins.length > 0 && (
            <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}
              className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition">
              <option value="all">Todas as origens</option>
              {origins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}

          <select value={marginFilter} onChange={e => setMarginFilter(e.target.value)}
            className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#374151] outline-none focus:border-[#3B5BDB] bg-white transition">
            <option value="all">Todas as margens</option>
            <option value="positive">Margem positiva</option>
            <option value="negative">Margem negativa</option>
          </select>

          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] whitespace-nowrap">
            {filtered.length} pedido{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Navegação por mês + Tabs */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">

          {/* Mês */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
            <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#111827]">{monthLabel(currentMonth)}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {tabCounts.all} pedido{tabCounts.all !== 1 ? 's' : ''} · {fmt(totalRevenue)}
              </p>
            </div>
            <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center px-4 border-b border-[#F3F4F6] overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#3B5BDB] border-b-2 border-[#3B5BDB] -mb-px'
                    : 'text-[#6B7280] hover:text-[#374151]'
                }`}>
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.key ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'bg-[#F3F4F6] text-[#6B7280]'
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Erro */}
          {error && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="p-16 flex items-center justify-center">
              <span className="text-sm text-[#9CA3AF]">Carregando pedidos…</span>
            </div>
          )}

          {/* Vazio */}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-16 text-center text-sm text-[#9CA3AF]">
              Nenhum pedido encontrado para este período.
            </div>
          )}

          {/* Tabela */}
          {!loading && !error && filtered.length > 0 && (
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
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([key, groupOrders]) => {
                    const collapsed  = collapsedMonths.has(key)
                    const groupTotal = groupOrders.reduce((s, o) => s + (o.total ?? 0), 0)
                    const [year, mon] = key.split('-').map(Number)
                    const label = new Date(year, mon - 1, 1)
                      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                      .replace(/^\w/, c => c.toUpperCase())

                    return [
                      // Cabeçalho do grupo
                      <tr key={`hdr-${key}`}
                        onClick={() => toggleMonth(key)}
                        className="bg-[#F9FAFB] cursor-pointer hover:bg-[#F3F4F6] transition-colors border-y border-[#E5E7EB]">
                        <td colSpan={8} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {collapsed
                              ? <ChevronRight size={13} className="text-[#9CA3AF]" />
                              : <ChevronDown  size={13} className="text-[#9CA3AF]" />}
                            <span className="text-xs font-semibold text-[#374151]">{label}</span>
                            <span className="text-xs text-[#9CA3AF]">· {groupOrders.length} pedido{groupOrders.length !== 1 ? 's' : ''}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-sm font-semibold text-emerald-600 tabular-nums">{fmt(groupTotal)}</span>
                        </td>
                      </tr>,

                      // Linhas
                      ...(!collapsed ? groupOrders.map(o => (
                        <tr key={o.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => navigate(`/pedidos/${o.id}`)}
                              className="text-[#3B5BDB] font-medium hover:underline">
                              {o.number ? `#${o.number}` : '—'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#111827] truncate max-w-40">{o.clients?.name ?? '—'}</p>
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
                          <td className="px-4 py-3"><MarginCell margin={o.margin} /></td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3 text-center text-[#6B7280] tabular-nums">{o.itemCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => navigate(`/pedidos/${o.id}`)}
                                className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors" title="Editar">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDelete(o.id)}
                                className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
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
      </div>
    </div>
  )
}
