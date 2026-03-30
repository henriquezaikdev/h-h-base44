import { useState, useEffect, useCallback } from 'react'
import { Link2, Search, Trash2, Plus, PackageOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CID = '00000000-0000-0000-0000-000000000001'
const INPUT = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'
const BTN_PRIMARY = 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors'

interface Equivalence {
  id: string
  product_id_a: string
  product_id_b: string
  product_a_name?: string
  product_b_name?: string
  created_at: string
}

interface ProductOption {
  id: string
  name: string
  sku: string | null
}

export default function AbaEquivalencias({ notify }: { notify: (ok: boolean, msg: string) => void }) {
  const [equivalences, setEquivalences] = useState<Equivalence[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New equivalence form
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [resultsA, setResultsA] = useState<ProductOption[]>([])
  const [resultsB, setResultsB] = useState<ProductOption[]>([])
  const [selectedA, setSelectedA] = useState<ProductOption | null>(null)
  const [selectedB, setSelectedB] = useState<ProductOption | null>(null)
  const [saving, setSaving] = useState(false)

  const loadEquivalences = useCallback(async () => {
    const { data } = await supabase
      .from('product_equivalences')
      .select('id, product_id_a, product_id_b, created_at')
      .eq('company_id', CID)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      setEquivalences([])
      setLoading(false)
      return
    }

    // Fetch product names
    const ids = [...new Set(data.flatMap(e => [e.product_id_a, e.product_id_b]))]
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', ids)

    const nameMap = new Map(products?.map(p => [p.id, p.name]) ?? [])

    setEquivalences(data.map(e => ({
      ...e,
      product_a_name: nameMap.get(e.product_id_a) ?? 'Produto removido',
      product_b_name: nameMap.get(e.product_id_b) ?? 'Produto removido',
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadEquivalences() }, [loadEquivalences])

  async function searchProducts(query: string, side: 'a' | 'b') {
    if (query.length < 2) {
      if (side === 'a') setResultsA([]); else setResultsB([])
      return
    }
    const { data } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('company_id', CID)
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .limit(8)
    if (side === 'a') setResultsA(data ?? []); else setResultsB(data ?? [])
  }

  function selectProduct(product: ProductOption, side: 'a' | 'b') {
    if (side === 'a') {
      setSelectedA(product)
      setSearchA(product.name)
      setResultsA([])
    } else {
      setSelectedB(product)
      setSearchB(product.name)
      setResultsB([])
    }
  }

  async function handleAdd() {
    if (!selectedA || !selectedB) return
    if (selectedA.id === selectedB.id) { notify(false, 'Selecione dois produtos diferentes'); return }

    // Check duplicate
    const existing = equivalences.find(e =>
      (e.product_id_a === selectedA.id && e.product_id_b === selectedB.id) ||
      (e.product_id_a === selectedB.id && e.product_id_b === selectedA.id)
    )
    if (existing) { notify(false, 'Equivalência já cadastrada'); return }

    setSaving(true)
    try {
      const { error } = await supabase.from('product_equivalences').insert({
        company_id: CID,
        product_id_a: selectedA.id,
        product_id_b: selectedB.id,
      })
      if (error) { notify(false, error.message); return }
      notify(true, 'Equivalência criada')
      setSelectedA(null); setSelectedB(null)
      setSearchA(''); setSearchB('')
      loadEquivalences()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const { error } = await supabase.from('product_equivalences').delete().eq('id', id)
      if (error) { notify(false, error.message); return }
      notify(true, 'Equivalência removida')
      setEquivalences(prev => prev.filter(e => e.id !== id))
    } finally { setDeleting(null) }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#9CA3AF]">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add new */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Plus size={14} className="text-[#9CA3AF]" />
          <h3 className="text-sm font-semibold text-[#111827]">Nova Equivalência</h3>
        </div>
        <p className="text-xs text-[#9CA3AF] mb-4">
          Vincule dois produtos que são equivalentes comercialmente (ex: Report A4 e Chamex A4).
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* Product A */}
          <div className="relative">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Produto A *</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchA}
                onChange={e => { setSearchA(e.target.value); setSelectedA(null); searchProducts(e.target.value, 'a') }}
                placeholder="Buscar por nome..."
                className={`${INPUT} pl-8`}
              />
            </div>
            {resultsA.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultsA.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p, 'a')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6] last:border-0"
                  >
                    <span className="text-[#111827]">{p.name}</span>
                    {p.sku && <span className="ml-2 text-[10px] text-[#9CA3AF]">SKU: {p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedA && (
              <p className="mt-1 text-[11px] text-emerald-600">Selecionado: {selectedA.name}</p>
            )}
          </div>

          {/* Product B */}
          <div className="relative">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Produto B *</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchB}
                onChange={e => { setSearchB(e.target.value); setSelectedB(null); searchProducts(e.target.value, 'b') }}
                placeholder="Buscar por nome..."
                className={`${INPUT} pl-8`}
              />
            </div>
            {resultsB.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultsB.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p, 'b')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6] last:border-0"
                  >
                    <span className="text-[#111827]">{p.name}</span>
                    {p.sku && <span className="ml-2 text-[10px] text-[#9CA3AF]">SKU: {p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedB && (
              <p className="mt-1 text-[11px] text-emerald-600">Selecionado: {selectedB.name}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleAdd}
            disabled={saving || !selectedA || !selectedB}
            className={BTN_PRIMARY}
          >
            <Link2 size={14} /> {saving ? 'Salvando...' : 'Criar Equivalência'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Link2 size={14} className="text-[#9CA3AF]" />
          <h3 className="text-sm font-semibold text-[#111827]">Equivalências Cadastradas</h3>
          <span className="text-xs text-[#9CA3AF] ml-auto">{equivalences.length} par{equivalences.length !== 1 ? 'es' : ''}</span>
        </div>

        {equivalences.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2">
            <PackageOpen size={28} className="text-[#D1D5DB]" strokeWidth={1.5} />
            <p className="text-sm text-[#9CA3AF]">Nenhuma equivalência cadastrada</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {equivalences.map(eq => (
              <div key={eq.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#111827] truncate">{eq.product_a_name}</span>
                    <Link2 size={12} className="text-[#9CA3AF] shrink-0" />
                    <span className="text-sm font-medium text-[#111827] truncate">{eq.product_b_name}</span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    Criado em {new Date(eq.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(eq.id)}
                  disabled={deleting === eq.id}
                  className="p-2 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  aria-label="Remover equivalência"
                >
                  {deleting === eq.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
