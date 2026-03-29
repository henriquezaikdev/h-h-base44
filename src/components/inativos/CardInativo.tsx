import { useNavigate } from 'react-router-dom'
import {
  Phone, MessageCircle, Clock, ChevronDown, ChevronUp,
  Eye, XCircle, Plus, Check, ArrowRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ClienteInativo, PedidoExpandido } from '../../hooks/useClientesInativos'

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtDate = (d: string | null) => { if (!d) return '—'; return new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') }
const fmtCnpj = (v: string | null) => { if (!v) return ''; const d = v.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : v }
const daysAgo = (d: string | null) => { if (!d) return null; return Math.floor((Date.now() - new Date(String(d).replace(' ', 'T')).getTime()) / 86_400_000) }

const ORIGEM: Record<string, string> = { prospeccao:'Prospecção', ligacao:'Prospecção', google:'Google', indicacao:'Indicação', filial:'Filial', porta_loja:'Veio à loja', conta_azul:'Conta Azul', conquistado:'Conquistado', outro:'Outro' }

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  '':              { label: 'Não iniciado', dot: 'bg-[#D1D5DB]' },
  em_reativacao:   { label: 'Em reativação', dot: 'bg-[#3B5BDB]' },
  resgatado:       { label: 'Resgatado', dot: 'bg-emerald-500' },
  perdido:         { label: 'Perdido', dot: 'bg-red-400' },
}

interface Props {
  cliente: ClienteInativo
  rank: number
  orders: PedidoExpandido[] | undefined
  onExpand: (id: string) => void
  isExpanded: boolean
  onOpenModal: (c: ClienteInativo) => void
  onDismiss: (id: string) => void
  onStart: (c: ClienteInativo) => void
  starting: boolean
}

export function CardInativo({ cliente: c, rank, orders, onExpand, isExpanded, onOpenModal, onDismiss, onStart, starting }: Props) {
  const nav = useNavigate()
  const dias = daysAgo(c.last_order_at)
  const st = STATUS_MAP[c.reativacao_status ?? ''] ?? STATUS_MAP['']
  const valorMes = c.ticket_medio_mensal ?? 0
  const score = Math.round(c.reativacao_score ?? 0)

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>

      {/* ── Row ──────────────────────────────────────────────────── */}
      <div className={`px-5 py-3.5 cursor-pointer transition-colors ${isExpanded ? 'bg-[#FAFAF9]' : 'hover:bg-[#FAFAF9]'}`}
           onClick={() => onExpand(c.id)}>
        <div className="flex items-center gap-3">
          {/* Rank */}
          <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-[#6B7280] tabular-nums">{rank}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); onOpenModal(c) }}
                className="text-sm font-semibold text-[#111827] hover:text-[#3B5BDB] transition-colors truncate max-w-[280px]">
                {c.name}
              </button>
              {c.cnpj && <span className="text-[10px] text-[#D1D5DB] font-mono hidden xl:inline">{fmtCnpj(c.cnpj)}</span>}
              {c.origem && (
                <span className="text-[10px] text-[#9CA3AF] border border-[#F3F4F6] px-1.5 py-0.5 rounded hidden lg:inline">
                  {ORIGEM[c.origem] ?? c.origem}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-[#9CA3AF]">
              <span>{money(valorMes)}<span className="text-[#E5E7EB]">/mês</span></span>
              <span>{c.sellers?.name ?? '—'}</span>
            </div>
          </div>

          {/* Days */}
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={12} className={dias !== null && dias > 90 ? 'text-red-400' : 'text-[#D1D5DB]'} />
            <span className={`text-sm font-semibold tabular-nums ${dias !== null && dias > 90 ? 'text-red-500' : 'text-[#374151]'}`}>
              {dias ?? '—'}
            </span>
            <span className="text-[10px] text-[#D1D5DB]">dias</span>
          </div>

          {/* Score */}
          <div className="w-11 h-7 rounded-md bg-[#3B5BDB] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white tabular-nums">{score}</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 min-w-[100px] shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            <span className="text-xs text-[#6B7280]">{st.label}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            {c.phone && (
              <>
                <a href={`tel:${c.phone}`} title="Ligar"
                   className="w-7 h-7 rounded-md flex items-center justify-center text-[#D1D5DB] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                  <Phone size={13} />
                </a>
                <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp"
                   className="w-7 h-7 rounded-md flex items-center justify-center text-[#D1D5DB] hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <MessageCircle size={13} />
                </a>
              </>
            )}
            <button onClick={() => onOpenModal(c)} title="Ver ficha"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#D1D5DB] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors">
              <Eye size={13} />
            </button>
            <button onClick={() => onDismiss(c.id)} title="Remover da fila"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#D1D5DB] hover:text-red-500 hover:bg-red-50 transition-colors">
              <XCircle size={13} />
            </button>

            {!c.reativacao_status || c.reativacao_status === '' ? (
              <button onClick={() => onStart(c)} disabled={starting}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-[#3B5BDB] text-white hover:bg-[#3451C7] disabled:opacity-50 transition-colors flex items-center gap-1 ml-0.5">
                <Plus size={11} /> {starting ? '...' : 'Iniciar'}
              </button>
            ) : c.reativacao_status === 'em_reativacao' ? (
              <button onClick={() => nav(`/clientes/inativos/${c.id}`)}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium text-[#3B5BDB] border border-[#3B5BDB]/20 hover:bg-[#EEF2FF] transition-colors flex items-center gap-1 ml-0.5">
                Continuar <ArrowRight size={11} />
              </button>
            ) : c.reativacao_status === 'resgatado' ? (
              <div className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 flex items-center gap-1 ml-0.5">
                <Check size={11} /> Resgatado
              </div>
            ) : null}
          </div>

          {/* Chevron */}
          <div className="shrink-0">
            {isExpanded ? <ChevronUp size={14} className="text-[#D1D5DB]" /> : <ChevronDown size={14} className="text-[#D1D5DB]" />}
          </div>
        </div>
      </div>

      {/* ── Expanded ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="px-5 pb-4 bg-[#FAFAF9]">
              <div className="ml-10 border-l-2 border-[#E5E7EB] pl-5 py-2 space-y-4">

                {/* Orders */}
                <div>
                  <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Últimos pedidos</p>
                  {!orders ? (
                    <p className="text-xs text-[#D1D5DB]">Carregando...</p>
                  ) : orders.length === 0 ? (
                    <p className="text-xs text-[#D1D5DB]">Sem pedidos registrados</p>
                  ) : (
                    <div className="space-y-1.5">
                      {orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-[#9CA3AF] tabular-nums text-xs w-16">{fmtDate(o.created_at)}</span>
                            <span className="text-[#374151] truncate max-w-[300px]">{o.order_items?.[0]?.products?.name ?? '—'}</span>
                          </div>
                          <span className="font-semibold text-[#111827] tabular-nums">{money(o.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-2.5 border-t border-[#E5E7EB] flex items-center gap-4 text-xs text-[#9CA3AF]">
                    <span>{c.total_orders ?? 0} pedidos</span>
                    <span>{money(c.total_revenue ?? 0)} total</span>
                  </div>
                </div>

                {/* AI Suggestion */}
                {c.reativacao_sugestao_ia && (
                  <div className="bg-[#EEF2FF] rounded-lg px-4 py-3">
                    <p className="text-[10px] font-semibold text-[#3B5BDB] uppercase tracking-widest mb-1">Sugestão IA</p>
                    <p className="text-sm text-[#374151] leading-relaxed">{c.reativacao_sugestao_ia}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => nav(`/clientes/${c.id}`)}
                    className="text-xs text-[#6B7280] hover:text-[#3B5BDB] font-medium transition-colors">
                    Ver ficha completa →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
