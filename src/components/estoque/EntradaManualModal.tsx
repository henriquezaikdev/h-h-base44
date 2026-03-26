import { useState } from 'react'
import { Check, X, Plus, Truck } from 'lucide-react'
import type { Produto } from '../../hooks/useEstoqueData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntradaItem {
  productId: string
  quantity: string
  unitCost: string
}

interface Props {
  produtos: Produto[]
  companyId: string
  sellerId: string
  onClose: () => void
  onSave: (params: {
    companyId: string
    sellerId: string
    supplierName: string
    reference: string
    entryDate: string
    items: { productId: string; quantity: number; unitCost: number }[]
  }) => Promise<{ error: string | null }>
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EntradaManualModal({ produtos, companyId, sellerId, onClose, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [supplierName, setSupplierName] = useState('')
  const [reference,    setReference]    = useState('')
  const [entryDate,    setEntryDate]    = useState(today)
  const [items,        setItems]        = useState<EntradaItem[]>([{ productId: '', quantity: '', unitCost: '' }])
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [err,          setErr]          = useState<string | null>(null)

  function setItem(i: number, k: keyof EntradaItem, v: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  }
  function addItem() {
    setItems(prev => [...prev, { productId: '', quantity: '', unitCost: '' }])
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    const validItems = items.filter(it => it.productId && parseFloat(it.quantity) > 0)
    if (validItems.length === 0) {
      setErr('Adicione ao menos um item com produto e quantidade validos.')
      return
    }
    setSaving(true)
    setErr(null)
    const result = await onSave({
      companyId,
      sellerId,
      supplierName,
      reference,
      entryDate,
      items: validItems.map(it => ({
        productId: it.productId,
        quantity:  parseFloat(it.quantity),
        unitCost:  parseFloat(it.unitCost.replace(',', '.')) || 0,
      })),
    })
    setSaving(false)
    if (result.error) {
      setToast({ msg: 'Erro ao registrar entrada', ok: false })
      setErr(result.error)
    } else {
      setToast({ msg: 'Entrada registrada com sucesso', ok: true })
      setTimeout(onClose, 900)
    }
  }

  const totalValue = items.reduce((s, it) => {
    const qty  = parseFloat(it.quantity)  || 0
    const cost = parseFloat(it.unitCost.replace(',', '.')) || 0
    return s + qty * cost
  }, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <Truck size={15} className="text-[#3B5BDB]" />
            </div>
            <h2 className="text-sm font-semibold text-[#111827]">Registrar Entrada Manual</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {toast && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              toast.ok
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {toast.msg}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Fornecedor">
              <input
                value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                className={inputCls}
              />
            </Field>
            <Field label="Referencia / NF">
              <input
                value={reference} onChange={e => setReference(e.target.value)}
                placeholder="Ex: NF-000123"
                className={inputCls}
              />
            </Field>
            <Field label="Data">
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
            </Field>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#6B7280]">Itens</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:underline">
                <Plus size={12} />Adicionar item
              </button>
            </div>

            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_100px_32px] gap-0 bg-[#F9FAFB] border-b border-[#E5E7EB] px-3 py-2">
                <p className="text-xs font-medium text-[#6B7280]">Produto</p>
                <p className="text-xs font-medium text-[#6B7280]">Quantidade</p>
                <p className="text-xs font-medium text-[#6B7280]">Custo Unit.</p>
                <span />
              </div>
              {items.map((it, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1fr_100px_100px_32px] gap-2 items-center px-3 py-2 ${
                    i > 0 ? 'border-t border-[#F3F4F6]' : ''
                  }`}
                >
                  <select
                    value={it.productId}
                    onChange={e => setItem(i, 'productId', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecione...</option>
                    {produtos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` (${p.sku})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="0.001" step="any"
                    value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                  <input
                    value={it.unitCost} onChange={e => setItem(i, 'unitCost', e.target.value)}
                    placeholder="0,00"
                    className={inputCls}
                  />
                  {items.length > 1 ? (
                    <button
                      onClick={() => removeItem(i)}
                      className="p-1 text-[#9CA3AF] hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>

            {totalValue > 0 && (
              <p className="text-xs text-[#6B7280] mt-2 text-right">
                Total:{' '}
                <span className="font-semibold text-[#111827]">
                  {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                {' '}&mdash; sera lancado em Contas a Pagar
              </p>
            )}
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9] shrink-0">
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
            {saving ? 'Salvando...' : 'Registrar Entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}
