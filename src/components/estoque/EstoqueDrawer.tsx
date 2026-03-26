import { useState, useEffect } from 'react'
import { X, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Produto, MovType } from '../../hooks/useEstoqueData'
import MovimentacaoModal from './MovimentacaoModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Movimento {
  id: string
  type: MovType
  quantity: number
  reason: string
  created_at: string
}

interface Props {
  produto: Produto
  produtos: Produto[]
  companyId: string
  sellerId: string
  onClose: () => void
  onRegistrar: (params: {
    productId: string; type: MovType; quantity: number
    reason: string; date: string; companyId: string; sellerId: string
  }) => Promise<{ error: string | null }>
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<MovType, { label: string; cls: string }> = {
  ENTRADA: { label: 'Entrada', cls: 'bg-emerald-50 text-emerald-700' },
  SAIDA:   { label: 'Saida',   cls: 'bg-red-50 text-red-700'         },
  AJUSTE:  { label: 'Ajuste',  cls: 'bg-gray-100 text-gray-600'      },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EstoqueDrawer({
  produto, produtos, companyId, sellerId, onClose, onRegistrar,
}: Props) {
  const [movimentos,   setMovimentos]   = useState<Movimento[]>([])
  const [loadingMov,   setLoadingMov]   = useState(true)
  const [showModal,    setShowModal]    = useState(false)

  async function loadMovimentos() {
    setLoadingMov(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('id, type, quantity, reason, created_at')
      .eq('product_id', produto.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setMovimentos((data ?? []) as Movimento[])
    setLoadingMov(false)
  }

  useEffect(() => { loadMovimentos() }, [produto.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const thirtyDaysAgo = Date.now() - 30 * 86_400_000
  const entradas30d   = movimentos
    .filter(m => m.type === 'ENTRADA' && new Date(m.created_at).getTime() >= thirtyDaysAgo)
    .reduce((s, m) => s + m.quantity, 0)
  const saidas30d = movimentos
    .filter(m => m.type === 'SAIDA' && new Date(m.created_at).getTime() >= thirtyDaysAgo)
    .reduce((s, m) => s + m.quantity, 0)

  const miniCards = [
    { label: 'Saldo Atual',  value: String(produto.stock_qty ?? 0) },
    { label: 'Minimo',       value: produto.stock_min != null ? String(produto.stock_min) : '—' },
    { label: 'Entradas 30d', value: String(entradas30d) },
    { label: 'Saidas 30d',   value: String(saidas30d)   },
  ]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-[#E5E7EB] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-start justify-between shrink-0">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{produto.name}</p>
            {produto.sku && <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">{produto.sku}</p>}
            {produto.product_categories?.name && (
              <p className="text-xs text-[#6B7280] mt-0.5">{produto.product_categories.name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors shrink-0 ml-2">
            <X size={15} />
          </button>
        </div>

        {/* Mini KPI cards */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-[#E5E7EB] shrink-0">
          {miniCards.map(c => (
            <div key={c.label} className="bg-[#FAFAF9] border border-[#E5E7EB] rounded-xl p-3">
              <p className="text-xs text-[#6B7280] mb-1">{c.label}</p>
              <p className="text-xl font-semibold text-[#111827] tabular-nums leading-tight">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Movements */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold text-[#374151] mb-3">Historico de Movimentacoes</p>

          {loadingMov ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : movimentos.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-10">Nenhuma movimentacao registrada.</p>
          ) : (
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium text-[#6B7280]">Qtd</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.map((m, i) => {
                    const cfg = TYPE_CFG[m.type]
                    return (
                      <tr key={m.id} className={`border-b border-[#F3F4F6] last:border-0 ${i > 0 ? '' : ''}`}>
                        <td className="px-3 py-2 text-[#6B7280] whitespace-nowrap">{fmtDate(m.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-[#111827]">
                          {m.quantity}
                        </td>
                        <td className="px-3 py-2 text-[#6B7280] max-w-[130px] truncate" title={m.reason}>
                          {m.reason}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E5E7EB] shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
          >
            <Package size={14} />
            Registrar Movimentacao
          </button>
        </div>
      </div>

      {showModal && (
        <MovimentacaoModal
          produtos={produtos}
          companyId={companyId}
          sellerId={sellerId}
          preSelectedProductId={produto.id}
          onClose={() => setShowModal(false)}
          onSave={async params => {
            const result = await onRegistrar(params)
            if (!result.error) await loadMovimentos()
            return result
          }}
        />
      )}
    </>
  )
}
