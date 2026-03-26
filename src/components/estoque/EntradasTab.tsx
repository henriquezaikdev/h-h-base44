import { useState } from 'react'
import { X, ChevronRight, Truck } from 'lucide-react'
import type { Entrada, Produto } from '../../hooks/useEstoqueData'
import EntradaManualModal from './EntradaManualModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  entradas: Entrada[]
  produtos: Produto[]
  companyId: string
  sellerId: string
  onRegistrar: (params: {
    companyId: string; sellerId: string; supplierName: string
    reference: string; entryDate: string
    items: { productId: string; quantity: number; unitCost: number }[]
  }) => Promise<{ error: string | null }>
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

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  function fmtBRL(v: number | null) {
    if (!v) return '—'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white border-l border-[#E5E7EB] flex flex-col">

        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-start justify-between shrink-0">
          <div>
            <p className="text-sm font-semibold text-[#111827]">
              {entrada.supplier_name ?? 'Fornecedor nao informado'}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {entrada.nf_number ?? '—'} · {fmtDate(entrada.nf_date)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold text-[#374151] mb-3">
            Itens ({entrada.stock_entry_items.length})
          </p>

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
                    const prod = produtos.find(p => p.id === it.product_id)
                    const total = (it.qty ?? 0) * (it.unit_cost ?? 0)
                    return (
                      <tr key={it.id} className={`border-b border-[#F3F4F6] last:border-0 ${i > 0 ? '' : ''}`}>
                        <td className="px-3 py-2 text-[#111827] font-medium">
                          {prod?.name ?? <span className="text-[#9CA3AF]">Produto removido</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{it.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#374151]">
                          {fmtBRL(it.unit_cost)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-[#111827]">
                          {fmtBRL(total)}
                        </td>
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

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function EntradasTab({ entradas, produtos, companyId, sellerId, onRegistrar }: Props) {
  const [showModal, setShowModal]   = useState(false)
  const [detail,    setDetail]      = useState<Entrada | null>(null)

  const STATUS_CFG = {
    LANCADA:  { label: 'Lancada',  cls: 'bg-emerald-50 text-emerald-700' },
    RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-500'      },
  }

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  function fmtBRL(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <>
      <div className="px-6 py-5">

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 mb-5">
          <button
            disabled
            title="Em breve — importacao de XML de nota fiscal"
            className="px-4 py-2 text-sm font-medium text-[#9CA3AF] border border-[#E5E7EB] rounded-lg opacity-50 cursor-not-allowed"
          >
            Importar XML de NF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
          >
            <Truck size={14} />
            Registrar Entrada Manual
          </button>
        </div>

        {/* Table */}
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-16">Itens</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-28">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e, i) => {
                  const cfg = STATUS_CFG[e.status]
                  return (
                    <tr key={e.id} className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF9] transition-colors ${i > 0 ? '' : ''}`}>
                      <td className="px-4 py-3 font-medium text-[#111827]">
                        {e.supplier_name ?? <span className="text-[#9CA3AF]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {e.nf_number ?? <span className="text-[#D1D5DB]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">{fmtDate(e.nf_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#111827] font-medium">
                        {fmtBRL(e.total_value)}
                      </td>
                      <td className="px-4 py-3 text-center text-[#6B7280]">
                        {e.stock_entry_items.length}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDetail(e)}
                          className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:underline mx-auto"
                        >
                          Ver detalhes <ChevronRight size={12} />
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

      {showModal && (
        <EntradaManualModal
          produtos={produtos}
          companyId={companyId}
          sellerId={sellerId}
          onClose={() => setShowModal(false)}
          onSave={onRegistrar}
        />
      )}

      {detail && (
        <EntradaDrawer entrada={detail} produtos={produtos} onClose={() => setDetail(null)} />
      )}
    </>
  )
}
