import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSellersData } from '@/hooks/useSellersData'
import { useTasksData } from '@/hooks/useTasksData'
import { OwnerTarefasTab } from '@/components/meu-dia/OwnerTarefasTab'
import { OwnerEquipeTab } from '@/components/meu-dia/OwnerEquipeTab'
import { ProfileHubContent } from '@/components/profile/ProfileHubContent'
import { EvolutionEmbed } from '@/components/meu-dia/EvolutionEmbed'
import { isBefore, startOfDay } from 'date-fns'

type OwnerTab = 'vendas' | 'tarefas' | 'equipe' | 'perfil' | 'evolucao'

interface TabDef {
  id: OwnerTab
  label: string
  badge?: number
}

class TasksErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Erro ao carregar. Recarregue a página.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export function OwnerMeuDia({
  renderVendasTab,
}: {
  renderVendasTab: () => React.ReactNode
}) {
  const { seller, role } = useAuth()
  const { sellers, loading: sellersLoading } = useSellersData()
  const { tasks, loading: tasksLoading } = useTasksData(undefined, seller?.id, role)
  const [activeTab, setActiveTab] = useState<OwnerTab>('vendas')

  const today = startOfDay(new Date())
  const openTasks = (tasks || []).filter(t => t.status === 'pendente')
  const overdueTasks = openTasks.filter(t => t.taskDate && isBefore(new Date(t.taskDate), today))

  const tabBadge = (tab: OwnerTab) => {
    if (tab === 'tarefas' && overdueTasks.length > 0) return overdueTasks.length
    return 0
  }

  const tabs: TabDef[] = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'tarefas', label: 'Tarefas', badge: overdueTasks.length || undefined },
    { id: 'equipe', label: 'Equipe' },
    { id: 'perfil', label: 'Perfil' },
    { id: 'evolucao', label: 'Evolução' },
  ]

  if (sellersLoading || tasksLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9]">
        <div className="flex items-center px-8 pt-6 border-b border-gray-100" style={{ gap: '24px' }}>
          {tabs.map(tab => (
            <div key={tab.id} className="pb-3 -mb-px">
              <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="px-8 py-6 space-y-4">
          <div className="h-8 w-48 bg-gray-100 animate-pulse rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-[72px] bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
          <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="flex items-center px-8 pt-6 border-b border-gray-100" style={{ gap: '24px' }}>
        {tabs.map(tab => {
          const badge = tabBadge(tab.id)
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 transition-all -mb-px text-[14px]',
                isActive
                  ? 'font-semibold text-gray-900 border-b-2 border-[#3B5BDB]'
                  : 'font-medium text-gray-400 border-b-2 border-transparent hover:text-gray-600'
              )}
            >
              {tab.label}
              {badge > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1 bg-red-500 text-white">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-8 py-6">
        {activeTab === 'vendas' && renderVendasTab()}
        {activeTab === 'tarefas' && (
          <TasksErrorBoundary>
            <OwnerTarefasTab sellers={sellers} />
          </TasksErrorBoundary>
        )}
        {activeTab === 'equipe' && (
          <TasksErrorBoundary>
            <OwnerEquipeTab sellers={sellers} />
          </TasksErrorBoundary>
        )}
        {activeTab === 'perfil' && seller?.id && (
          <ProfileHubContent sellerId={seller.id} isOwnProfile={true} canSeeDetails={true} />
        )}
        {activeTab === 'evolucao' && <EvolutionEmbed />}
      </div>
    </div>
  )
}
