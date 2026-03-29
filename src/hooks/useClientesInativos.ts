import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useSupabaseQuery } from './useSupabaseQuery'

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ClienteInativo {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  seller_id: string | null
  origem: string | null
  last_order_at: string | null
  total_orders: number | null
  total_revenue: number | null
  reativacao_score: number | null
  reativacao_status: string | null
  reativacao_iniciada: boolean | null
  ticket_medio_mensal: number | null
  reativacao_sugestao_ia: string | null
  created_at: string
  status: string
  city: string | null
  state: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  neighborhood: string | null
  zip_code: string | null
  ie: string | null
  payment_term: string | null
  unit_type: string | null
  janela_longa: boolean | null
  notes: string | null
  sellers: { name: string } | null
}

export interface ClienteJanela {
  id: string
  name: string
  cnpj: string | null
  intervalo_medio_dias: number | null
  proxima_compra_estimada: string | null
  sellers: { name: string } | null
}

export interface Reativacao {
  id: string
  data_reativacao: string
  valor_primeiro_pedido: number | null
}

export interface PedidoExpandido {
  id: string
  total: number
  created_at: string
  order_items: { products: { name: string } | null }[]
}

interface InativosData {
  clientes: ClienteInativo[]
  janela: ClienteJanela[]
  reativacoes: Reativacao[]
  emReativacao: number
}

/* ── Hook ──────────────────────────────────────────────────────────────── */

export function useClientesInativos() {
  const { seller, role } = useAuth()

  const { data, loading, error, refetch } = useSupabaseQuery<InativosData>(
    async ({ company_id }) => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      // Build base query — owner sees all, seller sees own
      let clientsQuery = supabase
        .from('clients')
        .select('id,name,cnpj,phone,email,seller_id,origem,last_order_at,total_orders,total_revenue,reativacao_score,reativacao_status,reativacao_iniciada,ticket_medio_mensal,reativacao_sugestao_ia,created_at,status,city,state,street,street_number,complement,neighborhood,zip_code,ie,payment_term,unit_type,janela_longa,notes,sellers(name)')
        .eq('company_id', company_id)
        .eq('status', 'inactive')
        .eq('janela_longa', false)
        .neq('origem', 'filial')
        .order('reativacao_score', { ascending: false, nullsFirst: false })
        .limit(50)

      if (role !== 'owner' && seller) {
        clientsQuery = clientsQuery.eq('seller_id', seller.id)
      }

      let janelaQuery = supabase
        .from('clients')
        .select('id,name,cnpj,intervalo_medio_dias,proxima_compra_estimada,sellers(name)')
        .eq('company_id', company_id)
        .eq('janela_longa', true)
        .neq('origem', 'filial')

      if (role !== 'owner' && seller) {
        janelaQuery = janelaQuery.eq('seller_id', seller.id)
      }

      const [a, b, c, d] = await Promise.all([
        clientsQuery,
        janelaQuery,
        supabase.from('client_reativacoes').select('id,data_reativacao,valor_primeiro_pedido')
          .eq('company_id', company_id).gte('data_reativacao', monthStart),
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('company_id', company_id).eq('reativacao_iniciada', true).eq('reativacao_concluida', false)
          .neq('origem', 'filial'),
      ])

      if (a.error) return { data: null, error: a.error }

      return {
        data: {
          clientes: (a.data ?? []) as unknown as ClienteInativo[],
          janela: (b.data ?? []) as unknown as ClienteJanela[],
          reativacoes: (c.data ?? []) as unknown as Reativacao[],
          emReativacao: d.count ?? 0,
        },
        error: null,
      }
    },
    [role],
  )

  // Polling every 30s
  useEffect(() => {
    const iv = setInterval(refetch, 30_000)
    return () => clearInterval(iv)
  }, [refetch])

  return { data, loading, error, refetch }
}

/* ── Hook para carregar pedidos expandidos ──────────────────────────────── */

export function useExpandedOrders() {
  const [cache, setCache] = useState<Record<string, PedidoExpandido[]>>({})

  async function loadOrders(clientId: string) {
    if (cache[clientId]) return cache[clientId]
    const { data } = await supabase
      .from('orders')
      .select('id,total,created_at,order_items(products(name))')
      .eq('client_id', clientId)
      .in('status', ['approved', 'invoiced'])
      .order('created_at', { ascending: false })
      .limit(3)
    const orders = (data ?? []) as unknown as PedidoExpandido[]
    setCache(p => ({ ...p, [clientId]: orders }))
    return orders
  }

  return { cache, loadOrders }
}

/* ── Hook para ui_mode do seller ───────────────────────────────────────── */

export function useViewMode() {
  const { seller } = useAuth()
  const [mode, setMode] = useState<'normal' | 'interativo'>('normal')

  useEffect(() => {
    if (!seller) return
    supabase.from('sellers').select('ui_mode').eq('id', seller.id).single()
      .then(({ data }) => { if (data?.ui_mode === 'interativo') setMode('interativo') })
  }, [seller])

  async function switchMode(m: 'normal' | 'interativo') {
    setMode(m)
    if (seller) await supabase.from('sellers').update({ ui_mode: m }).eq('id', seller.id)
  }

  return { mode, switchMode }
}
