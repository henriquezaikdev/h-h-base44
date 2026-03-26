import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, TrendingDown, RefreshCw, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ClientePrioridade {
  id: string
  name: string
  trade_name: string | null
  last_order_at: string | null
  avg_reorder_days: number | null
  total_revenue: number
  avg_ticket: number
  priority_score: number
  diasSemComprar: number
  motivo: string
  tipoAlerta: 'risco' | 'atraso' | 'recompra' | 'oportunidade'
}

const ALERT_CONFIG = {
  risco: { label: 'Risco de perda', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', icon: TrendingDown },
  atraso: { label: 'Fora do ciclo', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-400', icon: Clock },
  recompra: { label: 'Recompra no prazo', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', dot: 'bg-indigo-500', icon: RefreshCw },
  oportunidade: { label: 'Oportunidade', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500', icon: AlertTriangle },
}

function calcularTipoAlerta(dias: number, avgReorder: number | null): { tipo: ClientePrioridade['tipoAlerta']; motivo: string } {
  if (!avgReorder || avgReorder === 0) {
    if (dias > 90) return { tipo: 'risco', motivo: `Sem compras ha ${dias} dias — sem historico de ciclo` }
    if (dias > 45) return { tipo: 'atraso', motivo: `Sem compras ha ${dias} dias` }
    return { tipo: 'oportunidade', motivo: `Cliente ativo — ${dias} dias sem comprar` }
  }
  const p = dias / avgReorder
  if (p >= 2.0) return { tipo: 'risco', motivo: `${dias} dias sem comprar — ciclo medio e ${Math.round(avgReorder)}d` }
  if (p >= 1.3) return { tipo: 'atraso', motivo: `Fora do ciclo — deveria ter comprado ha ${Math.round(dias - avgReorder)} dias` }
  if (p >= 0.85) return { tipo: 'recompra', motivo: `Proximo da recompra — ciclo medio ${Math.round(avgReorder)} dias` }
  return { tipo: 'oportunidade', motivo: `Dentro do ciclo (${dias}d de ${Math.round(avgReorder)}d)` }
}

export function FilaPrioridades() {
  const [clientes, setClientes] = useState<ClientePrioridade[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<ClientePrioridade['tipoAlerta'] | 'todos'>('todos')
  const navigate = useNavigate()
  const { seller } = useAuth()

  useEffect(() => { if (seller?.id) carregarFila() }, [seller?.id])

  const carregarFila = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, trade_name, last_order_at, avg_reorder_days, total_revenue, avg_ticket, priority_score, status')
        .eq('seller_id', seller!.id)
        .eq('status', 'active')
        .not('last_order_at', 'is', null)
        .order('priority_score', { ascending: false })
        .limit(60)

      if (error) throw error

      const agora = Date.now()
      const processados: ClientePrioridade[] = (data || [])
        .map(c => {
          const diasSemComprar = c.last_order_at ? Math.floor((agora - new Date(c.last_order_at).getTime()) / (1000 * 60 * 60 * 24)) : 999
          const { tipo, motivo } = calcularTipoAlerta(diasSemComprar, c.avg_reorder_days)
          return { ...c, diasSemComprar, motivo, tipoAlerta: tipo }
        })
        .sort((a, b) => {
          const ordem = { risco: 0, atraso: 1, recompra: 2, oportunidade: 3 }
          const diff = ordem[a.tipoAlerta] - ordem[b.tipoAlerta]
          return diff !== 0 ? diff : b.diasSemComprar - a.diasSemComprar
        })
        .slice(0, 25)

      setClientes(processados)
    } catch (err) {
      console.error('Erro fila prioridades:', err)
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = filtro === 'todos' ? clientes : clientes.filter(c => c.tipoAlerta === filtro)
  const contadores = { risco: clientes.filter(c => c.tipoAlerta === 'risco').length, atraso: clientes.filter(c => c.tipoAlerta === 'atraso').length, recompra: clientes.filter(c => c.tipoAlerta === 'recompra').length, oportunidade: clientes.filter(c => c.tipoAlerta === 'oportunidade').length }
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Fila de Prioridades</h3>
          <p className="text-xs text-gray-400 mt-0.5">Quem atacar hoje</p>
        </div>
        <button onClick={carregarFila} disabled={loading} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 flex gap-2 flex-wrap">
        <button onClick={() => setFiltro('todos')} className={`text-xs px-3 py-1 rounded-full transition-colors ${filtro === 'todos' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          Todos ({clientes.length})
        </button>
        {(Object.keys(contadores) as ClientePrioridade['tipoAlerta'][]).map(tipo => {
          if (contadores[tipo] === 0) return null
          const cfg = ALERT_CONFIG[tipo]
          return (
            <button key={tipo} onClick={() => setFiltro(tipo)} className={`text-xs px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 ${filtro === tipo ? `${cfg.bg} ${cfg.color} font-medium` : 'border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label} ({contadores[tipo]})
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">Nenhum cliente nesta categoria</div>
        ) : (
          clientesFiltrados.map((cliente, i) => {
            const cfg = ALERT_CONFIG[cliente.tipoAlerta]
            const Icon = cfg.icon
            return (
              <button key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group">
                <span className="text-xs text-gray-300 font-mono w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{cliente.trade_name || cliente.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{cliente.motivo}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 ${cfg.bg}`}>
                  <Icon size={11} className={cfg.color} />
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs font-medium text-gray-700">{formatCurrency(cliente.avg_ticket || 0)}</p>
                  <p className="text-xs text-gray-400">ticket medio</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
              </button>
            )
          })
        )}
      </div>

      {clientes.length >= 25 && (
        <div className="px-5 py-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Exibindo os 25 principais clientes</p>
        </div>
      )}
    </div>
  )
}
