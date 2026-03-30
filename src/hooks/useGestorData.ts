import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CID = '00000000-0000-0000-0000-000000000001'

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

export interface GestorFilters {
  year: number
  month: number // 0-indexed
}

export interface GestorKPIs {
  revenue: number
  revenuePrev: number
  ordersCount: number
  ordersCountPrev: number
  avgTicket: number
  avgTicketPrev: number
  profit: number         // revenue - CMV
  marginPercent: number  // profit / revenue * 100
  totalCMV: number
  totalComissao: number
  activeClients: number
  activeClientsPrev: number
  invoicedCount: number
}

export interface SellerResult {
  id: string
  name: string
  revenue: number
  ordersCount: number
  avgTicket: number
  clientsCount: number
  marginBruta: number    // % margem
  comissaoReal: number   // R$ comissão
  comissaoPercentual: number // % comissão
  salesTarget: number
  goalPercent: number
}

export interface CriticalProduct {
  id: string
  name: string
  stock_qty: number
  stock_min: number
  price: number
}

interface Order {
  id: string
  total: number
  subtotal: number
  discount: number
  status: string
  seller_id: string
  client_id: string
  created_at: string
  approved_at: string | null
  nfe_status: string | null
}

interface OrderItem {
  order_id: string
  qty: number
  unit_price: number
  cost_at_sale: number | null
  commission_pct: number | null
}

interface Seller {
  id: string
  name: string
  role: string
  is_active: boolean | null
  active: boolean | null
  status: string | null
}

interface Client {
  id: string
  name: string
  status: string
  last_order_at: string | null
  total_revenue: number
  priority_score: number | null
}

interface Payable {
  id: string
  description: string
  amount: number
  due_date: string
  status: string
}

interface MonthlyGoal {
  seller_id: string
  sales_target: number
  sales_achieved: number
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/** Effective date: approved_at if available, created_at as fallback */
function orderDate(o: Order): string {
  return String(o.approved_at ?? o.created_at).replace(' ', 'T')
}

function inMonth(dateStr: string, y: number, m: number): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === y && d.getMonth() === m
}

/* ═══════════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════════ */

export function useGestorData(filters: GestorFilters) {
  const { year, month } = filters
  const [loading, setLoading] = useState(true)
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [allOrderItems, setAllOrderItems] = useState<OrderItem[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [criticalProducts, setCriticalProducts] = useState<CriticalProduct[]>([])
  const [goals, setGoals] = useState<MonthlyGoal[]>([])

  const load = useCallback(async () => {
    setLoading(true)

    const [ordersRes, sellersRes, clientsRes, payablesRes, productsRes, goalsRes] = await Promise.all([
      supabase.from('orders')
        .select('id, total, subtotal, discount, status, seller_id, client_id, created_at, approved_at, nfe_status')
        .eq('company_id', CID).order('created_at', { ascending: false }).limit(10000),
      supabase.from('sellers')
        .select('id, name, role, is_active, active, status')
        .eq('company_id', CID),
      supabase.from('clients')
        .select('id, name, status, last_order_at, total_revenue, priority_score')
        .eq('company_id', CID).order('total_revenue', { ascending: false }).limit(500),
      supabase.from('fin_payables')
        .select('id, description, amount, due_date, status')
        .eq('company_id', CID).order('due_date'),
      supabase.from('products')
        .select('id, name, stock_qty, stock_min, price')
        .eq('company_id', CID).eq('is_active', true).order('stock_qty'),
      supabase.from('monthly_goals')
        .select('seller_id, sales_target, sales_achieved')
        .eq('company_id', CID).eq('month', month + 1).eq('year', year),
    ])

    const allOrd = (ordersRes.data ?? []) as Order[]
    setAllOrders(allOrd)
    setSellers(sellersRes.data ?? [])
    setClients(clientsRes.data ?? [])
    setPayables(payablesRes.data ?? [])
    setGoals(goalsRes.data ?? [])

    const prods = (productsRes.data ?? []) as CriticalProduct[]
    setCriticalProducts(prods.filter(p => p.stock_min > 0 && p.stock_qty < p.stock_min).slice(0, 10))

    // Fetch order_items for current month
    const currMonthIds = allOrd.filter(o => inMonth(orderDate(o), year, month)).map(o => o.id)
    if (currMonthIds.length > 0) {
      const batchSize = 200
      const items: OrderItem[] = []
      for (let i = 0; i < currMonthIds.length; i += batchSize) {
        const batch = currMonthIds.slice(i, i + batchSize)
        const { data } = await supabase.from('order_items')
          .select('order_id, qty, unit_price, cost_at_sale, commission_pct')
          .in('order_id', batch)
        if (data) items.push(...data)
      }
      setAllOrderItems(items)
    } else {
      setAllOrderItems([])
    }

    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Derived: current + previous month
  const pm = month === 0 ? 11 : month - 1
  const py = month === 0 ? year - 1 : year

  const orders = useMemo(() => allOrders.filter(o => inMonth(orderDate(o), year, month)), [allOrders, year, month])
  const prevOrders = useMemo(() => allOrders.filter(o => inMonth(orderDate(o), py, pm)), [allOrders, py, pm])

  // Approved orders (exclude cancelled)
  const approved = useMemo(() => orders.filter(o => o.status !== 'cancelled'), [orders])
  const prevApproved = useMemo(() => prevOrders.filter(o => o.status !== 'cancelled'), [prevOrders])

  // KPIs
  const kpis = useMemo<GestorKPIs>(() => {
    const revenue = approved.reduce((s, o) => s + (o.total ?? 0), 0)
    const revenuePrev = prevApproved.reduce((s, o) => s + (o.total ?? 0), 0)
    const totalCMV = allOrderItems.reduce((s, i) => s + ((i.cost_at_sale ?? 0) * (i.qty ?? 0)), 0)
    const profit = revenue - totalCMV
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0
    const totalComissao = allOrderItems.reduce((s, i) => {
      const comm = ((i.commission_pct ?? 0) / 100) * (i.unit_price * i.qty)
      return s + comm
    }, 0)

    return {
      revenue,
      revenuePrev,
      ordersCount: approved.length,
      ordersCountPrev: prevApproved.length,
      avgTicket: approved.length > 0 ? revenue / approved.length : 0,
      avgTicketPrev: prevApproved.length > 0 ? revenuePrev / prevApproved.length : 0,
      profit,
      marginPercent,
      totalCMV,
      totalComissao,
      activeClients: new Set(approved.map(o => o.client_id)).size,
      activeClientsPrev: new Set(prevApproved.map(o => o.client_id)).size,
      invoicedCount: approved.filter(o => o.nfe_status === 'autorizada').length,
    }
  }, [approved, prevApproved, allOrderItems])

  // Seller results
  const sellersResult = useMemo<SellerResult[]>(() => {
    const sellerIdsWithOrders = new Set(approved.map(o => o.seller_id).filter(Boolean))
    const relevantSellers = sellers.filter(s =>
      s.is_active || s.role === 'seller' || sellerIdsWithOrders.has(s.id)
    )

    const salesMap = new Map<string, { count: number; total: number; clients: Set<string> }>()
    approved.forEach(o => {
      if (!o.seller_id) return
      const cur = salesMap.get(o.seller_id) ?? { count: 0, total: 0, clients: new Set<string>() }
      cur.count++; cur.total += o.total ?? 0; cur.clients.add(o.client_id)
      salesMap.set(o.seller_id, cur)
    })

    // Commission per seller
    const commMap = new Map<string, number>()
    const orderSellerMap = new Map(approved.map(o => [o.id, o.seller_id]))
    allOrderItems.forEach(i => {
      const sid = orderSellerMap.get(i.order_id)
      if (!sid) return
      commMap.set(sid, (commMap.get(sid) ?? 0) + ((i.commission_pct ?? 0) / 100) * (i.unit_price * i.qty))
    })

    // Cost per seller for margin
    const costMap = new Map<string, number>()
    allOrderItems.forEach(i => {
      const sid = orderSellerMap.get(i.order_id)
      if (!sid) return
      costMap.set(sid, (costMap.get(sid) ?? 0) + (i.cost_at_sale ?? 0) * i.qty)
    })

    return relevantSellers.map(s => {
      const d = salesMap.get(s.id)
      const total = d?.total ?? 0
      const cost = costMap.get(s.id) ?? 0
      const margin = total > 0 ? ((total - cost) / total) * 100 : 0
      const comm = commMap.get(s.id) ?? 0
      const goal = goals.find(g => g.seller_id === s.id)

      return {
        id: s.id,
        name: s.name,
        revenue: total,
        ordersCount: d?.count ?? 0,
        avgTicket: d && d.count > 0 ? total / d.count : 0,
        clientsCount: d?.clients.size ?? 0,
        marginBruta: margin,
        comissaoReal: comm,
        comissaoPercentual: total > 0 ? (comm / total) * 100 : 0,
        salesTarget: goal?.sales_target ?? 0,
        goalPercent: goal && goal.sales_target > 0 ? Math.min(100, (total / goal.sales_target) * 100) : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [approved, sellers, allOrderItems, goals])

  return {
    loading,
    kpis,
    orders,
    prevOrders,
    approved,
    orderItems: allOrderItems,
    sellers,
    sellersResult,
    clients,
    payables,
    criticalProducts,
    goals,
    refetch: load,
  }
}
