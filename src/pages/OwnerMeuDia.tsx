import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSellersData } from '@/hooks/useSellersData'
import { OwnerMeuDia as OwnerMeuDiaComponent } from '@/components/meu-dia/OwnerMeuDia'
import { ActionCenterVendedor } from '@/components/action-center/ActionCenterVendedor'
import { Loader2, Search, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

class OwnerErrorBoundary extends React.Component<
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
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-red-600 font-medium">Erro ao carregar</p>
          <p className="text-sm text-gray-500 max-w-md text-center">{this.state.error?.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function OwnerMeuDia() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { seller, role, isLoading: authLoading } = useAuth()
  const { sellers } = useSellersData()
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin'
  const isAdminOrOwner = isOwner || isAdmin

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')

  const urlSellerId = searchParams.get('sellerId')

  useEffect(() => {
    if (authLoading || !seller?.id) return
    setSelectedSellerId(urlSellerId || 'all')
  }, [authLoading, seller?.id, urlSellerId])

  const effectiveSellerId = seller?.id
    ? selectedSellerId === 'all' ? null : selectedSellerId || seller.id
    : null

  const handleSellerChange = (sellerId: string) => {
    setSelectedSellerId(sellerId)
    if (sellerId === 'all') setSearchParams({})
    else setSearchParams({ sellerId })
  }

  const debugEnabled = searchParams.get('debug') === '1'

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-[#3B5BDB]" />
      </div>
    )
  }

  const renderVendasTab = () => {
    const h = new Date().getHours()
    const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {greeting}{seller?.name ? `, ${seller.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-[13px] capitalize text-gray-500">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente..."
                className="hh-input pl-9"
              />
            </div>

            {isAdminOrOwner && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Colaborador:</span>
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

            <button className="btn-primary">
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </button>
          </div>
        </div>

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
    )
  }

  return (
    <OwnerErrorBoundary>
      <OwnerMeuDiaComponent renderVendasTab={renderVendasTab} />
    </OwnerErrorBoundary>
  )
}
