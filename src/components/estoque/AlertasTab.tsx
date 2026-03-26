import { useState } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import type { Produto } from '../../hooks/useEstoqueData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  alertas: Produto[]
  openPrProductIds: string[]
  companyId: string
  sellerId: string
  onEnviar: (params: {
    companyId: string; sellerId: string
    productId: string; productName: string; quantity: number
  }) => Promise<{ error: string | null }>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertasTab({ alertas, openPrProductIds, companyId, sellerId, onEnviar }: Props) {
  const [sending,   setSending]   = useState<Record<string, boolean>>({})
  const [sent,      setSent]      = useState<Set<string>>(new Set())
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function deficit(p: Produto) {
    return Math.max(0, (p.stock_min ?? 0) - (p.stock_qty ?? 0))
  }

  async function handleEnviar(p: Produto) {
    setSending(prev => ({ ...prev, [p.id]: true }))
    const result = await onEnviar({
      companyId, sellerId, productId: p.id, productName: p.name, quantity: deficit(p),
    })
    setSending(prev => ({ ...prev, [p.id]: false }))
    if (result.error) {
      showToast('Erro ao enviar solicitacao', false)
    } else {
      setSent(prev => new Set(prev).add(p.id))
      showToast('Solicitacao enviada para Compras', true)
    }
  }

  async function handleEnviarTodos() {
    const pending = alertas.filter(p => !openPrProductIds.includes(p.id) && !sent.has(p.id))
    if (pending.length === 0) return
    setSendingAll(true)
    setConfirming(false)
    for (const p of pending) {
      await onEnviar({
        companyId, sellerId, productId: p.id, productName: p.name, quantity: deficit(p),
      })
      setSent(prev => new Set(prev).add(p.id))
    }
    setSendingAll(false)
    showToast(`${pending.length} solicitacoes enviadas para Compras`, true)
  }

  // Group by category
  const grouped = alertas.reduce<Record<string, Produto[]>>((acc, p) => {
    const key = p.product_categories?.name ?? 'Sem categoria'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})
  const groupKeys = Object.keys(grouped).sort()

  const pendingCount = alertas.filter(p => !openPrProductIds.includes(p.id) && !sent.has(p.id)).length

  return (
    <div className="px-6 py-5">

      {/* Toast */}
      {toast && (
        <div className={`mb-4 text-xs px-4 py-2.5 rounded-lg border ${
          toast.ok
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-[#374151]">Produtos que exigem reposicao</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{alertas.length} produto{alertas.length !== 1 ? 's' : ''} abaixo do minimo</p>
        </div>
        {pendingCount > 0 && (
          <>
            {confirming ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-[#374151]">
                  Enviar {pendingCount} produto{pendingCount !== 1 ? 's' : ''} para a fila de compras?
                </p>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviarTodos}
                  disabled={sendingAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors"
                >
                  <Check size={12} />
                  {sendingAll ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={sendingAll}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#3B5BDB] border border-[#3B5BDB] rounded-lg hover:bg-[#EEF2FF] disabled:opacity-50 transition-colors"
              >
                <ShoppingCart size={14} />
                Enviar todos para Compras
              </button>
            )}
          </>
        )}
      </div>

      {alertas.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
          <p className="text-sm text-[#9CA3AF]">Nenhum produto abaixo do minimo no momento.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupKeys.map(groupKey => (
            <div key={groupKey} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">

              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <p className="text-xs font-semibold text-[#374151]">{groupKey}</p>
                <span className="text-[10px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                  {grouped[groupKey].length}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6B7280] w-28">SKU</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6B7280]">Produto</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#6B7280] w-28">Qtd Atual</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#6B7280] w-28">Minimo</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#6B7280] w-24">Deficit</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-[#6B7280] w-36">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[groupKey].map((p, i) => {
                    const def      = deficit(p)
                    const isOpen   = openPrProductIds.includes(p.id)
                    const wasSent  = sent.has(p.id)
                    const isSolicitado = isOpen || wasSent
                    const isSending    = sending[p.id]

                    return (
                      <tr key={p.id} className={`border-b border-[#F3F4F6] last:border-0 ${i > 0 ? '' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">
                          {p.sku ?? <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{p.name}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                          (p.stock_qty ?? 0) <= 0 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {p.stock_qty ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">
                          {p.stock_min ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600">
                          {def}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isSolicitado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
                              <Check size={11} />Solicitado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEnviar(p)}
                              disabled={isSending}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#EEF2FF] text-[#3B5BDB] hover:bg-[#3B5BDB] hover:text-white disabled:opacity-50 transition-colors"
                            >
                              <ShoppingCart size={11} />
                              {isSending ? 'Enviando...' : 'Enviar para Compras'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
