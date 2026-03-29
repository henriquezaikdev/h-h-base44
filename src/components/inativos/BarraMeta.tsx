import { Progress } from '../ui/progress'

const META_DEFAULT = 10

export function BarraMeta({ resgatados, loading }: { resgatados: number; loading: boolean }) {
  const meta = META_DEFAULT
  const pct = Math.min(100, (resgatados / meta) * 100)
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const faltam = meta - resgatados

  const barColor = pct < 30 ? '[&>div]:bg-red-500' : pct < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'

  let texto = ''
  if (pct === 0) texto = 'Nenhuma reativação este mês. Comece pela fila abaixo.'
  else if (pct < 50) texto = `Faltam ${faltam} clientes para bater a meta`
  else if (pct < 100) texto = `Você está quase lá. Faltam ${faltam} clientes.`
  else texto = `Meta batida! Você reativou ${resgatados} clientes este mês.`

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#111827] tabular-nums">{loading ? '–' : resgatados}</span>
          <span className="text-sm text-[#9CA3AF]">/ {meta} reativações em {mesNome}</span>
        </div>
        <span className="text-xs font-medium text-[#6B7280] tabular-nums">{Math.round(pct)}%</span>
      </div>
      <Progress value={loading ? 0 : pct} className={`h-1.5 rounded-full ${barColor}`} />
      <p className={`text-xs mt-2 ${pct >= 100 ? 'text-emerald-600 font-medium' : 'text-[#9CA3AF]'}`}>
        {loading ? '' : texto}
      </p>
    </div>
  )
}
