import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RadarClient {
  id: string
  name: string
  trade_name: string | null
  status: string | null
  last_order_at: string | null
  avg_reorder_days: number | null
}

type StatusKey = 'active' | 'reorder' | 'delayed' | 'at_risk'
type FilterKey = 'all' | StatusKey

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusKey, {
  label: string
  color: string
  ring: number
  ringStroke: string
  dotColor: string
  borderColor: string
}> = {
  active:   { label: 'Ativos',      color: '#16a34a', ring: 60,  ringStroke: '#bbf7d0', dotColor: '#16a34a', borderColor: '#16a34a' },
  reorder:  { label: 'Recompra',    color: '#d97706', ring: 105, ringStroke: '#fde68a', dotColor: '#d97706', borderColor: '#d97706' },
  delayed:  { label: 'Atrasados',   color: '#ea580c', ring: 150, ringStroke: '#fed7aa', dotColor: '#ea580c', borderColor: '#ea580c' },
  at_risk:  { label: 'Em risco',    color: '#dc2626', ring: 190, ringStroke: '#fecaca', dotColor: '#dc2626', borderColor: '#dc2626' },
}

const STATUS_ORDER: StatusKey[] = ['active', 'reorder', 'delayed', 'at_risk']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr.replace(' ', 'T'))
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function displayName(c: RadarClient): string {
  return c.trade_name?.trim() || c.name?.trim() || 'Sem nome'
}

function clientSubtitle(c: RadarClient): string {
  const dias = daysSince(c.last_order_at)
  if (!c.last_order_at || dias === null) return 'Sem histórico de compra'

  switch (c.status) {
    case 'active':
      return 'Comprando no ciclo esperado'
    case 'reorder': {
      const ciclo = c.avg_reorder_days ?? 30
      const atraso = Math.max(0, dias - ciclo)
      return atraso > 0
        ? `Recompra próxima — atraso de ${atraso} dias`
        : `Recompra próxima — ${ciclo - dias} dias para o ciclo`
    }
    case 'delayed':
      return dias > 60
        ? `Sem compra há mais de 60 dias`
        : 'Desvio do padrão de compra'
    case 'at_risk':
      return `Sem compra há mais de ${dias} dias`
    default:
      return `Último pedido há ${dias} dias`
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 bg-gray-100 rounded animate-pulse w-48" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-100 rounded-lg p-4 space-y-2">
            <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
            <div className="h-7 bg-gray-100 rounded animate-pulse w-10" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-lg" style={{ height: 420 }}>
        <div className="flex items-center justify-center h-full">
          <div className="w-64 h-64 rounded-full bg-gray-50 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─── SVG Radar ───────────────────────────────────────────────────────────────

interface RadarDot {
  id: string
  name: string
  x: number
  y: number
  color: string
}

function RadarSVG({
  clients,
  onClientClick,
}: {
  clients: RadarClient[]
  onClientClick: (id: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const CX = 200
  const CY = 200

  // Group clients by status
  const grouped = useMemo(() => {
    const g: Record<StatusKey, RadarClient[]> = {
      active: [], reorder: [], delayed: [], at_risk: [],
    }
    for (const c of clients) {
      const s = c.status as StatusKey
      if (g[s]) g[s].push(c)
    }
    return g
  }, [clients])

  // Compute dot positions
  const dots: RadarDot[] = useMemo(() => {
    const result: RadarDot[] = []
    for (const key of STATUS_ORDER) {
      const cfg = STATUS_CONFIG[key]
      const group = grouped[key]
      const total = group.length
      group.forEach((c, i) => {
        // Distribute evenly starting from top, with slight offset per group
        const offset = key === 'active' ? 0 : key === 'reorder' ? 0.3 : key === 'delayed' ? 0.6 : 0.9
        const angle = ((i / Math.max(total, 1)) * 2 * Math.PI) + offset - Math.PI / 2
        result.push({
          id: c.id,
          name: displayName(c),
          x: CX + cfg.ring * Math.cos(angle),
          y: CY + cfg.ring * Math.sin(angle),
          color: cfg.dotColor,
        })
      })
    }
    return result
  }, [grouped])

  return (
    <svg
      viewBox="0 0 400 400"
      width="100%"
      style={{ maxWidth: 400, display: 'block', margin: '0 auto' }}
      aria-label="Radar da Carteira"
    >
      {/* Background circle */}
      <circle cx={CX} cy={CY} r={210} fill="#f9fafb" />

      {/* Concentric rings */}
      {STATUS_ORDER.map(key => {
        const cfg = STATUS_CONFIG[key]
        return (
          <circle
            key={key}
            cx={CX}
            cy={CY}
            r={cfg.ring}
            fill="none"
            stroke={cfg.ringStroke}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )
      })}

      {/* Ring labels */}
      <text x={CX} y={CY - STATUS_CONFIG.active.ring - 6} textAnchor="middle" fontSize={9} fill="#16a34a" fontFamily="DM Sans, sans-serif" fontWeight={600} letterSpacing={1}>ATIVO</text>
      <text x={CX + STATUS_CONFIG.reorder.ring + 8} y={CY} textAnchor="start" fontSize={9} fill="#d97706" fontFamily="DM Sans, sans-serif" fontWeight={600} letterSpacing={1}>RECOMPRA</text>
      <text x={CX} y={CY + STATUS_CONFIG.delayed.ring + 14} textAnchor="middle" fontSize={9} fill="#ea580c" fontFamily="DM Sans, sans-serif" fontWeight={600} letterSpacing={1}>ATRASO</text>
      <text x={CX - STATUS_CONFIG.at_risk.ring - 8} y={CY} textAnchor="end" fontSize={9} fill="#dc2626" fontFamily="DM Sans, sans-serif" fontWeight={600} letterSpacing={1}>RISCO</text>

      {/* Cross lines */}
      <line x1={CX} y1={CY - 200} x2={CX} y2={CY + 200} stroke="#e5e7eb" strokeWidth={0.5} />
      <line x1={CX - 200} y1={CY} x2={CX + 200} y2={CY} stroke="#e5e7eb" strokeWidth={0.5} />

      {/* Center dot */}
      <circle cx={CX} cy={CY} r={3} fill="#3B5BDB" />

      {/* Client dots */}
      {dots.map(dot => (
        <g key={dot.id}>
          <circle
            cx={dot.x}
            cy={dot.y}
            r={hovered === dot.id ? 8 : 6}
            fill={dot.color}
            fillOpacity={0.85}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'pointer', transition: 'r 0.12s' }}
            onMouseEnter={() => setHovered(dot.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onClientClick(dot.id)}
          />
          {hovered === dot.id && (
            <g>
              <rect
                x={dot.x + 10}
                y={dot.y - 14}
                width={Math.min(dot.name.length * 6.5 + 12, 150)}
                height={22}
                rx={4}
                fill="#1e293b"
                fillOpacity={0.92}
              />
              <text
                x={dot.x + 16}
                y={dot.y + 2}
                fontSize={11}
                fill="white"
                fontFamily="DM Sans, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {dot.name.length > 20 ? dot.name.slice(0, 18) + '…' : dot.name}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RadarCarteira() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterKey>('all')

  const { data: clients, loading } = useSupabaseQuery<RadarClient[]>(
    ({ seller, company_id }) =>
      supabase
        .from('clients')
        .select('id, name, trade_name, status, last_order_at, avg_reorder_days')
        .eq('company_id', company_id)
        .eq('seller_id', seller.id)
        .neq('status', 'inactive'),
    [],
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const list = clients ?? []
    const total = list.length
    const counts: Record<StatusKey, number> = {
      active: 0, reorder: 0, delayed: 0, at_risk: 0,
    }
    for (const c of list) {
      const s = c.status as StatusKey
      if (counts[s] !== undefined) counts[s]++
    }
    return { total, counts }
  }, [clients])

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    const list = clients ?? []
    if (filter === 'all') return list
    return list.filter(c => c.status === filter)
  }, [clients, filter])

  // ── Tabs config ───────────────────────────────────────────────────────────

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',      label: 'Todos',     count: kpis.total              },
    { key: 'at_risk',  label: 'Em risco',  count: kpis.counts.at_risk     },
    { key: 'delayed',  label: 'Atraso',    count: kpis.counts.delayed     },
    { key: 'reorder',  label: 'Recompra',  count: kpis.counts.reorder     },
    { key: 'active',   label: 'Ativos',    count: kpis.counts.active      },
  ]

  // ── Alert count ──────────────────────────────────────────────────────────

  const alertCount = kpis.counts.at_risk + kpis.counts.delayed

  if (loading) return <Skeleton />

  if (!clients || clients.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg px-4 py-10 text-center">
        <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Nenhum cliente na carteira</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
              Radar da Carteira
            </h3>
            {alertCount > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
              >
                {alertCount} em alerta
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{kpis.total} clientes analisados</p>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_ORDER.map(key => {
          const cfg = STATUS_CONFIG[key]
          const count = kpis.counts[key]
          const pct = kpis.total > 0
            ? ((count / kpis.total) * 100).toFixed(1)
            : '0.0'
          return (
            <div
              key={key}
              className="bg-white border border-gray-100 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-200 transition-colors"
              onClick={() => setFilter(key)}
              style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  {cfg.label}
                </span>
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: cfg.color }}>
                {count}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">{pct}% da carteira</p>
            </div>
          )
        })}
      </div>

      {/* ── SVG Radar ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-lg p-4">
        <RadarSVG
          clients={clients}
          onClientClick={id => navigate(`/clientes/${id}`)}
        />
      </div>

      {/* ── Tabs de filtro ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap">
        {tabs.map(t => {
          const active = filter === t.key
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={
                active
                  ? { backgroundColor: '#3B5BDB', color: 'white' }
                  : { backgroundColor: 'transparent', color: '#6b7280' }
              }
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="ml-1 text-[10px] font-semibold"
                  style={{ opacity: active ? 0.8 : 0.7 }}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Lista de clientes ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {filteredClients.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-lg px-4 py-6 text-center">
            <p className="text-sm text-gray-400">Nenhum cliente neste filtro</p>
          </div>
        )}
        {filteredClients.map(c => {
          const dias = daysSince(c.last_order_at)
          const statusKey = (c.status as StatusKey) ?? 'active'
          const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.active
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/clientes/${c.id}`)}
              className="w-full text-left bg-white border border-gray-100 rounded-lg px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all"
              style={{ borderLeftWidth: 3, borderLeftColor: cfg.borderColor, minHeight: 44 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName(c)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {clientSubtitle(c)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {dias !== null && (
                    <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                      {dias}d
                    </span>
                  )}
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: cfg.ringStroke,
                      color: cfg.color,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
