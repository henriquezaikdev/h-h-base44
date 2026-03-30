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
      className="bg-white rounded-xl border border-[#E5E7EB]"
    >
      <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
          <DollarSign size={14} className="text-[#3B5BDB]" />
        </div>
        <h3 className="text-sm font-semibold text-[#111827]">Comissões a Pagar</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              <th className="text-left px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide">Vendedor</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide">Receita</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide">Margem %</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide">Comissão</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide">%</th>
              <th className="px-6 py-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide w-28">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F9FAFB]">
            {sorted.map((s, i) => (
              <tr key={s.id} className="hover:bg-[#FAFAF9] transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                    }`}>{i + 1}</span>
                    <span className="font-medium text-[#111827]">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#111827]">{fmt(s.revenue)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${marginColor(s.marginBruta)}`}>{s.marginBruta.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#111827]">{fmt(s.comissaoReal)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">{s.comissaoPercentual.toFixed(2)}%</td>
                <td className="px-6 py-3">
                  {s.salesTarget > 0 ? (
                    <div className="flex items-center gap-2">
                      <Progress value={s.goalPercent} className={`flex-1 h-1.5 ${
                        s.goalPercent >= 100 ? '[&>div]:bg-emerald-500' : s.goalPercent >= 70 ? '[&>div]:bg-[#3B5BDB]' : '[&>div]:bg-amber-500'
                      }`} />
                      <span className="text-[10px] text-[#6B7280] tabular-nums w-8 text-right">{Math.round(s.goalPercent)}%</span>
                    </div>
                  ) : <span className="text-[10px] text-[#D1D5DB]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
              <td className="px-6 py-3 text-sm font-semibold text-[#111827]">Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#111827]">{fmt(totalReceita)}</td>
              <td className={`px-4 py-3 text-right tabular-nums font-semibold ${marginColor(avgMargin)}`}>{avgMargin.toFixed(1)}%</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-[#111827]">{fmt(totalComissao)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">{avgCommPct.toFixed(2)}%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </motion.div>
  )
}
