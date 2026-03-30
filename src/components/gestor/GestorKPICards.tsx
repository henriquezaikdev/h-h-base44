import { motion } from 'framer-motion'
import {
  DollarSign, Receipt, TrendingDown, TrendingUp, Wallet, Target,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { GestorKPIs } from '../../hooks/useGestorData'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const pct = (v: number) => `${v.toFixed(1)}%`

type Accent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky'

const ACCENT: Record<Accent, { card: string; iconBg: string; iconColor: string; labelColor: string; valueColor: string }> = {
  indigo:  { card: 'bg-[#EEF2FF] border-[#C7D2FE]', iconBg: 'bg-[#3B5BDB]', iconColor: 'text-white', labelColor: 'text-[#4338CA]', valueColor: 'text-[#1E1B4B]' },
  emerald: { card: 'bg-emerald-50 border-emerald-200', iconBg: 'bg-emerald-500', iconColor: 'text-white', labelColor: 'text-emerald-700', valueColor: 'text-emerald-900' },
  amber:   { card: 'bg-amber-50 border-amber-200', iconBg: 'bg-amber-500', iconColor: 'text-white', labelColor: 'text-amber-700', valueColor: 'text-amber-900' },
  rose:    { card: 'bg-rose-50 border-rose-200', iconBg: 'bg-rose-500', iconColor: 'text-white', labelColor: 'text-rose-700', valueColor: 'text-rose-900' },
  violet:  { card: 'bg-violet-50 border-violet-200', iconBg: 'bg-violet-500', iconColor: 'text-white', labelColor: 'text-violet-700', valueColor: 'text-violet-900' },
  sky:     { card: 'bg-sky-50 border-sky-200', iconBg: 'bg-sky-500', iconColor: 'text-white', labelColor: 'text-sky-700', valueColor: 'text-sky-900' },
}

interface KPICardProps {
  label: string
  value: string
  icon: React.ElementType
  accent: Accent
  trend?: 'up' | 'down' | null
  trendLabel?: string
  delay: number
}

function KPICard({ label, value, icon: Ic, accent, trend, trendLabel, delay }: KPICardProps) {
  const a = ACCENT[accent]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={`rounded-xl border ${a.card} p-5 transition-all duration-200 hover:shadow-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${a.iconBg} flex items-center justify-center`}>
          <Ic size={16} className={a.iconColor} strokeWidth={2} />
        </div>
        {trend && trendLabel && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trendLabel}
          </div>
        )}
      </div>
      <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${a.labelColor}`}>{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${a.valueColor}`}>{value}</p>
    </motion.div>
  )
}

function trendDir(curr: number, prev: number): 'up' | 'down' | null {
  if (prev === 0 && curr === 0) return null
  if (prev === 0) return 'up'
  const d = ((curr - prev) / prev) * 100
  if (Math.abs(d) < 1) return null
  return d > 0 ? 'up' : 'down'
}

function trendPct(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? '+100%' : '0%'
  const d = ((curr - prev) / prev) * 100
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`
}

export function GestorKPICards({ kpis }: { kpis: GestorKPIs }) {
  const despesas = kpis.totalComissao
  const lucroLiquido = kpis.profit - despesas

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KPICard label="Receita do Mês" value={fmt(kpis.revenue)} icon={DollarSign}
        accent="indigo" delay={0}
        trend={trendDir(kpis.revenue, kpis.revenuePrev)}
        trendLabel={trendPct(kpis.revenue, kpis.revenuePrev)} />
      <KPICard label="CMV (Custo da Mercadoria)" value={fmt(kpis.totalCMV)} icon={Receipt}
        accent="amber" delay={0.05} />
      <KPICard label="Despesas Totais" value={fmt(despesas)} icon={TrendingDown}
        accent="rose" delay={0.1} />
      <KPICard label="Lucro Líquido (Resultado Real)" value={fmt(lucroLiquido)} icon={TrendingUp}
        accent={lucroLiquido >= 0 ? 'emerald' : 'rose'} delay={0.15}
        trend={lucroLiquido >= 0 ? 'up' : 'down'}
        trendLabel={lucroLiquido >= 0 ? 'Positivo' : 'Negativo'} />
      <KPICard label="Margem Bruta" value={pct(kpis.marginPercent)} icon={Wallet}
        accent="violet" delay={0.2} />
      <KPICard label="Meta vs Real" value={`${((kpis.revenue / Math.max(kpis.revenue, 1)) * 100).toFixed(1)}% do Break-even`} icon={Target}
        accent="sky" delay={0.25}
        trend={trendDir(kpis.ordersCount, kpis.ordersCountPrev)}
        trendLabel={trendPct(kpis.ordersCount, kpis.ordersCountPrev)} />
    </div>
  )
}
