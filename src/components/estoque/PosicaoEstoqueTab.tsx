import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, DollarSign, AlertTriangle, TrendingDown, Tag } from 'lucide-react'
import type { Produto, Categoria, EstoqueKpis } from '../../hooks/useEstoqueData'
import EstoqueDrawer from './EstoqueDrawer'
import MovimentacaoModal from './MovimentacaoModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type PillKey = 'all' | 'ruptura' | 'abaixo' | 'semcusto'
type ProdStatus = 'ruptura' | 'abaixo' | 'ok'

interface Props {
  produtos: Produto[]
  categorias: Categoria[]
  kpis: EstoqueKpis
  companyId: string
  sellerId: string
  onRegistrar: (params: {
    productId: string; type: import('../../hooks/useEstoqueData').MovType
    quantity: number; reason: string; date: string; companyId: string; sellerId: string
  }) => Promise<{ error: string | null }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(p: Produto): ProdStatus {
  if ((p.stock_qty ?? 0) <= 0)                                         return 'ruptura'
  if (p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0)) return 'abaixo'
  return 'ok'
}

const STATUS_ORDER: Record<ProdStatus, number> = { ruptura: 0, abaixo: 1, ok: 2 }

const STATUS_CFG: Record<ProdStatus, { label: string; badge: string; qty: string }> = {
  ruptura: { label: 'Ruptura',         badge: 'bg-red-50 text-red-700',   qty: 'text-red-600'   },
  abaixo:  { label: 'Abaixo do Minimo', badge: 'bg-amber-50 text-amber-700', qty: 'text-amber-600' },
  ok:      { label: 'OK',              badge: 'bg-gray-100 text-gray-500', qty: 'text-[#111827]' },
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

const PAGE_SIZE = 50

// ─── Component ────────────────────────────────────────────────────────────────

export default function PosicaoEstoqueTab({ produtos, categorias, kpis, companyId, sellerId, onRegistrar }: Props) {
  const [pill,        setPill]        = useState<PillKey>('all')
  const [search,      setSearch]      = useState('')
  const [categoryId,  setCategoryId]  = useState('')
  const [page,        setPage]        = useState(1)
  const [selected,    setSelected]    = useState<Produto | null>(null)
  const [showModal,   setShowModal]   = useState(false)

  const hasFilter = pill !== 'all' || search.trim() !== '' || categoryId !== ''

  function clearFilters() { setPill('all'); setSearch(''); setCategoryId(''); setPage(1) }

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    let list = produtos

    if (pill === 'ruptura')  list = list.filter(p => (p.stock_qty ?? 0) <= 0)
    if (pill === 'abaixo')   list = list.filter(p => (p.stock_qty ?? 0) > 0 && p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0))
    if (pill === 'semcusto') list = list.filter(p => !p.cost || p.cost === 0)

    if (categoryId) list = list.filter(p => p.category_id === categoryId)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q),
      )
    }

    return [...list].sort((a, b) => {
      const sa = STATUS_ORDER[getStatus(a)]
      const sb = STATUS_ORDER[getStatus(b)]
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [produtos, pill, categoryId, search])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const paginated  = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── KPI cards ─────────────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'Custo Total em Estoque',
      value: fmtBRL(kpis.custoTotal),
      icon:  DollarSign,
      iconBg: 'bg-[#EEF2FF]', iconCls: 'text-[#3B5BDB]',
      badge: null,
    },
    {
      label: 'Em Ruptura',
      value: String(kpis.ruptura),
      icon:  AlertTriangle,
      iconBg: 'bg-red-50', iconCls: 'text-red-500',
      badge: kpis.ruptura > 0 ? 'bg-red-500 text-white' : null,
    },
    {
      label: 'Abaixo do Minimo',
      value: String(kpis.abaixoMinimo),
      icon:  TrendingDown,
      iconBg: 'bg-amber-50', iconCls: 'text-amber-500',
      badge: kpis.abaixoMinimo > 0 ? 'bg-amber-400 text-white' : null,
    },
    {
      label: 'Sem Custo Cadastrado',
      value: String(kpis.semCusto),
      icon:  Tag,
      iconBg: 'bg-gray-50', iconCls: 'text-gray-400',
      badge: null,
    },
  ]

  return (
    <>
      <div className="px-6 py-5">

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {kpiCards.map(k => (
            <div key={k.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#6B7280] mb-1">{k.label}</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-xl font-semibold tabular-nums leading-tight ${k.badge ? 'text-[#111827]' : 'text-[#111827]'}`}>
                      {k.value}
                    </p>
                    {k.badge && (
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${k.badge}`}>
                        !
                      </span>
                    )}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                  <k.icon size={15} className={k.iconCls} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">

          {/* Pills */}
          <div className="flex items-center gap-1.5">
            {([
              { key: 'all',      label: 'Todos'            },
              { key: 'ruptura',  label: 'Ruptura'           },
              { key: 'abaixo',   label: 'Abaixo do Minimo'  },
              { key: 'semcusto', label: 'Sem Custo'         },
            ] as { key: PillKey; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => { setPill(p.key); setPage(1) }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  pill === p.key
                    ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                    : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#3B5BDB] hover:text-[#3B5BDB]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category select */}
          <select
            value={categoryId}
            onChange={e => { setCategoryId(e.target.value); setPage(1) }}
            className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white"
          >
            <option value="">Todas as categorias</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por nome ou SKU"
              className="pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg w-52 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white text-[#111827] placeholder-[#9CA3AF] transition"
            />
          </div>

          {/* Clear */}
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#6B7280] hover:text-[#111827] hover:underline transition-colors"
            >
              Limpar filtros
            </button>
          )}

          {/* Register movement */}
          <button
            onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#3B5BDB] border border-[#3B5BDB] rounded-lg hover:bg-[#EEF2FF] transition-colors"
          >
            Registrar Movimentacao
          </button>
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
            <p className="text-sm text-[#9CA3AF]">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-28">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-28">Qtd Atual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-28">Est. Minimo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-28">Custo Unit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p, i) => {
                    const status = getStatus(p)
                    const cfg    = STATUS_CFG[status]
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className={`border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F9FAFB] transition-colors ${
                          i > 0 ? '' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">
                          {p.sku ?? <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{p.name}</td>
                        <td className="px-4 py-3 text-xs text-[#6B7280]">
                          {p.product_categories?.name ?? <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${cfg.qty}`}>
                          {p.stock_qty ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">
                          {p.stock_min ?? <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#111827]">
                          {p.cost ? fmtBRL(p.cost) : <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-[#9CA3AF]">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} de {visible.length} produtos
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                    .reduce<(number | '…')[]>((acc, n, i, arr) => {
                      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((n, i) =>
                      n === '…' ? (
                        <span key={`e-${i}`} className="px-1 text-xs text-[#9CA3AF]">…</span>
                      ) : (
                        <button
                          key={n}
                          onClick={() => setPage(n as number)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                            page === n ? 'bg-[#3B5BDB] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          {n}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <EstoqueDrawer
          produto={selected}
          produtos={produtos}
          companyId={companyId}
          sellerId={sellerId}
          onClose={() => setSelected(null)}
          onRegistrar={onRegistrar}
        />
      )}

      {/* Modal de movimentação standalone */}
      {showModal && (
        <MovimentacaoModal
          produtos={produtos}
          companyId={companyId}
          sellerId={sellerId}
          onClose={() => setShowModal(false)}
          onSave={onRegistrar}
        />
      )}
    </>
  )
}
