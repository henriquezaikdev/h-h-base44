import { motion } from 'framer-motion'
import type { GestorKPIs } from '../../hooks/useGestorData'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

export function GestorDRE({ kpis }: { kpis: GestorKPIs }) {
  const despesas = kpis.totalComissao
  const lucro = kpis.profit - despesas

  const rows = [
    { label: 'Receita Bruta', value: kpis.revenue, color: 'text-[#3B5BDB]' },
    { label: '(-) CMV', value: -kpis.totalCMV, color: 'text-amber-600' },
    { label: '(=) Lucro Bruto', value: kpis.profit, color: 'text-emerald-600', bold: true },
    { label: '(-) Comissões', value: -despesas, color: 'text-rose-500' },
    { label: '(=) Resultado', value: lucro, color: lucro >= 0 ? 'text-emerald-700' : 'text-rose-600', bold: true, border: true },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="bg-white rounded-xl border border-[#E5E7EB] p-6"
    >
      <h3 className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">
        Composição do Resultado
      </h3>
      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className={`flex items-center justify-between py-2.5 ${
            row.border ? 'border-t-2 border-[#E5E7EB] pt-3 mt-1' : ''
          }`}>
            <span className={`text-sm ${row.bold ? 'font-semibold text-[#111827]' : 'text-[#6B7280]'}`}>
              {row.label}
            </span>
            <span className={`text-sm tabular-nums font-mono ${row.bold ? 'font-bold text-base' : 'font-medium'} ${row.color}`}>
              {fmt(Math.abs(row.value))}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
