import { useState, useMemo, useRef } from 'react'
import {
  DollarSign, AlertTriangle, TrendingDown, Tag,
  Search, ChevronLeft, ChevronRight, Upload, FileText,
  X, Check, ShoppingCart, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id: string
  sku: string | null
  name: string
  category_id: string | null
  stock_qty: number
  stock_min: number | null
  cost: number | null
  product_categories: { id: string; name: string } | null
}

interface Categoria { id: string; name: string }

interface EntradaItem {
  id: string
  product_id: string | null
  qty: number
  unit_cost: number | null
}

interface Entrada {
  id: string
  supplier_name: string | null
  nf_number: string | null
  nf_date: string | null
  total_value: number
  status: 'LANCADA' | 'RASCUNHO'
  created_at: string
  stock_entry_items: EntradaItem[]
}

interface PageData {
  produtos: Produto[]
  categorias: Categoria[]
  entradas: Entrada[]
}

type ProdStatus = 'ruptura' | 'baixo' | 'ok'
type PillKey   = 'all' | 'ruptura' | 'baixo' | 'semcusto'
type TabKey    = 'posicao' | 'entradas' | 'alertas'

// ─── XML NF-e Types ───────────────────────────────────────────────────────────

interface NFeItem {
  code: string
  name: string
  quantity: number
  unitPrice: number
  unit: string
  total: number
  matchedProductId: string | null
  matchedProductName: string | null
}

interface NFeData {
  supplierName: string
  cnpj: string
  nfNumber: string
  emissionDate: string
  totalValue: number
  items: NFeItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number | null) {
  if (v === null || v === 0) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function getStatus(p: Produto): ProdStatus {
  if ((p.stock_qty ?? 0) <= 0)                                                   return 'ruptura'
  if (p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0))          return 'baixo'
  return 'ok'
}

const STATUS_CFG: Record<ProdStatus, { label: string; badge: string; qty: string }> = {
  ruptura: { label: 'Ruptura', badge: 'bg-red-50 text-red-700',     qty: 'text-red-600'   },
  baixo:   { label: 'Baixo',   badge: 'bg-amber-50 text-amber-700', qty: 'text-amber-600' },
  ok:      { label: 'OK',      badge: 'bg-gray-100 text-gray-500',  qty: 'text-[#111827]' },
}

const STATUS_ORDER: Record<ProdStatus, number> = { ruptura: 0, baixo: 1, ok: 2 }

// ─── XML Parser (NF-e) ────────────────────────────────────────────────────────

function parseNFe(xmlString: string, produtos: Produto[]): NFeData | null {
  try {
    const parser = new DOMParser()
    const doc    = parser.parseFromString(xmlString, 'application/xml')
    if (doc.querySelector('parsererror')) return null

    const getText = (sel: string) => doc.querySelector(sel)?.textContent?.trim() ?? ''

    const supplierName  = getText('emit xNome') || getText('emit xFant')
    const cnpj          = getText('emit CNPJ')
    const nfNumber      = getText('ide nNF')
    const rawDate       = getText('ide dhEmi') || getText('ide dEmi')
    const emissionDate  = rawDate ? rawDate.slice(0, 10) : ''
    const totalValue    = parseFloat(getText('total ICMSTot vNF').replace(',', '.')) || 0

    const detNodes = doc.querySelectorAll('det')
    const items: NFeItem[] = []

    detNodes.forEach(det => {
      const code      = det.querySelector('prod cProd')?.textContent?.trim() ?? ''
      const name      = det.querySelector('prod xProd')?.textContent?.trim() ?? ''
      const quantity  = parseFloat(det.querySelector('prod qCom')?.textContent?.replace(',', '.') ?? '0') || 0
      const unitPrice = parseFloat(det.querySelector('prod vUnCom')?.textContent?.replace(',', '.') ?? '0') || 0
      const unit      = det.querySelector('prod uCom')?.textContent?.trim() ?? ''

      // Try to match product by SKU first, then fuzzy name
      let matched: Produto | undefined
      matched = produtos.find(p => p.sku?.toUpperCase() === code.toUpperCase())
      if (!matched) {
        const nameLower = name.toLowerCase()
        matched = produtos.find(p => p.name.toLowerCase().includes(nameLower.slice(0, 8)))
      }

      items.push({
        code, name, quantity, unitPrice, unit,
        total: quantity * unitPrice,
        matchedProductId:   matched?.id   ?? null,
        matchedProductName: matched?.name ?? null,
      })
    })

    if (!supplierName && items.length === 0) return null

    return { supplierName, cnpj, nfNumber, emissionDate, totalValue, items }
  } catch {
    return null
  }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── XML Import Modal ─────────────────────────────────────────────────────────

interface XMLImportProps {
  produtos: Produto[]
  companyId: string
  sellerId: string
  onClose: () => void
  onSaved: () => void
}

function XMLImportModal({ produtos, companyId, sellerId, onClose, onSaved }: XMLImportProps) {
  type Step = 'input' | 'preview' | 'saving' | 'done'

  const fileRef            = useRef<HTMLInputElement>(null)
  const [step,    setStep] = useState<Step>('input')
  const [xmlText, setXmlText] = useState('')
  const [nfe,     setNfe]  = useState<NFeData | null>(null)
  const [parseErr,setParseErr] = useState<string | null>(null)
  const [saveErr, setSaveErr]  = useState<string | null>(null)

  // Per-item product override
  const [overrides, setOverrides] = useState<Record<number, string>>({})

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => { setXmlText(e.target?.result as string ?? '') }
    reader.readAsText(file, 'UTF-8')
  }

  function handleParse() {
    setParseErr(null)
    if (!xmlText.trim()) { setParseErr('Cole ou carregue um arquivo XML.'); return }
    const result = parseNFe(xmlText, produtos)
    if (!result) { setParseErr('XML inválido ou formato não reconhecido. Verifique se é um arquivo NF-e.'); return }
    setNfe(result)
    setStep('preview')
  }

  async function handleConfirm() {
    if (!nfe) return
    setStep('saving')
    setSaveErr(null)

    const { data: entry, error: entryErr } = await supabase
      .from('stock_entries')
      .insert({
        company_id:    companyId,
        supplier_name: nfe.supplierName || null,
        nf_number:     nfe.nfNumber     || null,
        nf_date:       nfe.emissionDate || null,
        total_value:   nfe.totalValue,
        status:        'LANCADA',
        created_by:    sellerId,
      })
      .select('id')
      .single()

    if (entryErr || !entry) {
      setSaveErr(entryErr?.message ?? 'Erro ao criar entrada')
      setStep('preview')
      return
    }

    // Insert items + update stock_qty
    for (let i = 0; i < nfe.items.length; i++) {
      const item     = nfe.items[i]
      const prodId   = overrides[i] ?? item.matchedProductId

      await supabase.from('stock_entry_items').insert({
        entry_id:   entry.id,
        product_id: prodId || null,
        qty:        item.quantity,
        unit_cost:  item.unitPrice,
      })

      if (prodId) {
        const prod = produtos.find(p => p.id === prodId)
        if (prod) {
          const newQty = (prod.stock_qty ?? 0) + item.quantity
          await supabase.from('products').update({ stock_qty: newQty }).eq('id', prodId)
          await supabase.from('stock_movements').insert({
            company_id: companyId, product_id: prodId, type: 'xml_import',
            quantity: item.quantity, reason: `NF ${nfe.nfNumber || nfe.supplierName}`, created_by: sellerId,
          })
        }
      }
    }

    // Create fin_payable
    if (nfe.totalValue > 0) {
      await supabase.from('fin_payables').insert({
        company_id:  companyId,
        description: `NF ${nfe.nfNumber} — ${nfe.supplierName}`,
        amount:      nfe.totalValue,
        due_date:    nfe.emissionDate || null,
        status:      'pending',
        origin:      'stock_entry',
        origin_id:   entry.id,
      })
    }

    setStep('done')
    setTimeout(() => { onSaved(); onClose() }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <FileText size={15} className="text-[#3B5BDB]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Importar XML de NF</h2>
              <p className="text-xs text-[#9CA3AF]">
                {step === 'input' ? 'Cole o XML ou carregue o arquivo' : step === 'preview' ? 'Revise os dados antes de confirmar' : step === 'done' ? 'Importacao concluida' : 'Salvando...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Step: input */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <input
                  ref={fileRef} type="file" accept=".xml,text/xml"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#3B5BDB] border border-[#3B5BDB] rounded-lg hover:bg-[#EEF2FF] transition-colors mb-3"
                >
                  <Upload size={14} />Carregar arquivo .xml
                </button>
                <Field label="Ou cole o XML abaixo">
                  <textarea
                    value={xmlText}
                    onChange={e => setXmlText(e.target.value)}
                    rows={12}
                    placeholder="<?xml version=&quot;1.0&quot;?>&#10;<nfeProc>..."
                    className="w-full text-xs font-mono border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#374151] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white resize-none"
                  />
                </Field>
              </div>
              {parseErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{parseErr}</p>
              )}
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && nfe && (
            <div className="space-y-5">

              {/* NF summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FAFAF9] border border-[#E5E7EB] rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-[#374151]">Dados da NF</p>
                  <div className="space-y-1">
                    <p className="text-xs text-[#6B7280]">Fornecedor: <span className="font-medium text-[#111827]">{nfe.supplierName || '—'}</span></p>
                    <p className="text-xs text-[#6B7280]">NF: <span className="font-medium text-[#111827]">{nfe.nfNumber || '—'}</span></p>
                    <p className="text-xs text-[#6B7280]">Data: <span className="font-medium text-[#111827]">{fmtDate(nfe.emissionDate)}</span></p>
                    <p className="text-xs text-[#6B7280]">CNPJ: <span className="font-mono text-[#111827]">{nfe.cnpj || '—'}</span></p>
                  </div>
                </div>
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-4 flex flex-col justify-between">
                  <p className="text-xs font-semibold text-[#3B5BDB]">Valor Total</p>
                  <p className="text-2xl font-semibold text-[#3B5BDB] tabular-nums">
                    {nfe.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-xs text-[#6B7280]">Lancamento automatico em Contas a Pagar</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-2">
                  Itens ({nfe.items.length}) — vincule os produtos do sistema
                </p>
                <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Item NF</th>
                        <th className="px-3 py-2 text-right font-medium text-[#6B7280] w-16">Qtd</th>
                        <th className="px-3 py-2 text-right font-medium text-[#6B7280] w-24">Preco Unit</th>
                        <th className="px-3 py-2 text-left font-medium text-[#6B7280] w-48">Produto no Sistema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfe.items.map((item, i) => {
                        const selectedId = overrides[i] ?? item.matchedProductId
                        return (
                          <tr key={i} className="border-b border-[#F3F4F6] last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium text-[#111827] truncate max-w-[160px]" title={item.name}>{item.name}</p>
                              <p className="text-[10px] text-[#9CA3AF] font-mono">{item.code} · {item.unit}</p>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{item.quantity}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-[#374151]">
                              {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={selectedId ?? ''}
                                onChange={e => setOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                                className="w-full text-xs border border-[#E5E7EB] rounded-lg px-2 py-1 text-[#111827] outline-none focus:border-[#3B5BDB] bg-white"
                              >
                                <option value="">Sem vinculo</option>
                                {produtos.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                                ))}
                              </select>
                              {!selectedId && (
                                <p className="text-[10px] text-amber-600 mt-0.5">Nao vinculado — estoque nao sera atualizado</p>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {saveErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{saveErr}</p>
              )}
            </div>
          )}

          {/* Step: saving / done */}
          {(step === 'saving' || step === 'done') && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              {step === 'saving' ? (
                <>
                  <div className="w-7 h-7 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#6B7280]">Importando nota fiscal...</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Check size={20} className="text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-[#111827]">NF importada com sucesso</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'input' || step === 'preview') && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9] shrink-0">
            {step === 'preview' && (
              <button onClick={() => setStep('input')} className="px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                Voltar
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors">
              Cancelar
            </button>
            {step === 'input' && (
              <button
                onClick={handleParse}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
              >
                <ChevronRight size={14} />Processar XML
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
              >
                <Check size={14} />Confirmar Importacao
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Entry Detail Drawer ──────────────────────────────────────────────────────

function EntradaDrawer({ entrada, produtos, onClose }: {
  entrada: Entrada; produtos: Produto[]; onClose: () => void
}) {
  const STATUS_CFG = {
    LANCADA:  { label: 'Lancada',  cls: 'bg-emerald-50 text-emerald-700' },
    RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-500'      },
  }
  const cfg = STATUS_CFG[entrada.status]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-[#E5E7EB] flex flex-col">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-start justify-between shrink-0">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{entrada.supplier_name ?? 'Fornecedor nao informado'}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{entrada.nf_number ?? '—'} · {fmtDate(entrada.nf_date)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"><X size={15} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold text-[#374151] mb-3">Itens ({entrada.stock_entry_items.length})</p>
          {entrada.stock_entry_items.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-10">Nenhum item registrado.</p>
          ) : (
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="px-3 py-2 text-left font-medium text-[#6B7280]">Produto</th>
                    <th className="px-3 py-2 text-right font-medium text-[#6B7280]">Qtd</th>
                    <th className="px-3 py-2 text-right font-medium text-[#6B7280]">Custo Unit</th>
                    <th className="px-3 py-2 text-right font-medium text-[#6B7280]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entrada.stock_entry_items.map((it, i) => {
                    const prod  = produtos.find(p => p.id === it.product_id)
                    const total = (it.qty ?? 0) * (it.unit_cost ?? 0)
                    return (
                      <tr key={it.id} className={`border-b border-[#F3F4F6] last:border-0 ${i > 0 ? '' : ''}`}>
                        <td className="px-3 py-2 font-medium text-[#111827]">
                          {prod?.name ?? <span className="text-[#9CA3AF]">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{it.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{fmtBRL(it.unit_cost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-[#111827]">{fmtBRL(total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#E5E7EB] shrink-0 flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">Valor total</p>
          <p className="text-sm font-semibold text-[#111827]">
            {(entrada.total_value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Aba 1: Posicao de Estoque ────────────────────────────────────────────────

const PAGE_SIZE = 50

function PosicaoEstoqueTab({
  produtos, categorias,
}: {
  produtos: Produto[]; categorias: Categoria[]
}) {
  const [pill,       setPill]       = useState<PillKey>('all')
  const [search,     setSearch]     = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page,       setPage]       = useState(1)

  const hasFilter = pill !== 'all' || search.trim() !== '' || categoryId !== ''

  function clearFilters() { setPill('all'); setSearch(''); setCategoryId(''); setPage(1) }

  const kpis = useMemo(() => ({
    custoTotal:   produtos.reduce((s, p) => s + (p.cost ?? 0) * (p.stock_qty ?? 0), 0),
    ruptura:      produtos.filter(p => (p.stock_qty ?? 0) <= 0).length,
    baixo:        produtos.filter(p => (p.stock_qty ?? 0) > 0 && p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0)).length,
    semCusto:     produtos.filter(p => !p.cost || p.cost === 0).length,
  }), [produtos])

  const visible = useMemo(() => {
    let list = produtos
    if (pill === 'ruptura')  list = list.filter(p => (p.stock_qty ?? 0) <= 0)
    if (pill === 'baixo')    list = list.filter(p => (p.stock_qty ?? 0) > 0 && p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0))
    if (pill === 'semcusto') list = list.filter(p => !p.cost || p.cost === 0)
    if (categoryId) list = list.filter(p => p.category_id === categoryId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const d = STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]
      return d !== 0 ? d : a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [produtos, pill, categoryId, search])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const paginated  = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const kpiCards = [
    { label: 'Custo Total Estoque',  value: kpis.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), icon: DollarSign, iconBg: 'bg-[#EEF2FF]', iconCls: 'text-[#3B5BDB]', badge: null },
    { label: 'Em Ruptura',           value: String(kpis.ruptura),  icon: AlertTriangle, iconBg: 'bg-red-50',    iconCls: 'text-red-500',    badge: kpis.ruptura  > 0 ? 'bg-red-500 text-white'  : null },
    { label: 'Estoque Baixo',        value: String(kpis.baixo),    icon: TrendingDown,  iconBg: 'bg-amber-50',  iconCls: 'text-amber-500',  badge: kpis.baixo    > 0 ? 'bg-amber-400 text-white' : null },
    { label: 'Sem Custo Cadastrado', value: String(kpis.semCusto), icon: Tag,           iconBg: 'bg-gray-50',   iconCls: 'text-gray-400',   badge: null },
  ]

  return (
    <div className="px-6 py-5">

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpiCards.map(k => (
          <div key={k.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280] mb-1">{k.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-[#111827] tabular-nums leading-tight">{k.value}</p>
                  {k.badge && (
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${k.badge}`}>!</span>
                  )}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                <k.icon size={15} className={k.iconCls} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          {([
            { key: 'all',      label: 'Todos'    },
            { key: 'ruptura',  label: 'Ruptura'  },
            { key: 'baixo',    label: 'Baixo'    },
            { key: 'semcusto', label: 'Sem Custo'},
          ] as { key: PillKey; label: string }[]).map(p => (
            <button
              key={p.key}
              onClick={() => { setPill(p.key); setPage(1) }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                pill === p.key
                  ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#3B5BDB] hover:text-[#3B5BDB]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(1) }}
          className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white"
        >
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome ou SKU"
            className="pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg w-52 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white text-[#111827] placeholder-[#9CA3AF] transition"
          />
        </div>

        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-[#6B7280] hover:text-[#111827] hover:underline transition-colors">
            Limpar filtros
          </button>
        )}

        <p className="ml-auto text-xs text-[#9CA3AF]">{visible.length} produtos</p>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
          <p className="text-sm text-[#9CA3AF]">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-28">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-28">Qtd Atual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-28">Custo Unit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p, i) => {
                  const status = getStatus(p)
                  const cfg    = STATUS_CFG[status]
                  return (
                    <tr key={p.id} className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF9] transition-colors ${i > 0 ? '' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">{p.sku ?? <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-4 py-3 font-medium text-[#111827]">{p.name}</td>
                      <td className="px-4 py-3 text-xs text-[#6B7280]">{p.product_categories?.name ?? <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${cfg.qty}`}>{p.stock_qty ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#111827]">{fmtBRL(p.cost)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#9CA3AF]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} de {visible.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                  .reduce<(number | '…')[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) => n === '…'
                    ? <span key={`e${i}`} className="px-1 text-xs text-[#9CA3AF]">…</span>
                    : <button key={n} onClick={() => setPage(n as number)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${page === n ? 'bg-[#3B5BDB] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}>
                        {n}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Aba 2: Entradas e Importacao ─────────────────────────────────────────────

function EntradasTab({
  entradas, produtos, companyId, sellerId, onRefetch,
}: {
  entradas: Entrada[]; produtos: Produto[]
  companyId: string; sellerId: string; onRefetch: () => void
}) {
  const [showXML,  setShowXML]  = useState(false)
  const [detail,   setDetail]   = useState<Entrada | null>(null)

  const STATUS_CFG = {
    LANCADA:  { label: 'Lançada',  cls: 'bg-emerald-50 text-emerald-700' },
    RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-500'      },
  }

  return (
    <>
      <div className="px-6 py-5">
        <div className="flex items-center justify-end gap-2 mb-5">
          <button
            onClick={() => setShowXML(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
          >
            <Upload size={14} />Importar XML de NF
          </button>
        </div>

        {entradas.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
            <p className="text-sm text-[#9CA3AF]">Nenhuma entrada registrada.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-36">Referencia / NF</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-28">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-32">Valor Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-28">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e, i) => {
                  const cfg = STATUS_CFG[e.status]
                  return (
                    <tr key={e.id} className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF9] transition-colors ${i > 0 ? '' : ''}`}>
                      <td className="px-4 py-3 font-medium text-[#111827]">{e.supplier_name ?? <span className="text-[#9CA3AF]">—</span>}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{e.nf_number ?? <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{fmtDate(e.nf_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-[#111827]">
                        {(e.total_value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDetail(e)} className="text-xs text-[#3B5BDB] hover:underline">
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showXML && (
        <XMLImportModal
          produtos={produtos} companyId={companyId} sellerId={sellerId}
          onClose={() => setShowXML(false)}
          onSaved={() => { setShowXML(false); onRefetch() }}
        />
      )}
      {detail && <EntradaDrawer entrada={detail} produtos={produtos} onClose={() => setDetail(null)} />}
    </>
  )
}

// ─── Aba 3: Alertas ───────────────────────────────────────────────────────────

function AlertasTab({
  alertas, companyId, sellerId,
}: {
  alertas: Produto[]; companyId: string; sellerId: string
}) {
  const [sent,    setSent]    = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function deficit(p: Produto) { return Math.max(0, (p.stock_min ?? 0) - (p.stock_qty ?? 0)) }

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleEnviar(p: Produto) {
    setSending(prev => ({ ...prev, [p.id]: true }))
    const { data: req, error: reqErr } = await supabase
      .from('purchase_requests')
      .insert({
        company_id: companyId, requester_id: sellerId,
        title: `Reposicao: ${p.name}`, priority: 'NORMAL',
        status: 'NOVA_SOLICITACAO', origin: 'estoque_alerta', product_id: p.id,
      })
      .select('id').single()

    if (!reqErr && req) {
      await supabase.from('purchase_request_items').insert({
        request_id: req.id, name: p.name, qty: deficit(p), unit: null,
      })
      setSent(prev => new Set(prev).add(p.id))
      showToast('Solicitacao enviada para Compras', true)
    } else {
      showToast('Erro ao enviar solicitacao', false)
    }
    setSending(prev => ({ ...prev, [p.id]: false }))
  }

  const grouped = alertas.reduce<Record<string, Produto[]>>((acc, p) => {
    const key = p.product_categories?.name ?? 'Sem categoria'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})
  const groupKeys = Object.keys(grouped).sort()

  return (
    <div className="px-6 py-5">
      {toast && (
        <div className={`mb-4 text-xs px-4 py-2.5 rounded-lg border ${
          toast.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
        }`}>{toast.msg}</div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-[#374151]">Produtos que exigem reposição</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{alertas.length} produto{alertas.length !== 1 ? 's' : ''} abaixo do mínimo</p>
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
          <p className="text-sm text-[#9CA3AF]">Nenhum produto abaixo do mínimo no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map(groupKey => {
            const isCollapsed = collapsed.has(groupKey)
            return (
              <div key={groupKey} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#374151]">{groupKey}</p>
                    <span className="text-[10px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full">
                      {grouped[groupKey].length}
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown size={14} className="text-[#9CA3AF]" /> : <ChevronUp size={14} className="text-[#9CA3AF]" />}
                </button>

                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F3F4F6]">
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280] w-28">SKU</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280]">Produto</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280] w-28">Qtd Atual</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280] w-24">Mínimo</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-[#6B7280] w-24">Déficit</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-[#6B7280] w-40">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[groupKey].map((p, i) => {
                        const def         = deficit(p)
                        const isSent      = sent.has(p.id)
                        const isSending   = sending[p.id]
                        return (
                          <tr key={p.id} className={`border-b border-[#F3F4F6] last:border-0 ${i > 0 ? '' : ''}`}>
                            <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">{p.sku ?? <span className="text-[#D1D5DB]">—</span>}</td>
                            <td className="px-4 py-3 font-medium text-[#111827]">{p.name}</td>
                            <td className={`px-4 py-3 text-right tabular-nums font-semibold ${(p.stock_qty ?? 0) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                              {p.stock_qty ?? 0}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-[#6B7280]">{p.stock_min ?? '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600">{def}</td>
                            <td className="px-4 py-3 text-center">
                              {isSent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-400">
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'posicao',  label: 'Posição de Estoque'    },
  { key: 'entradas', label: 'Entradas e Importação'  },
  { key: 'alertas',  label: 'Alertas'                },
]

export default function EstoquePage() {
  const { seller } = useAuth()
  const [tab, setTab] = useState<TabKey>('posicao')

  const { data, loading, error, refetch } = useSupabaseQuery<PageData>(
    async ({ company_id }) => {
      const [prodRes, catsRes, entriesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, sku, name, category_id, stock_qty, stock_min, cost, product_categories(id, name)')
          .eq('company_id', company_id)
          .order('name'),
        supabase
          .from('product_categories')
          .select('id, name')
          .eq('company_id', company_id)
          .order('name'),
        supabase
          .from('stock_entries')
          .select('id, supplier_name, nf_number, nf_date, total_value, status, created_at, stock_entry_items(id, product_id, qty, unit_cost)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }),
      ])
      if (prodRes.error) return { data: null, error: prodRes.error }
      return {
        data: {
          produtos:   (prodRes.data    ?? []) as unknown as Produto[],
          categorias: (catsRes.data    ?? []) as Categoria[],
          entradas:   (entriesRes.data ?? []) as unknown as Entrada[],
        },
        error: null,
      }
    },
    [],
  )

  const produtos   = data?.produtos   ?? []
  const categorias = data?.categorias ?? []
  const entradas   = data?.entradas   ?? []
  const alertas    = produtos.filter(p => p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0))

  const companyId = seller?.company_id ?? ''
  const sellerId  = seller?.id         ?? ''

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B7280]">Carregando estoque...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#111827] mb-1">Erro ao carregar estoque</p>
          <p className="text-xs text-[#6B7280]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <h1 className="text-lg font-semibold text-[#111827]">Estoque &amp; Reposição</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Posição de estoque, entradas de mercadorias e reposição
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E5E7EB] px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#3B5BDB] text-[#3B5BDB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {t.label}
              {t.key === 'alertas' && alertas.length > 0 && (
                <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold ${
                  tab === 'alertas' ? 'bg-[#3B5BDB] text-white' : 'bg-red-100 text-red-600'
                }`}>
                  {alertas.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'posicao' && (
        <PosicaoEstoqueTab
          produtos={produtos} categorias={categorias}
        />
      )}
      {tab === 'entradas' && (
        <EntradasTab
          entradas={entradas} produtos={produtos}
          companyId={companyId} sellerId={sellerId}
          onRefetch={refetch}
        />
      )}
      {tab === 'alertas' && (
        <AlertasTab
          alertas={alertas}
          companyId={companyId} sellerId={sellerId}
        />
      )}
    </div>
  )
}
