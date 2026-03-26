import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSellersData } from '@/hooks/useSellersData'
import { useTasksData } from '@/hooks/useTasksData'
import { OwnerMeuDia } from '@/components/meu-dia/OwnerMeuDia'
import { ActionCenterVendedor } from '@/components/action-center/ActionCenterVendedor'
import { ProfileHubContent } from '@/components/profile/ProfileHubContent'
import { OwnerTarefasTab } from '@/components/meu-dia/OwnerTarefasTab'
import { EvolutionEmbed } from '@/components/meu-dia/EvolutionEmbed'
import { Loader2, Search, Plus } from 'lucide-react'
import { format, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// Error boundary to catch runtime crashes
class MeuDiaErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MeuDia] Runtime crash:', error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-destructive font-medium">Erro ao carregar Meu Dia</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {this.state.error?.message}
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type VendedorTab = 'meu-dia' | 'tarefas' | 'perfil' | 'evolucao'

export default function ActionCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { seller, role, isLoading: authLoading } = useAuth()
  const { sellers } = useSellersData()
  const { tasks } = useTasksData(undefined, seller?.id, role)

  const isOwner = role === 'owner'
  const isAdmin = role === 'admin'
  const isAdminOrOwner = isOwner || isAdmin

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')
  const [vendedorTab, setVendedorTab] = useState<VendedorTab>('meu-dia')

  const urlSellerId = searchParams.get('sellerId')

  useEffect(() => {
    if (authLoading || !seller?.id) return
    if (isAdminOrOwner) {
      setSelectedSellerId(urlSellerId || 'all')
    } else {
      setSelectedSellerId(seller.id)
    }
  }, [authLoading, seller?.id, isAdminOrOwner, urlSellerId])

  const effectiveSellerId = seller?.id
    ? isAdminOrOwner
      ? selectedSellerId === 'all' ? null : selectedSellerId || seller.id
      : seller.id
    : null

  const handleSellerChange = (sellerId: string) => {
    setSelectedSellerId(sellerId)
    if (sellerId === 'all') setSearchParams({})
    else setSearchParams({ sellerId })
  }

  const debugEnabled = isAdminOrOwner && searchParams.get('debug') === '1'

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  // Clinical Premium Header
  const renderClinicalHeader = () => {
    const h = new Date().getHours()
    const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    return (
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {greeting}{seller?.name ? `, ${seller.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[13px] capitalize text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente..."
              className="hh-input pl-9"
            />
          </div>

          {/* Seller Filter - only for owner/admin */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Colaborador:</span>
              <select
                value={selectedSellerId}
                onChange={(e) => handleSellerChange(e.target.value)}
                className="hh-select"
              >
                <option value="all">Todos os vendedores</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* New Task Button */}
          <button className="btn-primary">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </button>
        </div>
      </div>
    )
  }

  // Owner/Admin: render OwnerMeuDia with 5-tab interface
  if (isOwner) {
    const renderVendasTab = () => (
      <div className="bg-background">
        <div className="space-y-8">
          {renderClinicalHeader()}
          <div className="mt-4 space-y-8">
            <ActionCenterVendedor
              effectiveSellerId={effectiveSellerId}
              sellerId={seller?.id || ''}
              isAdminOrOwner={isAdminOrOwner}
              isOwner={isOwner}
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
        </div>
      </div>
    )

    return (
      <MeuDiaErrorBoundary>
        <OwnerMeuDia renderVendasTab={renderVendasTab} />
      </MeuDiaErrorBoundary>
    )
  }

  // Vendedor view with 4 tabs
  const vendedorTabs: { key: VendedorTab; label: string }[] = [
    { key: 'meu-dia', label: 'Meu Dia' },
    { key: 'tarefas', label: 'Tarefas' },
    { key: 'perfil', label: 'Perfil' },
    { key: 'evolucao', label: 'Evolucao' },
  ]

  const today = startOfDay(new Date())
  const pendingTasks = (tasks ?? []).filter((t) => t.status === 'pendente')
  const overdueTasks = pendingTasks.filter((t) => t.taskDate && isBefore(new Date(t.taskDate), today))

  return (
    <MeuDiaErrorBoundary>
    <div className="min-h-screen bg-background">
      <div className="flex items-center px-8 pt-6 border-b border-border" style={{ gap: '24px' }}>
        {vendedorTabs.map(tab => {
          const isActive = vendedorTab === tab.key
          return (
            <button key={tab.key} onClick={() => setVendedorTab(tab.key)}
              className={cn(
                "pb-3 transition-all -mb-px text-[14px]",
                isActive ? "font-semibold text-foreground border-b-2 border-primary" : "font-medium text-muted-foreground border-b-2 border-transparent"
              )}>
              {tab.label}
              {tab.key === 'tarefas' && overdueTasks.length > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1 bg-destructive text-white">
                  {overdueTasks.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-8 py-6">
        {vendedorTab === 'meu-dia' && (
          <div className="space-y-8">
            {renderClinicalHeader()}
            <div className="mt-4 space-y-8">
              <ActionCenterVendedor
                effectiveSellerId={effectiveSellerId}
                sellerId={seller?.id || ''}
                isAdminOrOwner={isAdminOrOwner}
                isOwner={isOwner}
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
          </div>
        )}
        {vendedorTab === 'tarefas' && seller?.id && <OwnerTarefasTab sellers={sellers} />}
        {vendedorTab === 'perfil' && seller?.id && <ProfileHubContent sellerId={seller.id} isOwnProfile={true} canSeeDetails={true} />}
        {vendedorTab === 'evolucao' && <EvolutionEmbed />}
      </div>
    </div>
    </MeuDiaErrorBoundary>
  )
}
