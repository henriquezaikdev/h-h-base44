import { useEffect } from 'react'
import {
  PAYMENT_METHODS,
  PAYMENT_TERM_OPTIONS,
  parseDaysFromTerm,
  generateInstallments,
  installmentsTotal,
  fmtDateShort,
  type Installment,
} from './paymentUtils'

// ─── Props ───────────────────────────────────────────────────────────────────

interface PaymentSectionProps {
  paymentMethod: string
  onPaymentMethodChange: (v: string) => void
  paymentTerm: string
  onPaymentTermChange: (v: string) => void
  customTerm: string
  onCustomTermChange: (v: string) => void
  numInstallments: number
  onNumInstallmentsChange: (v: number) => void
  installments: Installment[]
  onInstallmentsChange: (v: Installment[]) => void
  total: number
  inputCls: string
  labelCls: string
  /** Title component — pass null to skip section header */
  sectionTitle?: React.ReactNode
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentSection({
  paymentMethod,
  onPaymentMethodChange,
  paymentTerm,
  onPaymentTermChange,
  customTerm,
  onCustomTermChange,
  numInstallments,
  onNumInstallmentsChange,
  installments,
  onInstallmentsChange,
  total,
  inputCls,
  labelCls,
  sectionTitle,
}: PaymentSectionProps) {

  const isAVista = paymentTerm === 'À Vista'
  const isCustom = paymentTerm === 'Personalizado'
  const showInstallments = !isAVista && paymentTerm !== ''

  // ── Auto-generate installments when term, count or total changes ─────

  useEffect(() => {
    if (isAVista || paymentTerm === '') {
      if (installments.length > 0) onInstallmentsChange([])
      return
    }
    if (isCustom) return
    const days = parseDaysFromTerm(paymentTerm)
    if (days === null || days === 0 || total <= 0) {
      if (installments.length > 0) onInstallmentsChange([])
      return
    }
    onInstallmentsChange(generateInstallments(total, numInstallments, days))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentTerm, numInstallments, total])

  // ── Handlers ───────────────────────────────────────────────────────────

  function handleTermChange(value: string) {
    onPaymentTermChange(value)
    if (value === 'À Vista' || value === '') {
      onInstallmentsChange([])
      onNumInstallmentsChange(1)
    }
  }

  function handleCountChange(count: number) {
    const clamped = Math.min(12, Math.max(1, count))
    onNumInstallmentsChange(clamped)
    // For preset terms, the useEffect handles regeneration via [numInstallments] dep
    // For custom term, generate manually since useEffect skips custom
    if (isCustom && total > 0) {
      const perInstallment = Math.floor((total / clamped) * 100) / 100
      const newInstallments: Installment[] = []
      for (let i = 0; i < clamped; i++) {
        const existing = installments[i]
        const isLast = i === clamped - 1
        newInstallments.push({
          date: existing?.date ?? '',
          amount: isLast
            ? Math.round((total - perInstallment * (clamped - 1)) * 100) / 100
            : perInstallment,
        })
      }
      onInstallmentsChange(newInstallments)
    }
  }

  function updateInstallment(index: number, field: 'date' | 'amount', value: string | number) {
    const updated = installments.map((inst, i) => {
      if (i !== index) return inst
      if (field === 'date') return { ...inst, date: value as string }
      return { ...inst, amount: Number(value) || 0 }
    })
    onInstallmentsChange(updated)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const instTotal = installmentsTotal(installments)
  const totalMismatch = installments.length > 0 && Math.abs(instTotal - total) > 0.01

  return (
    <div>
      {sectionTitle}
      <div className="grid grid-cols-2 gap-4">
        {/* Forma de pagamento */}
        <div>
          <label className={labelCls}>Forma de pagamento</label>
          <select
            value={paymentMethod}
            onChange={e => onPaymentMethodChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecionar…</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Condição de pagamento */}
        <div>
          <label className={labelCls}>Condição de pagamento</label>
          <select
            value={paymentTerm}
            onChange={e => handleTermChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecionar…</option>
            {PAYMENT_TERM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Campo personalizado */}
        {isCustom && (
          <div className="col-span-2">
            <label className={labelCls}>Descreva a condição</label>
            <input
              type="text"
              placeholder="Ex: 30/60/90 dias, dia 10 e dia 25…"
              value={customTerm}
              onChange={e => onCustomTermChange(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

      </div>

      {/* Número de parcelas — fora do grid de 2 colunas */}
      {showInstallments && (
        <div className="mt-4 max-w-[200px]">
          <label className={labelCls}>Parcelas</label>
          <input
            type="number"
            min={1}
            max={12}
            value={numInstallments}
            onChange={e => handleCountChange(Number(e.target.value) || 1)}
            className={inputCls}
          />
        </div>
      )}

      {/* ── Grid de parcelas ─────────────────────────────────────────────── */}
      {showInstallments && installments.length > 0 && (
        <div className="mt-4 border border-[#E5E7EB] rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[48px_1fr_1fr] gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <span className="text-[10px] font-medium text-[#6B7280]">#</span>
            <span className="text-[10px] font-medium text-[#6B7280]">Vencimento</span>
            <span className="text-[10px] font-medium text-[#6B7280]">Valor</span>
          </div>

          {/* Rows */}
          {installments.map((inst, i) => (
            <div
              key={i}
              className="grid grid-cols-[48px_1fr_1fr] gap-2 px-3 py-2 border-b border-[#F3F4F6] last:border-b-0 items-center"
            >
              <span className="text-xs text-[#9CA3AF] font-medium">
                {i + 1}/{installments.length}
              </span>
              <input
                type="date"
                value={inst.date}
                onChange={e => updateInstallment(i, 'date', e.target.value)}
                className="w-full text-sm border border-[#E5E7EB] rounded px-2 py-1 outline-none focus:border-[#3B5BDB] text-[#111827]"
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={inst.amount}
                onChange={e => updateInstallment(i, 'amount', e.target.value)}
                className="w-full text-sm border border-[#E5E7EB] rounded px-2 py-1 outline-none focus:border-[#3B5BDB] text-right tabular-nums text-[#111827]"
              />
            </div>
          ))}

          {/* Footer: total */}
          <div className="px-3 py-2 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">Total das parcelas</span>
            <span className={`text-sm font-semibold tabular-nums ${totalMismatch ? 'text-red-600' : 'text-[#111827]'}`}>
              {fmt(instTotal)}
              {totalMismatch && (
                <span className="text-[10px] font-normal text-red-500 ml-2">
                  (diferença: {fmt(instTotal - total)})
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Read-only display for installments ──────────────────────────────────────

export function InstallmentsDisplay({ installments }: { installments: Installment[] }) {
  if (!installments || installments.length === 0) return null

  return (
    <div className="mt-2 border border-[#F3F4F6] rounded-lg overflow-hidden">
      {installments.map((inst, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-3 py-1.5 border-b border-[#F3F4F6] last:border-b-0"
        >
          <span className="text-xs text-[#6B7280]">
            Parcela {i + 1}/{installments.length} — {fmtDateShort(inst.date)}
          </span>
          <span className="text-xs font-medium text-[#111827] tabular-nums">
            {fmt(inst.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
