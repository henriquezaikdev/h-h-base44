import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock, Plus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'
import { iniciarReativacao } from '../../hooks/useReativacao'

interface ClienteRisco {
  id: string
  name: string
  ticket_medio_mensal: number | null
  last_order_at: string | null
  reativacao_score: number | null
  reativacao_status: string | null
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const daysAgo = (d: string | null) => { if (!d) return null; return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000) }

export function CarteiraEmRisco() {
  const nav = useNavigate()
  const { seller } = useAuth()
  const [startingId, setStartingId] = useState<string | null>(null)
  const [started, setStarted] = useState<Set<string>>(new Set())

  const { data: clientes, refetch } = useSupabaseQuery<ClienteRisco[]>(
    ({ company_id }) =>
      supabase.from('clients')
        .select('id,name,ticket_medio_mensal,last_order_at,reativacao_score,reativacao_status')
        .eq('company_id', company_id)
        .eq('status', 'inactive')
        .eq('janela_longa', false)
        .neq('origem', 'filial')
        .is('reativacao_status', null)
        .eq('seller_id', seller!.id)
        .order('reativacao_score', { ascending: false, nullsFirst: false })
        .limit(3),
    [],
  )

  const items = clientes ?? []
  if (items.length === 0) return null

  async function handleStart(c: ClienteRisco) {
    if (!seller) return
    setStartingId(c.id)
    try {
      await iniciarReativacao({ companyId: seller.company_id, sellerId: seller.id, clientId: c.id, clientName: c.name })
      setStarted(p => new Set(p).add(c.id))
      refetch()
      nav(`/clientes/inativos/${c.id}`)
    } catch { /* silent */ } finally { setStartingId(null) }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h3 className="text-sm font-semibold text-[#111827]">Carteira em risco</h3>
        </div>
        <button onClick={() => nav('/clientes/inativos')} className="flex items-center gap-1 text-xs text-[#3B5BDB] hover:text-[#3451C7] font-medium transition-colors">
          Ver todos <ArrowRight size={12} />
        </button>
      </div>

      <div className="divide-y divide-[#F3F4F6]">
        {items.map(c => {
          const dias = daysAgo(c.last_order_at)
          const didStart = started.has(c.id)
          return (
            <div key={c.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <button onClick={() => nav(`/clientes/${c.id}`)}
                  className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] transition-colors truncate block">
                  {c.name}
                </button>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9CA3AF]">
                  <span>{money(c.ticket_medio_mensal ?? 0)}/mês</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} className={dias !== null && dias > 90 ? 'text-red-400' : 'text-[#D1D5DB]'} />
                    <span className={dias !== null && dias > 90 ? 'text-red-500 font-medium' : ''}>{dias ?? '—'} dias</span>
                  </span>
                </div>
              </div>

              {didStart ? (
                <div className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 flex items-center gap-1 shrink-0">
                  <Check size={11} /> Iniciada
                </div>
              ) : (
                <button onClick={() => handleStart(c)} disabled={startingId === c.id}
                  className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-[#3B5BDB] text-white hover:bg-[#3451C7] disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0">
                  <Plus size={11} /> {startingId === c.id ? '...' : 'Iniciar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
