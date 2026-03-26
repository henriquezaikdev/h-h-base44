// ─── Payment Types & Helpers ─────────────────────────────────────────────────

export interface Installment {
  date: string   // "YYYY-MM-DD"
  amount: number
}

export const PAYMENT_METHODS = [
  'PIX',
  'Boleto',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Cheque',
  'Dinheiro',
] as const

export const PAYMENT_TERM_OPTIONS = [
  { value: 'À Vista',       label: 'À Vista',       days: 0 },
  { value: '7 dias',        label: '7 dias',         days: 7 },
  { value: '14 dias',       label: '14 dias',        days: 14 },
  { value: '21 dias',       label: '21 dias',        days: 21 },
  { value: '28 dias',       label: '28 dias',        days: 28 },
  { value: '30 dias',       label: '30 dias',        days: 30 },
  { value: '45 dias',       label: '45 dias',        days: 45 },
  { value: '60 dias',       label: '60 dias',        days: 60 },
  { value: '90 dias',       label: '90 dias',        days: 90 },
  { value: 'Personalizado', label: 'Personalizado',  days: null },
] as const

/** Extract numeric days from a term value. Returns null for custom/unknown. */
export function parseDaysFromTerm(term: string): number | null {
  const opt = PAYMENT_TERM_OPTIONS.find(o => o.value === term)
  if (opt) return opt.days
  const m = term.match(/^(\d+)\s*dias?$/i)
  return m ? Number(m[1]) : null
}

/** Check if a term value is one of the preset options */
export function isPresetTerm(term: string): boolean {
  return PAYMENT_TERM_OPTIONS.some(o => o.value === term)
}

/** Format a date string as DD/MM/YYYY */
export function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Add N days to a date string, returns "YYYY-MM-DD" */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Get today as "YYYY-MM-DD" */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Generate installments based on total, count, and interval days.
 * The last installment absorbs rounding differences.
 */
export function generateInstallments(
  total: number,
  count: number,
  intervalDays: number,
  startDate?: string,
): Installment[] {
  if (count <= 0 || total <= 0) return []

  const base = startDate || todayStr()
  const perInstallment = Math.floor((total / count) * 100) / 100
  const installments: Installment[] = []

  for (let i = 0; i < count; i++) {
    const daysOffset = intervalDays * (i + 1)
    const date = addDaysToDate(base, daysOffset)
    const isLast = i === count - 1
    const amount = isLast
      ? Math.round((total - perInstallment * (count - 1)) * 100) / 100
      : perInstallment

    installments.push({ date, amount })
  }

  return installments
}

/** Sum all installment amounts */
export function installmentsTotal(installments: Installment[]): number {
  return Math.round(installments.reduce((s, i) => s + i.amount, 0) * 100) / 100
}
