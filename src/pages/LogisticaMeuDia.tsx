import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardList,
  Package,
  Truck,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  BoxSelect,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useSupabaseQuery } from '../hooks/useSupabaseQuery'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface LogTask {
  id: string
  title: string
  task_date: string | null
  priority_crm: string | null
  status_crm: string
}

interface StockProduct {
  id: string
  name: string
  sku: string | null
  stock_qty: number
  stock_min: number
}

interface DeliveryClient {
  name: string
  trade_name: string | null
  city: string | null
}

interface PendingOrder {
  id: string
  order_number: string
  status: string
  total: number
  clients: DeliveryClient[] | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  urgente: 0,
  alta:    1,
  media:   2,
  baixa:   3,
}

const PRIORITY_STYLE: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  alta:    'bg-orange-100 text-orange-700 border-orange-200',
  media:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  baixa:   'bg-gray-100 text-gray-500 border-gray-200',
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function currentDateLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── LogisticaMeuDia ──────────────────────────────────────────────────────────

export default function LogisticaMeuDia() {
  const { seller } = useAuthContext()
  const navigate   = useNavigate()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useSupabaseQuery<LogTask[]>(
    ({ seller: s, company_id }) =>
      supabase
        .from('tasks')
        .select('id, title, task_date, priority_crm, status_crm')
        .eq('company_id', company_id)
        .eq('assigned_to_seller_id', s.id)
        .eq('is_deleted', false)
        .order('task_date', { ascending: true }),
    []
  )

  // Busca todos os produtos ativos — filtra abaixo do mínimo no cliente
  const { data: allProducts, loading: stockLoading } = useSupabaseQuery<StockProduct[]>(
    ({ company_id }) =>
      supabase
        .from('products')
        .select('id, name, sku, stock_qty, stock_min')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .order('stock_qty', { ascending: true }),
    []
  )

  const { data: rawOrders, loading: ordersLoading } = useSupabaseQuery<PendingOrder[]>(
    ({ company_id }) =>
      supabase
        .from('orders')
        .select('id, order_number, status, total, clients!orders_client_id_fkey(name, trade_name, city)')
        .eq('company_id', company_id)
        .in('status', ['approved', 'picked'])
        .order('created_at', { ascending: true }),
    []
  )

  // ── Actions ──────────────────────────────────────────────────────────────

  async function concluirTarefa(taskId: string) {
    setActionLoading(taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ status_crm: 'concluida', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    setActionLoading(null)
    if (error) { toast.error('Erro ao concluir tarefa'); return }
    toast.success('Tarefa concluída!')
    refetchTasks()
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const pendingTasks = (tasks ?? [])
    .filter(t => t.status_crm === 'pendente')
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority_crm ?? 'baixa'] ?? 3
      const pb = PRIORITY_ORDER[b.priority_crm ?? 'baixa'] ?? 3
      return pa - pb
    })

  // Produtos abaixo do mínimo (inclui zerados)
  const stockAlerts = (allProducts ?? []).filter(p => p.stock_qty <= p.stock_min)
  const orders      = rawOrders ?? []

  if (!seller) return null

  return (
    <div className="min-h-screen bg-[#FAFAF9] p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 font-medium tracking-wide uppercase mb-1">
          {currentDateLabel()}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Meu Dia</h1>
        <p className="text-sm text-gray-500 mt-0.5">{seller.name}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tarefas">
        <TabsList className="mb-6 bg-white border border-gray-200 h-10">
          <TabsTrigger value="tarefas" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <ClipboardList className="h-4 w-4" strokeWidth={1.5} />
            Tarefas
            {pendingTasks.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {pendingTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Package className="h-4 w-4" strokeWidth={1.5} />
            Estoque
            {stockAlerts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {stockAlerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Truck className="h-4 w-4" strokeWidth={1.5} />
            Entregas
            {orders.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {orders.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas">
          <TarefasTab
            tasks={pendingTasks}
            loading={tasksLoading}
            actionLoading={actionLoading}
            onConcluir={concluirTarefa}
          />
        </TabsContent>

        <TabsContent value="estoque">
          <EstoqueTab
            alerts={stockAlerts}
            loading={stockLoading}
            onVerEstoque={() => navigate('/estoque')}
          />
        </TabsContent>

        <TabsContent value="entregas">
          <EntregasTab
            orders={orders}
            loading={ordersLoading}
            onVerPedidos={() => navigate('/pedidos')}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Tarefas Tab ──────────────────────────────────────────────────────────────

function TarefasTab({
  tasks,
  loading,
  actionLoading,
  onConcluir,
}: {
  tasks:         LogTask[]
  loading:       boolean
  actionLoading: string | null
  onConcluir:    (id: string) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 bg-white rounded-xl border border-gray-100">
        <CheckCircle2 className="h-10 w-10" strokeWidth={1} />
        <p className="text-sm font-medium">Nenhuma tarefa pendente</p>
      </div>
    )
  }

  const groups: Record<string, LogTask[]> = {}
  for (const t of tasks) {
    const p = t.priority_crm ?? 'baixa'
    if (!groups[p]) groups[p] = []
    groups[p].push(t)
  }
  const orderedKeys = ['urgente', 'alta', 'media', 'baixa'].filter(k => groups[k]?.length)

  return (
    <div className="space-y-6">
      {orderedKeys.map(priority => (
        <section key={priority}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[priority] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
            <span className="text-xs text-gray-400">
              {groups[priority].length} {groups[priority].length === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
          <div className="space-y-2">
            {groups[priority].map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  {task.task_date && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(task.task_date)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8 text-xs font-medium"
                  disabled={actionLoading === task.id}
                  onClick={() => onConcluir(task.id)}
                >
                  {actionLoading === task.id ? 'Salvando...' : 'Concluir'}
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Estoque Tab ──────────────────────────────────────────────────────────────

function EstoqueTab({
  alerts,
  loading,
  onVerEstoque,
}: {
  alerts:       StockProduct[]
  loading:      boolean
  onVerEstoque: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  const zeroStock = alerts.filter(p => p.stock_qty === 0)
  const lowStock  = alerts.filter(p => p.stock_qty > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {alerts.length > 0
            ? `${alerts.length} ${alerts.length === 1 ? 'produto abaixo do mínimo' : 'produtos abaixo do mínimo'}`
            : 'Estoque dentro dos limites'}
        </p>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onVerEstoque}>
          Ver Estoque
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Package className="h-10 w-10" strokeWidth={1} />
          <p className="text-sm font-medium">Estoque dentro dos limites</p>
        </div>
      ) : (
        <div className="space-y-4">
          {zeroStock.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-red-700">
                  Sem estoque ({zeroStock.length})
                </span>
              </div>
              <div className="space-y-2">
                {zeroStock.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-red-100 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-red-600">0</p>
                      <p className="text-xs text-gray-400">mín: {p.stock_min}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {lowStock.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BoxSelect className="h-4 w-4 text-orange-600" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-orange-700">
                  Abaixo do mínimo ({lowStock.length})
                </span>
              </div>
              <div className="space-y-2">
                {lowStock.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-orange-100 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-orange-600">{p.stock_qty}</p>
                      <p className="text-xs text-gray-400">mín: {p.stock_min}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Entregas Tab ─────────────────────────────────────────────────────────────

function EntregasTab({
  orders,
  loading,
  onVerPedidos,
}: {
  orders:       PendingOrder[]
  loading:      boolean
  onVerPedidos: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  const toSeparate = orders.filter(o => o.status === 'approved')
  const inRoute    = orders.filter(o => o.status === 'picked')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {orders.length > 0
            ? `${orders.length} ${orders.length === 1 ? 'pedido pendente' : 'pedidos pendentes'}`
            : 'Nenhum pedido pendente'}
        </p>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onVerPedidos}>
          Ver Pedidos
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Truck className="h-10 w-10" strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inRoute.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Em Rota ({inRoute.length})
                </span>
              </div>
              <div className="space-y-2">
                {inRoute.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            </section>
          )}
          {toSeparate.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  Aguardando Separação ({toSeparate.length})
                </span>
              </div>
              <div className="space-y-2">
                {toSeparate.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }: { order: PendingOrder }) {
  const client     = order.clients?.[0] ?? null
  const clientName = client?.trade_name ?? client?.name ?? '—'
  const city       = client?.city ?? ''

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{clientName}</p>
          <Badge
            variant="outline"
            className={`text-[11px] font-medium shrink-0 ${
              order.status === 'picked'
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {order.status === 'picked' ? 'Em Rota' : 'Aguard. Separação'}
          </Badge>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          #{order.order_number}{city ? ` · ${city}` : ''}
        </p>
      </div>
      <p className="text-sm font-semibold text-gray-900 shrink-0 whitespace-nowrap">
        {formatCurrency(order.total)}
      </p>
    </div>
  )
}
