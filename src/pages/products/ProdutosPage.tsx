import { useState, useMemo } from 'react'
import {
  Package, Plus, Search, Edit2, AlertTriangle, Tag,
  ChevronLeft, ChevronRight, X, Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawProduct {
  id: string
  sku: string | null
  name: string
  ncm: string | null
  is_active: boolean
  unit: string | null
  price: number | null
  cost: number | null
  stock_qty: number | null
  stock_min: number | null
  category_id: string | null
  company_id: string
  created_at: string
  product_categories: { name: string } | null
}

interface Category {
  id: string
  name: string
}

interface QueryResult {
  products: RawProduct[]
  categories: Category[]
}

type TabKey    = 'painel' | 'categorias' | 'sem-categoria'
type PillKey   = 'all' | 'alerta' | 'pendencia'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null) {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function isCritical(p: RawProduct) {
  return p.stock_qty !== null && p.stock_min !== null && p.stock_qty <= p.stock_min
}

function isUncategorized(p: RawProduct) {
  return !p.category_id
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  categories: Category[]
  companyId: string
  onClose: () => void
  onSaved: () => void
}

const EMPTY_FORM = {
  sku: '', ncm: '', name: '', category_id: '', unit: '', price: '', cost: '', stock_min: '',
}

function ProductModal({ categories, companyId, onClose, onSaved }: ModalProps) {
  const [form, setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  function set(k: keyof typeof EMPTY_FORM) {
    return (v: string) => setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true)
    setErr(null)
    try {
      const { error } = await supabase.from('products').insert({
        company_id:  companyId,
        sku:         form.sku.trim()         || null,
        ncm:         form.ncm.trim()         || null,
        name:        form.name.trim(),
        category_id: form.category_id        || null,
        unit:        form.unit.trim()        || null,
        price:       form.price     ? parseFloat(form.price.replace(',', '.'))     : null,
        cost:        form.cost      ? parseFloat(form.cost.replace(',', '.'))      : null,
        stock_min:   form.stock_min ? parseFloat(form.stock_min.replace(',', '.')) : null,
        is_active:   true,
      })
      if (error) { setErr(error.message); return }
      onClose()   // fecha o modal imediatamente
      onSaved()   // refetch em background
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <Package size={15} className="text-[#3B5BDB]" />
            </div>
            <h2 className="text-sm font-semibold text-[#111827]">Novo Produto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU">
              <input value={form.sku} onChange={e => set('sku')(e.target.value)} placeholder="Ex: PROD-001"
                className={inputCls} />
            </Field>
            <Field label="Unidade">
              <input value={form.unit} onChange={e => set('unit')(e.target.value)} placeholder="Ex: CX, UN, KG"
                className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="NCM">
              <input value={form.ncm}
                onChange={e => set('ncm')(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000" maxLength={8} className={inputCls} />
            </Field>
          </div>

          <Field label="Nome *">
            <input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="Nome do produto"
              className={inputCls} />
          </Field>

          <Field label="Categoria">
            <select value={form.category_id} onChange={e => set('category_id')(e.target.value)} className={inputCls}>
              <option value="">Sem categoria</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Preço de Venda">
              <input value={form.price} onChange={e => set('price')(e.target.value)} placeholder="0,00"
                className={inputCls} />
            </Field>
            <Field label="Custo">
              <input value={form.cost} onChange={e => set('cost')(e.target.value)} placeholder="0,00"
                className={inputCls} />
            </Field>
            <Field label="Estoque Mín.">
              <input value={form.stock_min} onChange={e => set('stock_min')(e.target.value)} placeholder="0"
                className={inputCls} />
            </Field>
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9]">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
            <Check size={14} />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  product: RawProduct
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

function EditModal({ product, categories, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    sku:         product.sku         ?? '',
    ncm:         product.ncm         ?? '',
    name:        product.name,
    category_id: product.category_id ?? '',
    unit:        product.unit        ?? '',
    price:       product.price       != null ? String(product.price)     : '',
    cost:        product.cost        != null ? String(product.cost)      : '',
    stock_min:   product.stock_min   != null ? String(product.stock_min) : '',
    is_active:   product.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  function set(k: keyof typeof form) {
    return (v: string) => setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true)
    setErr(null)
    try {
      const { error } = await supabase.from('products').update({
        sku:         form.sku.trim()         || null,
        ncm:         form.ncm.trim()         || null,
        name:        form.name.trim(),
        category_id: form.category_id        || null,
        unit:        form.unit.trim()        || null,
        price:       form.price     ? parseFloat(form.price.replace(',', '.'))     : null,
        cost:        form.cost      ? parseFloat(form.cost.replace(',', '.'))      : null,
        stock_min:   form.stock_min ? parseFloat(form.stock_min.replace(',', '.')) : null,
        is_active:   form.is_active,
      }).eq('id', product.id)
      if (error) { setErr(error.message); return }
      onClose()   // fecha o modal imediatamente
      onSaved()   // refetch em background, sem bloquear o fechamento
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
              <Edit2 size={15} className="text-[#3B5BDB]" />
            </div>
            <h2 className="text-sm font-semibold text-[#111827]">Editar Produto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU">
              <input value={form.sku} onChange={e => set('sku')(e.target.value)} placeholder="Ex: PROD-001" className={inputCls} />
            </Field>
            <Field label="Unidade">
              <input value={form.unit} onChange={e => set('unit')(e.target.value)} placeholder="Ex: CX, UN, KG" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="NCM">
              <input
                value={form.ncm}
                onChange={e => set('ncm')(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000"
                maxLength={8}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Nome *">
            <input value={form.name} onChange={e => set('name')(e.target.value)} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <select value={form.category_id} onChange={e => set('category_id')(e.target.value)} className={inputCls}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={e => setForm(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                className={inputCls}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Preço de Venda">
              <input value={form.price} onChange={e => set('price')(e.target.value)} placeholder="0,00" className={inputCls} />
            </Field>
            <Field label="Custo">
              <input value={form.cost} onChange={e => set('cost')(e.target.value)} placeholder="0,00" className={inputCls} />
            </Field>
            <Field label="Estoque Mín.">
              <input value={form.stock_min} onChange={e => set('stock_min')(e.target.value)} placeholder="0" className={inputCls} />
            </Field>
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAF9]">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors">
            <Check size={14} />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Categorias Tab ───────────────────────────────────────────────────────────

function CategoriasTab({
  categories, companyId, onSaved,
}: { categories: Category[]; companyId: string; onSaved: () => void }) {
  const [newName, setNewName] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('product_categories').insert({
      company_id: companyId,
      name: newName.trim(),
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setNewName('')
    onSaved()
  }

  async function handleDelete(id: string) {
    await supabase.from('product_categories').delete().eq('id', id)
    onSaved()
  }

  return (
    <div className="px-6 py-6 max-w-lg">
      <p className="text-xs text-[#6B7280] mb-4">Categorias disponíveis para classificar produtos.</p>

      {/* Add row */}
      <div className="flex gap-2 mb-5">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nova categoria…"
          className={`${inputCls} flex-1`}
        />
        <button onClick={handleAdd} disabled={saving || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors shrink-0">
          <Plus size={13} />
          Adicionar
        </button>
      </div>

      {err && <p className="text-xs text-red-600 mb-3">{err}</p>}

      {categories.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] text-center py-8">Nenhuma categoria cadastrada.</p>
      ) : (
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
          {categories.map((c, i) => (
            <div key={c.id}
              className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-[#E5E7EB]' : ''}`}>
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-[#9CA3AF]" />
                <span className="text-sm text-[#111827]">{c.name}</span>
              </div>
              <button onClick={() => handleDelete(c.id)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function ProdutosPage() {
  const [tab,        setTab]        = useState<TabKey>('painel')
  const [pill,       setPill]       = useState<PillKey>('all')
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<RawProduct | null>(null)
  const [companyId,  setCompanyId]  = useState('')

  const { data, loading, error, refetch } = useSupabaseQuery<QueryResult>(
    async ({ company_id, seller }) => {
      setCompanyId(company_id)
      const [productsRes, catsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, product_categories(name)')
          .eq('company_id', company_id)
          .order('name'),
        supabase
          .from('product_categories')
          .select('id, name')
          .eq('company_id', seller.company_id)
          .order('name'),
      ])
      if (productsRes.error) return { data: null, error: productsRes.error }
      return {
        data: {
          products:   (productsRes.data ?? []) as unknown as RawProduct[],
          categories: (catsRes.data     ?? []) as Category[],
        },
        error: null,
      }
    },
    [],
  )

  const products   = data?.products   ?? []
  const categories = data?.categories ?? []

  const uncategorized = useMemo(() => products.filter(isUncategorized), [products])

  // ── Filter ───────────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    let list = products

    if (tab === 'sem-categoria') {
      list = list.filter(isUncategorized)
    } else if (tab === 'painel') {
      if (pill === 'alerta')    list = list.filter(isCritical)
      if (pill === 'pendencia') list = list.filter(isUncategorized)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q),
      )
    }

    return list
  }, [products, tab, pill, search])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const paginated  = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleTabChange(t: TabKey) {
    setTab(t)
    setPill('all')
    setSearch('')
    setPage(1)
  }

  function handlePillChange(p: PillKey) {
    setPill(p)
    setPage(1)
  }

  // ── Render guards ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B7280]">Carregando produtos…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#111827] mb-1">Erro ao carregar produtos</p>
          <p className="text-xs text-[#6B7280]">{error}</p>
        </div>
      </div>
    )
  }

  const criticalCount   = products.filter(isCritical).length
  const uncatCount      = uncategorized.length

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Painel de Produtos</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Estoque · Alertas · Pendências</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] transition-colors"
        >
          <Plus size={14} />
          Novo Produto
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E5E7EB] px-6">
        <div className="flex gap-0">
          {([
            { key: 'painel',        label: 'Painel'        },
            { key: 'categorias',    label: 'Categorias'    },
            { key: 'sem-categoria', label: 'Sem Categoria', badge: uncatCount },
          ] as { key: TabKey; label: string; badge?: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#3B5BDB] text-[#3B5BDB]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold ${
                  tab === t.key ? 'bg-[#3B5BDB] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Categorias Tab */}
      {tab === 'categorias' ? (
        <CategoriasTab categories={categories} companyId={companyId} onSaved={refetch} />
      ) : (
        <div className="px-6 py-5">

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">

            {/* Pills — only on Painel tab */}
            {tab === 'painel' && (
              <div className="flex items-center gap-1.5">
                {([
                  { key: 'all',       label: 'Todos'          },
                  { key: 'alerta',    label: 'Alerta Crítico', count: criticalCount },
                  { key: 'pendencia', label: 'Com Pendência',  count: uncatCount    },
                ] as { key: PillKey; label: string; count?: number }[]).map(p => (
                  <button
                    key={p.key}
                    onClick={() => handlePillChange(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      pill === p.key
                        ? 'bg-[#3B5BDB] text-white border-[#3B5BDB]'
                        : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#3B5BDB] hover:text-[#3B5BDB]'
                    }`}
                  >
                    {p.label}
                    {p.count !== undefined && p.count > 0 && (
                      <span className={`text-[10px] font-semibold ${pill === p.key ? 'opacity-80' : 'text-[#9CA3AF]'}`}>
                        {p.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative ml-auto">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por nome ou SKU…"
                className="pl-8 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg w-56 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 bg-white text-[#111827] placeholder-[#9CA3AF] transition"
              />
            </div>
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-center py-16">
              <div className="text-center">
                <Package size={28} className="text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-sm text-[#9CA3AF]">
                  {search ? 'Nenhum produto encontrado para esta busca.' : 'Nenhum produto cadastrado.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-28">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280]">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] w-40">Categoria</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] w-32">Preço Venda</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-24">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[#6B7280] w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => (
                      <tr key={p.id}
                        className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF9] transition-colors ${
                          isCritical(p) ? 'bg-red-50/40' : ''
                        }`}
                      >
                        {/* SKU */}
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">
                          {p.sku || <span className="text-[#D1D5DB]">—</span>}
                        </td>

                        {/* Produto */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isCritical(p) && (
                              <AlertTriangle size={12} className="text-red-400 shrink-0" aria-label="Alerta de estoque" />
                            )}
                            <div>
                              <p className="font-medium text-[#111827] leading-tight">{p.name}</p>
                              {p.unit && (
                                <p className="text-xs text-[#9CA3AF] mt-0.5">{p.unit}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="px-4 py-3">
                          {p.product_categories?.name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#374151]">
                              <Tag size={10} className="text-[#9CA3AF]" />
                              {p.product_categories.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                              Sem categoria
                            </span>
                          )}
                        </td>

                        {/* Preço */}
                        <td className="px-4 py-3 text-right tabular-nums text-[#111827]">
                          {fmt(p.price)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {p.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Ativo</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setEditTarget(p)}
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors"
                            title="Editar produto"
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-[#9CA3AF]">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} de {visible.length} produtos
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                      .reduce<(number | '…')[]>((acc, n, i, arr) => {
                        if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
                        acc.push(n)
                        return acc
                      }, [])
                      .map((n, i) =>
                        n === '…' ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#9CA3AF]">…</span>
                        ) : (
                          <button
                            key={n}
                            onClick={() => setPage(n as number)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                              page === n
                                ? 'bg-[#3B5BDB] text-white'
                                : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                            }`}
                          >
                            {n}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && companyId && (
        <ProductModal
          categories={categories}
          companyId={companyId}
          onClose={() => setShowModal(false)}
          onSaved={refetch}
        />
      )}
      {editTarget && (
        <EditModal
          product={editTarget}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
