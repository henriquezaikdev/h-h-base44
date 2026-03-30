import { motion } from 'framer-motion'
import type { GestorKPIs } from '../../hooks/useGestorData'

const fmtMono = (v: number) => {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs)
  return sign ? `${sign}${formatted}` : formatted
}

interface DRERow {
  label: string
  value: number
  color: string
  bold?: boolean
  separator?: boolean
  indent?: boolean
}

export function GestorDRE({ kpis }: { kpis: GestorKPIs }) {
  const comissoes = kpis.totalComissao
  const lucroBruto = kpis.profit // revenue - CMV
  const resultado = lucroBruto - comissoes

  const rows: DRERow[] = [
    { label: 'Receita Bruta', value: kpis.revenue, color: 'text-[#3B5BDB]' },
    { label: '(-) CMV', value: -kpis.totalCMV, color: 'text-amber-600', indent: true },
    { label: '(=) Lucro Bruto', value: lucroBruto, color: 'text-emerald-600', bold: true },
    { label: '(-) Impostos sobre Vendas', value: 0, color: 'text-rose-500', indent: true },
    { label: '(-) Comissões', value: -comissoes, color: 'text-rose-500', indent: true },
    { label: '(=) Resultado Real', value: resultado, color: resultado >= 0 ? 'text-emerald-700' : 'text-rose-600', bold: true, separator: true },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="bg-white rounded-xl border border-border p-6"
    >
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
        Composição do Resultado
      </h3>
      <div className="space-y-0">
        {rows.map((row, i) => (
          <div key={i} className={`flex items-center justify-between py-3 ${
            row.separator ? 'border-t-2 border-border mt-1 pt-3' : ''
          } ${i > 0 && !row.separator ? 'border-t border-border/50' : ''}`}>
            <span className={`text-sm ${row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${row.indent ? 'pl-3' : ''}`}>
              {row.label}
            </span>
            <span className={`tabular-nums font-mono ${row.bold ? 'font-bold text-base' : 'text-sm font-medium'} ${row.color}`}>
              {fmtMono(row.value)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
