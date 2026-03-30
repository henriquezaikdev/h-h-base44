import { DollarSign } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SellerResult } from '../../hooks/useGestorData'
import { Progress } from '../ui/progress'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

function marginColor(m: number) {
  if (m >= 15) return 'text-emerald-600'
  if (m >= 0) return 'text-amber-600'
  return 'text-red-600'
}

export function GestorComissoesTable({ items }: { items: SellerResult[] }) {
  const sorted = [...items].filter(s => s.revenue > 0).sort((a, b) => b.comissaoReal - a.comissaoReal)
  const totalReceita = sorted.reduce((s, i) => s + i.revenue, 0)
  const totalComissao = sorted.reduce((s, i) => s + i.comissaoReal, 0)
  const avgMargin = totalReceita > 0
    ? sorted.reduce((s, i) => s + i.marginBruta * i.revenue, 0) / totalReceita
    : 0
  const avgCommPct = totalReceita > 0 ? (totalComissao / totalReceita) * 100 : 0

  if (sorted.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="bg-card rounded-xl border border-border"
    >
      <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <DollarSign size={14} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Comissões a Pagar</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">Vendedor</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Margem %</th>
              <th className="text-right">Comissão</th>
              <th className="text-right">%</th>
              <th className="w-28">Meta</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                    }`}>{i + 1}</span>
                    <span className="font-medium text-foreground">{s.name}</span>
                  </div>
                </td>
                <td className="text-right tabular-nums font-medium text-foreground">{fmt(s.revenue)}</td>
                <td className={`text-right tabular-nums font-semibold ${marginColor(s.marginBruta)}`}>{s.marginBruta.toFixed(1)}%</td>
                <td className="text-right tabular-nums font-semibold text-foreground">{fmt(s.comissaoReal)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{s.comissaoPercentual.toFixed(2)}%</td>
                <td>
                  {s.salesTarget > 0 ? (
                    <div className="flex items-center gap-2">
                      <Progress value={s.goalPercent} className={`flex-1 h-1.5 ${
                        s.goalPercent >= 100 ? '[&>div]:bg-emerald-500' : s.goalPercent >= 70 ? '[&>div]:bg-primary' : '[&>div]:bg-amber-500'
                      }`} />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{Math.round(s.goalPercent)}%</span>
                    </div>
                  ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold text-foreground">Total</td>
              <td className="text-right tabular-nums font-semibold text-foreground">{fmt(totalReceita)}</td>
              <td className={`text-right tabular-nums font-semibold ${marginColor(avgMargin)}`}>{avgMargin.toFixed(1)}%</td>
              <td className="text-right tabular-nums font-bold text-foreground">{fmt(totalComissao)}</td>
              <td className="text-right tabular-nums text-muted-foreground">{avgCommPct.toFixed(2)}%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </motion.div>
  )
}
