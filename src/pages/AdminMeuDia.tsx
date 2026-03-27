import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardList,
  ShoppingCart,
  DollarSign,
  CalendarDays,
  ArrowRight,
  AlertCircle,
  Clock,
  CheckCircle2,
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

interface AdminTask {
  id: string
  title: string
  task_date: string | null
  priority_crm: string | null
  status_crm: string
}

interface PurchaseRequest {
  id: string
  title: string
  status: string
  priority: string | null
  deadline: string | null
}

interface Payable {
  id: string
  description: string
  amount: number
  due_date: string
  status: string
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

const PURCHASE_STATUS_STYLE: Record<string, string> = {
  NOVA_SOLICITACAO:                 'bg-gray-100 text-gray-600 border-gray-200',
  AGUARDANDO_COMPRADOR:             'bg-gray-100 text-gray-600 border-gray-200',
  EM_COTACAO:                       'bg-blue-100 text-blue-700 border-blue-200',
  AGUARDANDO_APROVACAO_SOLICITANTE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  APROVADA_PARA_COMPRAR:            'bg-green-100 text-green-700 border-green-200',
  EM_COMPRA_FORNECEDOR:             'bg-indigo-100 text-indigo-700 border-indigo-200',
  AGUARDANDO_ENTREGA_FORNECEDOR:    'bg-orange-100 text-orange-700 border-orange-200',
}

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  NOVA_SOLICITACAO:                 'Nova',
  AGUARDANDO_COMPRADOR:             'Aguard. comprador',
  EM_COTACAO:                       'Em cotação',
  AGUARDANDO_APROVACAO_SOLICITANTE: 'Aguard. aprovação',
  APROVADA_PARA_COMPRAR:            'Aprovada',
  EM_COMPRA_FORNECEDOR:             'Em compra',
  AGUARDANDO_ENTREGA_FORNECEDOR:    'Aguard. entrega',
}

const PURCHASE_PRIORITY_STYLE: Record<string, string> = {
  CRITICO: 'bg-red-100 text-red-700 border-red-200',
  URGENTE: 'bg-orange-100 text-orange-700 border-orange-200',
  NORMAL:  'bg-gray-100 text-gray-500 border-gray-200',
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function sevenDaysLaterStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
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

function dueDateStyle(due: string): { badge: string; icon: typeof Clock } {
  const today = todayStr()
  if (due < today)   return { badge: 'bg-red-100 text-red-700 border-red-200',           icon: AlertCircle }
  if (due === today) return { badge: 'bg-orange-100 text-orange-700 border-orange-200',  icon: Clock }
  return                    { badge: 'bg-gray-100 text-gray-500 border-gray-200',        icon: CalendarDays }
}

// ── AdminMeuDia ──────────────────────────────────────────────────────────────

export default function AdminMeuDia() {
  const { seller }   = useAuthContext()
  const navigate     = useNavigate()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useSupabaseQuery<AdminTask[]>(
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

  const { data: purchases, loading: purchasesLoading } = useSupabaseQuery<PurchaseRequest[]>(
    ({ company_id }) =>
      supabase
        .from('purchase_requests')
        .select('id, title, status, priority, deadline')
        .eq('company_id', company_id)
        .not('status', 'in', '("CANCELADO","ENTREGUE")')
        .order('created_at', { ascending: false }),
    []
  )

  const { data: payables, loading: payablesLoading } = useSupabaseQuery<Payable[]>(
    ({ company_id }) =>
      supabase
        .from('fin_payables')
        .select('id, description, amount, due_date, status')
        .eq('company_id', company_id)
        .eq('status', 'pendente')
        .lte('due_date', sevenDaysLaterStr())
        .order('due_date', { ascending: true }),
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

  const pendingPurchases = purchases ?? []
  const pendingPayables  = payables ?? []

  const today         = todayStr()
  const overdueCount  = pendingPayables.filter(p => p.due_date < today).length
  const dueTodayCount = pendingPayables.filter(p => p.due_date === today).length

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

      {/* Alertas rápidos */}
      {(overdueCount > 0 || dueTodayCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-sm font-medium text-red-700">
                {overdueCount} {overdueCount === 1 ? 'conta vencida' : 'contas vencidas'}
              </span>
            </div>
          )}
          {dueTodayCount > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <Clock className="h-4 w-4 text-orange-600 shrink-0" />
              <span className="text-sm font-medium text-orange-700">
                {dueTodayCount} {dueTodayCount === 1 ? 'conta vence hoje' : 'contas vencem hoje'}
              </span>
            </div>
          )}
        </div>
      )}

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
          <TabsTrigger value="compras" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
            Compras
            {pendingPurchases.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {pendingPurchases.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <DollarSign className="h-4 w-4" strokeWidth={1.5} />
            Financeiro
            {pendingPayables.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {pendingPayables.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Tarefas ── */}
        <TabsContent value="tarefas">
          <TarefasTab
            tasks={pendingTasks}
            loading={tasksLoading}
            actionLoading={actionLoading}
            onConcluir={concluirTarefa}
          />
        </TabsContent>

        {/* ── Aba Compras ── */}
        <TabsContent value="compras">
          <ComprasTab
            purchases={pendingPurchases}
            loading={purchasesLoading}
            onVerCompras={() => navigate('/compras')}
          />
        </TabsContent>

        {/* ── Aba Financeiro ── */}
        <TabsContent value="financeiro">
          <FinanceiroTab
            payables={pendingPayables}
            loading={payablesLoading}
            onVerFinanceiro={() => navigate('/financeiro')}
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
  tasks:         AdminTask[]
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

  // Agrupar por priority_crm
  const groups: Record<string, AdminTask[]> = {}
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

// ── Compras Tab ──────────────────────────────────────────────────────────────

function ComprasTab({
  purchases,
  loading,
  onVerCompras,
}: {
  purchases:    PurchaseRequest[]
  loading:      boolean
  onVerCompras: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {purchases.length > 0
            ? `${purchases.length} solicitações em andamento`
            : 'Nenhuma solicitação pendente'}
        </p>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onVerCompras}>
          Ver Compras
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 bg-white rounded-xl border border-gray-100">
          <ShoppingCart className="h-10 w-10" strokeWidth={1} />
          <p className="text-sm font-medium">Nenhuma solicitação pendente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {purchases.map(pr => (
            <div key={pr.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{pr.title}</p>
                  {pr.deadline && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Prazo: {formatDate(pr.deadline)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium ${PURCHASE_STATUS_STYLE[pr.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
                  >
                    {PURCHASE_STATUS_LABEL[pr.status] ?? pr.status}
                  </Badge>
                  {pr.priority && pr.priority !== 'NORMAL' && (
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${PURCHASE_PRIORITY_STYLE[pr.priority] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                      {pr.priority.charAt(0) + pr.priority.slice(1).toLowerCase()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Financeiro Tab ────────────────────────────────────────────────────────────

function FinanceiroTab({
  payables,
  loading,
  onVerFinanceiro,
}: {
  payables:        Payable[]
  loading:         boolean
  onVerFinanceiro: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  const totalPendente = payables.reduce((acc, p) => acc + Number(p.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {payables.length > 0
              ? `${payables.length} contas nos próximos 7 dias`
              : 'Nenhuma conta a pagar nos próximos 7 dias'}
          </p>
          {payables.length > 0 && (
            <p className="text-base font-bold text-gray-900 mt-0.5">{formatCurrency(totalPendente)}</p>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onVerFinanceiro}>
          Ver Financeiro
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {payables.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 bg-white rounded-xl border border-gray-100">
          <DollarSign className="h-10 w-10" strokeWidth={1} />
          <p className="text-sm font-medium">Nenhuma conta nos próximos 7 dias</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payables.map(p => {
            const { badge, icon: Icon } = dueDateStyle(p.due_date)
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.description}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    Vence em {formatDate(p.due_date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(p.amount))}</p>
                  <Badge variant="outline" className={`mt-1 text-[11px] font-medium ${badge}`}>
                    {p.due_date < todayStr() ? 'Vencida' : p.due_date === todayStr() ? 'Vence hoje' : 'A vencer'}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
