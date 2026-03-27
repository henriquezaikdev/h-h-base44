import { useAuth } from '@/hooks/useAuth'
import { useEvolutionData } from '@/hooks/useEvolutionData'
import { cn } from '@/lib/utils'
import { TrendingUp, Zap, AlertTriangle, Loader2 } from 'lucide-react'

// ── Tabela de referência de tiers ────────────────────────────────────────────

const TIERS_NORMAL = [
  { label: '≥ 45%',       rate: '2,0%' },
  { label: '35 – 44,9%',  rate: '1,3%' },
  { label: '20 – 34,9%',  rate: '1,0%' },
  { label: '0,5 – 19,9%', rate: '0,5%' },
  { label: '< 0,5%',      rate: '0%'   },
]

const TIERS_ACELERACAO = [
  { label: '≥ 30%',       rate: '2,0%' },
  { label: '15 – 29,9%',  rate: '1,0%' },
  { label: '0,5 – 14,9%', rate: '0,5%' },
  { label: '< 0,5%',      rate: '0%'   },
]

const NIVEL_LABEL: Record<string, string> = {
  ovo:   'Ovo — Aprendiz',
  pena:  'Pena — Intermediário',
  aguia: 'Águia — Consolidado',
}

const NIVEL_BONUS: Record<string, string> = {
  ovo:   'sem bônus de nível',
  pena:  '+0,5% sobre comissão base',
  aguia: '+1,0% sobre comissão base',
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function pct(v: number) {
  return (v * 100).toFixed(1) + '%'
}

// ── Props (mantém compatibilidade com EvolutionEmbed) ────────────────────────

interface ComissaoNivelTabProps {
  currentMonthSales:      number
  currentMonthOrderCount: number
}

// ── Componente ───────────────────────────────────────────────────────────────

export function ComissaoNivelTab(_props: ComissaoNivelTabProps) {
  const { seller } = useAuth()
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const {
    loading,
    sellerLevel,
    comissaoBase,
    comissaoCategorias,
    comissaoTotal,
    pedidosSemMargem,
    aceleracaoAtiva,
    currentMonthSales,
    currentMonthOrderCount,
  } = useEvolutionData(seller?.id ?? null, month, year)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#3B5BDB]" />
      </div>
    )
  }

  const nivel = sellerLevel?.current_level ?? 'ovo'
  const meta  = sellerLevel?.monthly_sales_target ?? 0

  return (
    <div className="space-y-4">

      {/* ── Nível + Aceleração ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-[#3B5BDB]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] text-gray-500 mb-0.5">Nível atual</p>
            <p className="text-base font-semibold text-gray-900">{NIVEL_LABEL[nivel] ?? nivel}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{NIVEL_BONUS[nivel]}</p>
          </div>
        </div>

        {aceleracaoAtiva && (
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-semibold rounded-lg px-3 py-1.5">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
            Aceleração ativa — ≥ 130% da meta
          </div>
        )}
      </div>

      {/* ── Resumo da comissão ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Resumo do mês</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Vendas"        value={fmt(currentMonthSales)}      />
          <Stat label="Pedidos"       value={String(currentMonthOrderCount)} />
          <Stat label="Meta mensal"   value={fmt(meta)}                   />
          <Stat label="Comissão base" value={fmt(comissaoBase)}           bold />
        </div>

        {comissaoCategorias.length > 0 && (
          <>
            <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
              <p className="text-[13px] text-gray-500">Bônus de categorias</p>
              <p className="text-[13px] font-semibold text-gray-900">
                {fmt(comissaoCategorias.reduce((s, c) => s + c.comissao_bonus, 0))}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[14px] font-semibold text-gray-700">Comissão total estimada</p>
              <p className="text-[16px] font-bold text-[#3B5BDB]">{fmt(comissaoTotal)}</p>
            </div>
          </>
        )}

        {comissaoCategorias.length === 0 && (
          <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
            <p className="text-[14px] font-semibold text-gray-700">Comissão total estimada</p>
            <p className="text-[16px] font-bold text-[#3B5BDB]">{fmt(comissaoTotal)}</p>
          </div>
        )}
      </div>

      {/* ── Bônus por categoria ────────────────────────────────────────────── */}
      {comissaoCategorias.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Bônus por categoria
          </p>
          <div className="space-y-2">
            {comissaoCategorias.map(cat => {
              const atingiu = cat.realizado >= cat.meta && cat.margem_media >= 0.40
              return (
                <div
                  key={cat.category_key}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-4 py-3',
                    atingiu ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900">{cat.category_key}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmt(cat.realizado)} / {fmt(cat.meta)} &nbsp;·&nbsp; margem {pct(cat.margem_media)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {cat.bonus_pct > 0 ? (
                      <>
                        <p className="text-[13px] font-semibold text-emerald-700">+{cat.bonus_pct}%</p>
                        <p className="text-[11px] text-emerald-600">{fmt(cat.comissao_bonus)}</p>
                      </>
                    ) : (
                      <p className="text-[12px] text-gray-400">sem bônus</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {sellerLevel && sellerLevel.errors_this_month >= 4 && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              Bônus de categoria bloqueado: {sellerLevel.errors_this_month} erros este mês (limite 3)
            </div>
          )}
        </div>
      )}

      {/* ── Aviso pedidos sem margem ───────────────────────────────────────── */}
      {pedidosSemMargem > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-[13px] text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>
            <span className="font-semibold">{pedidosSemMargem}</span> pedido{pedidosSemMargem > 1 ? 's' : ''} sem custo cadastrado — não entrou no cálculo de comissão base.
          </span>
        </div>
      )}

      {/* ── Tabela de referência ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Tabela de comissão por margem
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">

          {/* Normal */}
          <div>
            <p className="text-[12px] font-medium text-gray-500 mb-2">Modo normal</p>
            <div className="space-y-1.5">
              {TIERS_NORMAL.map(t => (
                <div key={t.label} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <p className="text-[13px] text-gray-600">{t.label}</p>
                  <p className={cn('text-[13px] font-semibold', t.rate === '0%' ? 'text-gray-400' : 'text-gray-900')}>
                    {t.rate}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Aceleração */}
          <div>
            <p className="text-[12px] font-medium text-gray-500 mb-2">
              Aceleração (≥ 130% da meta)
              {aceleracaoAtiva && (
                <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">ATIVO</span>
              )}
            </p>
            <div className="space-y-1.5">
              {TIERS_ACELERACAO.map(t => (
                <div
                  key={t.label}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2',
                    aceleracaoAtiva ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100'
                  )}
                >
                  <p className={cn('text-[13px]', aceleracaoAtiva ? 'text-emerald-700' : 'text-gray-600')}>{t.label}</p>
                  <p className={cn('text-[13px] font-semibold', t.rate === '0%' ? 'text-gray-400' : aceleracaoAtiva ? 'text-emerald-700' : 'text-gray-900')}>
                    {t.rate}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Stat ─────────────────────────────────────────────────────────────────────

function Stat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={cn('text-[14px] text-gray-900', bold ? 'font-bold text-[#3B5BDB]' : 'font-semibold')}>{value}</p>
    </div>
  )
}
