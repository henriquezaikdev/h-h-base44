import { useNavigate } from 'react-router-dom'
import { Clock, TrendingUp, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriorityClient {
  id: string
  name: string
  trade_name: string | null
  priority_score: number | null
  last_order_at: string | null
  avg_reorder_days: number | null
  status: string | null
  seller_id: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function displayName(c: PriorityClient): string {
  return (c.trade_name?.trim() || c.name?.trim()) || 'Sem nome'
}

interface StatusBadgeConfig {
  label: string
  bg: string
  text: string
}

function statusConfig(status: string | null): StatusBadgeConfig {
  switch (status) {
    case 'active':   return { label: 'Ativo',      bg: '#dcfce7', text: '#15803d' }
    case 'reorder':  return { label: 'Recompra',   bg: '#fef9c3', text: '#a16207' }
    case 'delayed':  return { label: 'Atrasado',   bg: '#ffedd5', text: '#c2410c' }
    case 'at_risk':  return { label: 'Em risco',   bg: '#fee2e2', text: '#b91c1c' }
    default:         return { label: status ?? '—', bg: '#f3f4f6', text: '#6b7280' }
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-lg">
      <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
        <div className="h-2 bg-gray-100 rounded animate-pulse w-1/3" />
      </div>
      <div className="w-16 h-2 bg-gray-100 rounded animate-pulse" />
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PriorityQueueSection() {
  const navigate = useNavigate()

  const { data: clients, loading } = useSupabaseQuery<PriorityClient[]>(
    ({ seller, company_id }) =>
      supabase
        .from('clients')
        .select('id, name, trade_name, priority_score, last_order_at, avg_reorder_days, status, seller_id')
        .eq('company_id', company_id)
        .eq('seller_id', seller.id)
        .neq('status', 'inactive')
        .order('priority_score', { ascending: false, nullsFirst: false })
        .limit(10),
    [],
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#eef2ff' }}
        >
          <TrendingUp className="w-4 h-4" style={{ color: '#3B5BDB' }} />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
          Fila de Prioridades
        </h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Empty */}
      {!loading && (!clients || clients.length === 0) && (
        <div className="bg-white border border-gray-100 rounded-lg px-4 py-8 text-center">
          <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhum cliente na fila</p>
        </div>
      )}

      {/* List */}
      {!loading && clients && clients.length > 0 && (
        <div className="space-y-2">
          {clients.map((client, index) => {
            const dias = daysSince(client.last_order_at)
            const score = Math.min(100, Math.max(0, client.priority_score ?? 0))
            const badge = statusConfig(client.status)

            return (
              <button
                key={client.id}
                onClick={() => navigate(`/clientes/${client.id}`)}
                className="w-full text-left bg-white border border-gray-100 rounded-lg px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all group"
                style={{ minHeight: 44 }}
              >
                <div className="flex items-start gap-3">
                  {/* Position badge */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: index < 3 ? '#eef2ff' : '#f3f4f6',
                      color: index < 3 ? '#3B5BDB' : '#6b7280',
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name + badge row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {displayName(client)}
                      </span>
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Days since order */}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                      {dias !== null ? (
                        <span
                          className="text-xs"
                          style={{
                            color: dias > 60 ? '#b91c1c' : dias > 30 ? '#c2410c' : '#6b7280',
                          }}
                        >
                          {dias} dias sem pedido
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sem pedidos</span>
                      )}
                    </div>

                    {/* Score bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: '#e5e7eb' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${score}%`,
                            backgroundColor: '#3B5BDB',
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                        {score.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
