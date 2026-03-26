import { useState } from 'react'
import { Check, X, ArrowLeftRight } from 'lucide-react'
import type { Produto, MovType } from '../../hooks/useEstoqueData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  produtos: Produto[]
  companyId: string
  sellerId: string
  preSelectedProductId?: string
  onClose: () => void
  onSave: (params: {
    productId: string
    type: MovType
    quantity: number
    reason: string
    date: string
    companyId: string
    sellerId: string
  }) => Promise<{ error: string | null }>
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MovimentacaoModal({
  produtos, companyId, sellerId, preSelectedProductId, onClose, onSave,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [productId, setProductId] = useState(preSelectedProductId ?? '')
  const [type,      setType]      = useState<MovType>('ENTRADA')
  const [qty,       setQty]       = useState('')
  const [reason,    setReason]    = useState('')
  const [date,      setDate]      = useState(today)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [errs,      setErrs]      = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!productId)                   e.productId = 'Selecione um produto'
    if (!qty || parseFloat(qty) <= 0) e.qty       = 'Quantidade deve ser maior que zero'
    if (!reason.trim())               e.reason    = 'Motivo e obrigatorio'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const result = await onSave({
      productId, type, quantity: parseFloat(qty), reason: reason.trim(), date, companyId, sellerId,
    })
    setSaving(false)
    if (result.error) {
      setToast({ msg: 'Erro ao registrar movimentacao', ok: false })
    } else {
      setToast({ msg: 'Movimentacao registrada', ok: true })
      setTimeout(onClose, 900)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <ArrowLeftRight size={15} className="text-[#3B5BDB]" />
            </div>
            <h2 className="text-sm font-semibold text-[#111827]">Registrar Movimentacao</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {toast && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              toast.ok
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {toast.msg}
            </div>
          )}

          <Field label="Produto" error={errs.productId}>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              disabled={!!preSelectedProductId}
              className={inputCls}
            >
              <option value="">Selecione um produto...</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sku ? ` — ${p.sku}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select value={type} onChange={e => setType(e.target.value as MovType)} className={inputCls}>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saida</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
            </Field>
            <Field label="Quantidade" error={errs.qty}>
              <input
                type="number" min="0.001" step="any"
                value={qty} onChange={e => setQty(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Motivo" error={errs.reason}>
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ex: Compra fornecedor, Ajuste inventario"
              className={inputCls}
            />
          </Field>

          <Field label="Data">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9]">
          <button
            onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors"
          >
            <Check size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
