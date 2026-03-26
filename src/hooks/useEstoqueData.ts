import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Produto {
  id: string
  sku: string | null
  name: string
  category_id: string | null
  stock_qty: number
  stock_min: number | null
  cost: number | null
  updated_at: string
  product_categories: { name: string } | null
}

export interface Categoria {
  id: string
  name: string
}

export interface EntradaItem {
  id: string
  entry_id: string
  product_id: string | null
  qty: number
  unit_cost: number | null
}

export interface Entrada {
  id: string
  supplier_name: string | null
  nf_number: string | null
  nf_date: string | null
  total_value: number
  status: 'LANCADA' | 'RASCUNHO'
  created_by: string | null
  created_at: string
  stock_entry_items: EntradaItem[]
}

export interface EstoqueKpis {
  custoTotal: number
  ruptura: number
  abaixoMinimo: number
  semCusto: number
}

interface EstoqueData {
  produtos: Produto[]
  categorias: Categoria[]
  entradas: Entrada[]
  openPrProductIds: string[]
}

export type MovType = 'ENTRADA' | 'SAIDA' | 'AJUSTE'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEstoqueData() {
  const { data, loading, error, refetch } = useSupabaseQuery<EstoqueData>(
    async ({ company_id }) => {
      const [prodRes, catsRes, entriesRes, prRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, sku, name, category_id, stock_qty, stock_min, cost, updated_at, product_categories(name)')
          .eq('company_id', company_id)
          .order('name'),
        supabase
          .from('product_categories')
          .select('id, name')
          .eq('company_id', company_id)
          .order('name'),
        supabase
          .from('stock_entries')
          .select('id, supplier_name, nf_number, nf_date, total_value, status, created_by, created_at, stock_entry_items(id, entry_id, product_id, qty, unit_cost)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_requests')
          .select('id, product_id, status')
          .eq('company_id', company_id)
          .eq('origin', 'estoque_alerta')
          .not('status', 'in', '(ENTREGUE,CANCELADO)'),
      ])

      if (prodRes.error) return { data: null, error: prodRes.error }

      const openPrProductIds = (prRes.data ?? [])
        .map((r: { product_id: string | null }) => r.product_id)
        .filter((id): id is string => id !== null)

      return {
        data: {
          produtos:          (prodRes.data    ?? []) as unknown as Produto[],
          categorias:        (catsRes.data    ?? []) as Categoria[],
          entradas:          (entriesRes.data ?? []) as unknown as Entrada[],
          openPrProductIds,
        },
        error: null,
      }
    },
    [],
  )

  const produtos          = data?.produtos          ?? []
  const categorias        = data?.categorias        ?? []
  const entradas          = data?.entradas          ?? []
  const openPrProductIds  = data?.openPrProductIds  ?? []

  const kpis: EstoqueKpis = {
    custoTotal:   produtos.reduce((s, p) => s + (p.cost ?? 0) * (p.stock_qty ?? 0), 0),
    ruptura:      produtos.filter(p => (p.stock_qty ?? 0) <= 0).length,
    abaixoMinimo: produtos.filter(p => (p.stock_qty ?? 0) > 0 && p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0)).length,
    semCusto:     produtos.filter(p => !p.cost || p.cost === 0).length,
  }

  const alertas = produtos.filter(
    p => p.stock_min !== null && (p.stock_qty ?? 0) <= (p.stock_min ?? 0),
  )

  // ── Mutations ────────────────────────────────────────────────────────────

  const registrarMovimentacao = useCallback(async (params: {
    productId: string
    type: MovType
    quantity: number
    reason: string
    date: string
    companyId: string
    sellerId: string
  }): Promise<{ error: string | null }> => {
    const { productId, type, quantity, reason, date, companyId, sellerId } = params

    const { error: mvErr } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      product_id: productId,
      type,
      quantity,
      reason,
      created_by: sellerId,
      created_at: new Date(date).toISOString(),
    })
    if (mvErr) return { error: mvErr.message }

    const product = produtos.find(p => p.id === productId)
    const current = product?.stock_qty ?? 0
    const newQty  = type === 'ENTRADA' ? current + quantity
                  : type === 'SAIDA'   ? current - quantity
                  : quantity

    const { error: upErr } = await supabase
      .from('products')
      .update({ stock_qty: newQty })
      .eq('id', productId)
    if (upErr) return { error: upErr.message }

    refetch()
    return { error: null }
  }, [produtos, refetch])

  const registrarEntrada = useCallback(async (params: {
    companyId: string
    sellerId: string
    supplierName: string
    reference: string
    entryDate: string
    items: { productId: string; quantity: number; unitCost: number }[]
  }): Promise<{ error: string | null }> => {
    const { companyId, sellerId, supplierName, reference, entryDate, items } = params
    const totalValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

    const { data: entry, error: entryErr } = await supabase
      .from('stock_entries')
      .insert({
        company_id:    companyId,
        supplier_name: supplierName || null,
        nf_number:     reference    || null,
        nf_date:       entryDate    || null,
        total_value:   totalValue,
        status:        'LANCADA',
        created_by:    sellerId,
      })
      .select('id')
      .single()

    if (entryErr || !entry) return { error: entryErr?.message ?? 'Erro ao criar entrada' }

    const { error: itemsErr } = await supabase.from('stock_entry_items').insert(
      items.map(i => ({
        entry_id:   entry.id,
        product_id: i.productId || null,
        qty:        i.quantity,
        unit_cost:  i.unitCost,
      })),
    )
    if (itemsErr) return { error: itemsErr.message }

    await Promise.all(items.map(async i => {
      const product = produtos.find(p => p.id === i.productId)
      if (!product) return
      const newQty = (product.stock_qty ?? 0) + i.quantity
      await supabase.from('products').update({ stock_qty: newQty }).eq('id', i.productId)
      await supabase.from('stock_movements').insert({
        company_id: companyId,
        product_id: i.productId,
        type:       'ENTRADA',
        quantity:   i.quantity,
        reason:     `Entrada NF ${reference || supplierName || ''}`.trim(),
        created_by: sellerId,
      })
    }))

    if (totalValue > 0) {
      await supabase.from('fin_payables').insert({
        company_id:  companyId,
        description: `Entrada ${supplierName || reference || ''}`.trim(),
        amount:      totalValue,
        due_date:    entryDate || null,
        status:      'pending',
        origin:      'stock_entry',
        origin_id:   entry.id,
      })
    }

    refetch()
    return { error: null }
  }, [produtos, refetch])

  const enviarParaCompras = useCallback(async (params: {
    companyId: string
    sellerId: string
    productId: string
    productName: string
    quantity: number
  }): Promise<{ error: string | null }> => {
    const { companyId, sellerId, productId, productName, quantity } = params

    const { data: req, error: reqErr } = await supabase
      .from('purchase_requests')
      .insert({
        company_id:   companyId,
        requester_id: sellerId,
        title:        `Reposicao: ${productName}`,
        priority:     'NORMAL',
        status:       'NOVA_SOLICITACAO',
        origin:       'estoque_alerta',
        product_id:   productId,
      })
      .select('id')
      .single()

    if (reqErr || !req) return { error: reqErr?.message ?? 'Erro ao criar solicitacao' }

    await supabase.from('purchase_request_items').insert({
      request_id: req.id,
      name:       productName,
      qty:        quantity,
      unit:       null,
    })

    refetch()
    return { error: null }
  }, [refetch])

  return {
    produtos,
    categorias,
    entradas,
    alertas,
    kpis,
    openPrProductIds,
    loading,
    error,
    refetch,
    registrarMovimentacao,
    registrarEntrada,
    enviarParaCompras,
  }
}
