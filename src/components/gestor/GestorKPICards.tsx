import { motion } from 'framer-motion'
import {
  DollarSign, Receipt, TrendingDown, TrendingUp, Wallet, Target,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { GestorKPIs } from '../../hooks/useGestorData'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const pct = (v: number) => `${v.toFixed(1)}%`

type Accent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky'

const ACCENT: Record<Accent, { bg: string; iconBg: string; iconColor: string }> = {
  indigo:  { bg: 'border-[#3B5BDB]/15 hover:border-[#3B5BDB]/30', iconBg: 'bg-[#EEF2FF]', iconColor: 'text-[#3B5BDB]' },
  emerald: { bg: 'border-emerald-500/15 hover:border-emerald-500/30', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  amber:   { bg: 'border-amber-500/15 hover:border-amber-500/30', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  rose:    { bg: 'border-rose-500/15 hover:border-rose-500/30', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
  violet:  { bg: 'border-violet-500/15 hover:border-violet-500/30', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  sky:     { bg: 'border-sky-500/15 hover:border-sky-500/30', iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
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
      className={`bg-white rounded-xl border ${a.bg} p-5 transition-all duration-200 hover:shadow-sm`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${a.iconBg} flex items-center justify-center`}>
          <Ic size={18} className={a.iconColor} strokeWidth={1.75} />
        </div>
        {trend && trendLabel && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#111827] tracking-tight tabular-nums">{value}</p>
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
      <KPICard label="CMV" value={fmt(kpis.totalCMV)} icon={Receipt}
        accent="amber" delay={0.05} />
      <KPICard label="Margem Bruta" value={pct(kpis.marginPercent)} icon={Wallet}
        accent="violet" delay={0.1} />
      <KPICard label="Despesas (Comissões)" value={fmt(despesas)} icon={TrendingDown}
        accent="rose" delay={0.15} />
      <KPICard label="Lucro Líquido" value={fmt(lucroLiquido)} icon={TrendingUp}
        accent={lucroLiquido >= 0 ? 'emerald' : 'rose'} delay={0.2}
        trend={lucroLiquido >= 0 ? 'up' : 'down'}
        trendLabel={lucroLiquido >= 0 ? 'Positivo' : 'Negativo'} />
      <KPICard label="Meta vs Real" value={`${kpis.ordersCount} pedidos`} icon={Target}
        accent="sky" delay={0.25}
        trend={trendDir(kpis.ordersCount, kpis.ordersCountPrev)}
        trendLabel={trendPct(kpis.ordersCount, kpis.ordersCountPrev)} />
    </div>
  )
}
