import { Target, ArrowUpRight, TrendingUp, DollarSign } from 'lucide-react'

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

interface Props {
  totalInativos: number
  emReativacao: number
  resgatados: number
  receita: number
  loading: boolean
}

const METRICS = [
  { key: 'inativos',  label: 'Inativos',       icon: Target,       color: 'text-red-500',      bg: 'bg-red-50' },
  { key: 'reativacao', label: 'Em reativação',  icon: ArrowUpRight, color: 'text-amber-500',    bg: 'bg-amber-50' },
  { key: 'resgatados', label: 'Resgatados',     icon: TrendingUp,   color: 'text-emerald-500',  bg: 'bg-emerald-50' },
  { key: 'receita',   label: 'Recuperado',      icon: DollarSign,   color: 'text-[#3B5BDB]',   bg: 'bg-[#EEF2FF]' },
] as const

export function PainelGuerra({ totalInativos, emReativacao, resgatados, receita, loading }: Props) {
  const values: Record<string, string> = {
    inativos: String(totalInativos),
    reativacao: String(emReativacao),
    resgatados: String(resgatados),
    receita: money(receita),
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {METRICS.map(({ key, label, icon: Ic, color, bg }) => (
        <div key={key} className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold text-[#111827] mt-1.5 tabular-nums leading-none">
              {loading ? '–' : values[key]}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
            <Ic size={18} className={color} strokeWidth={1.75} />
          </div>
        </div>
      ))}
    </div>
  )
}
