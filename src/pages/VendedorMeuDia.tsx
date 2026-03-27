import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTasksData } from '@/hooks/useTasksData'
import { ActionCenterVendedor } from '@/components/action-center/ActionCenterVendedor'
import { ProfileHubContent } from '@/components/profile/ProfileHubContent'
import { EvolutionEmbed } from '@/components/meu-dia/EvolutionEmbed'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Loader2, Search, CheckSquare } from 'lucide-react'
import { format, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type VendedorTab = 'meu-dia' | 'tarefas' | 'perfil' | 'evolucao'

interface SimpleTask {
  id: string
  title: string
  task_date: string | null
  priority_crm: string | null
  status_crm: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  urgente: 0, alta: 1, media: 2, baixa: 3,
}
const PRIORITY_COLOR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-yellow-100 text-yellow-700',
  baixa:   'bg-gray-100 text-gray-500',
}

// ── VendedorMeuDia ────────────────────────────────────────────────────────────

export default function VendedorMeuDia() {
  const [searchParams] = useSearchParams()
  const { seller, isLoading: authLoading } = useAuth()

  const [searchTerm, setSearchTerm]   = useState('')
  const [tab, setTab]                 = useState<VendedorTab>('meu-dia')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Tarefas para badge (atrasadas)
  const { tasks } = useTasksData(undefined, seller?.id, 'seller')
  const today      = startOfDay(new Date())
  const pendentes  = (tasks ?? []).filter(t => t.status === 'pendente')
  const atrasadas  = pendentes.filter(t => t.taskDate && isBefore(new Date(t.taskDate), today))

  // effectiveSellerId — vendedor sempre vê o próprio
  const effectiveSellerId = seller?.id ?? null
  const debugEnabled      = searchParams.get('debug') === '1'

  // Tarefas da aba Tarefas (query simples própria, não a do hook de alertas)
  const { data: minhasTarefas, loading: tarefasLoading, refetch: refetchTarefas } =
    useSupabaseQuery<SimpleTask[]>(
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-[#3B5BDB]" />
      </div>
    )
  }

  if (!seller) return null

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function concluirTarefa(taskId: string) {
    setActionLoading(taskId)
    const { error } = await supabase
      .from('tasks')
      .update({ status_crm: 'concluida', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    setActionLoading(null)
    if (error) { toast.error('Erro ao concluir tarefa'); return }
    toast.success('Tarefa concluída!')
    refetchTarefas()
  }

  // ── Header saudação ───────────────────────────────────────────────────────

  const h        = new Date().getHours()
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = seller.name.split(' ')[0]

  // ── Abas ─────────────────────────────────────────────────────────────────

  const tabs: { key: VendedorTab; label: string }[] = [
    { key: 'meu-dia',  label: 'Meu Dia'  },
    { key: 'tarefas',  label: 'Tarefas'  },
    { key: 'perfil',   label: 'Perfil'   },
    { key: 'evolucao', label: 'Evolução' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* ── Barra de abas ──────────────────────────────────────────────── */}
      <div className="flex items-center px-8 border-b border-gray-100 bg-white gap-6">
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative pb-3 pt-3 text-[14px] transition-all -mb-px',
                active
                  ? 'font-semibold text-gray-900 border-b-2 border-[#3B5BDB]'
                  : 'font-medium text-gray-400 border-b-2 border-transparent hover:text-gray-600'
              )}
            >
              {t.label}
              {t.key === 'tarefas' && atrasadas.length > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1 bg-red-500 text-white">
                  {atrasadas.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <div className="px-8 py-6">

        {/* Meu Dia */}
        {tab === 'meu-dia' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {greeting}, {firstName}
                </h1>
                <p className="text-[13px] capitalize text-gray-500">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente..."
                  className="hh-input pl-9"
                />
              </div>
            </div>

            <ActionCenterVendedor
              effectiveSellerId={effectiveSellerId}
              sellerId={seller.id}
              isAdminOrOwner={false}
              isOwner={false}
              debugEnabled={debugEnabled}
              contactFilter={null}
              searchTerm={searchTerm}
              onSetTaskModalOpen={() => {}}
              onSetPlanningModalOpen={() => {}}
              onSetConfigModalOpen={() => {}}
              onSetSelectedTask={() => {}}
              onSetAlertDetailsType={() => {}}
              onSetCallsReportModalOpen={() => {}}
              onSetWhatsappReportModalOpen={() => {}}
              onSetContactFilter={() => {}}
            />
          </div>
        )}

        {/* Tarefas */}
        {tab === 'tarefas' && (
          <TarefasTab
            tasks={minhasTarefas ?? []}
            loading={tarefasLoading}
            actionLoading={actionLoading}
            onConcluir={concluirTarefa}
          />
        )}

        {/* Perfil */}
        {tab === 'perfil' && seller.id && (
          <ProfileHubContent
            sellerId={seller.id}
            isOwnProfile={true}
            canSeeDetails={true}
          />
        )}

        {/* Evolução */}
        {tab === 'evolucao' && <EvolutionEmbed />}
      </div>
    </div>
  )
}

// ── Aba Tarefas ───────────────────────────────────────────────────────────────

function TarefasTab({
  tasks, loading, actionLoading, onConcluir,
}: {
  tasks:         SimpleTask[]
  loading:       boolean
  actionLoading: string | null
  onConcluir:    (id: string) => void
}) {
  const [showDone, setShowDone] = useState(false)

  const pendentes  = tasks.filter(t => t.status_crm === 'pendente')
  const concluidas = tasks.filter(t => t.status_crm === 'concluida')

  // Ordena pendentes: urgente → alta → media → baixa → sem prioridade, depois por data
  const sorted = [...pendentes].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority_crm ?? ''] ?? 99
    const pb = PRIORITY_ORDER[b.priority_crm ?? ''] ?? 99
    if (pa !== pb) return pa - pb
    const da = a.task_date ?? '9999'
    const db = b.task_date ?? '9999'
    return da.localeCompare(db)
  })

  if (loading) {
    return (
      <div className="space-y-3 max-w-2xl">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <CheckSquare className="h-10 w-10" strokeWidth={1} />
        <p className="text-sm font-medium">Nenhuma tarefa atribuída</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Pendentes */}
      {sorted.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pendentes ({sorted.length})
          </p>
          <div className="space-y-2">
            {sorted.map(task => {
              const isOverdue = task.task_date
                ? isBefore(new Date(task.task_date + 'T12:00:00'), startOfDay(new Date()))
                : false
              return (
                <div
                  key={task.id}
                  className={cn(
                    'bg-white rounded-xl border p-4 flex items-start gap-3',
                    isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    {task.task_date && (
                      <p className={cn('text-xs mt-1', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
                        {new Date(task.task_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {isOverdue && ' — atrasada'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.priority_crm && (
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRIORITY_COLOR[task.priority_crm] ?? 'bg-gray-100 text-gray-500')}>
                        {task.priority_crm}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-medium"
                      disabled={actionLoading === task.id}
                      onClick={() => onConcluir(task.id)}
                    >
                      {actionLoading === task.id ? '...' : 'Concluir'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Concluídas (colapsável) */}
      {concluidas.length > 0 && (
        <section>
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-3 hover:text-gray-600 transition-colors"
          >
            Concluídas ({concluidas.length}) {showDone ? '▲' : '▼'}
          </button>
          {showDone && (
            <div className="space-y-2">
              {concluidas.slice(0, 20).map(task => (
                <div key={task.id} className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-400 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
