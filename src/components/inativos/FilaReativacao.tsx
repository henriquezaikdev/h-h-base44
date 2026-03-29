import { Target } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import type { ClienteInativo, PedidoExpandido } from '../../hooks/useClientesInativos'
import { CardInativo } from './CardInativo'

interface Props {
  clientes: ClienteInativo[]
  loading: boolean
  expandedId: string | null
  ordersCache: Record<string, PedidoExpandido[]>
  startingId: string | null
  onExpand: (id: string) => void
  onOpenModal: (c: ClienteInativo) => void
  onDismiss: (id: string) => void
  onStart: (c: ClienteInativo) => void
}

export function FilaReativacao({ clientes, loading, expandedId, ordersCache, startingId, onExpand, onOpenModal, onDismiss, onStart }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#9CA3AF]">Carregando fila...</span>
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 text-center">
        <Target size={28} className="text-[#D1D5DB] mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[#6B7280]">Nenhum cliente na fila</p>
        <p className="text-xs text-[#9CA3AF] mt-1">Todos os clientes inativos já foram processados</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] overflow-hidden">
      <AnimatePresence mode="popLayout">
        {clientes.map((c, i) => (
          <CardInativo
            key={c.id}
            cliente={c}
            rank={i + 1}
            orders={ordersCache[c.id]}
            isExpanded={expandedId === c.id}
            onExpand={onExpand}
            onOpenModal={onOpenModal}
            onDismiss={onDismiss}
            onStart={onStart}
            starting={startingId === c.id}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
