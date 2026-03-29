import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Phone, MessageCircle, UserCheck, MessageSquare, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InactiveClient {
  id: string
  name: string
  phone: string | null
  status: string
  seller_id: string | null
  origem: string | null
  last_order_at: string | null
  created_at: string
  sellers: { name: string } | null
}

interface RecentTask {
  client_id: string
}

interface RecentQuote {
  client_id: string
}

type KanbanColumn = 'sem_contato' | 'contatado' | 'proposta' | 'reativado'

interface KanbanCard extends InactiveClient {
  column: KanbanColumn
  daysSinceOrder: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

const ORIGEM_LABELS: Record<string, string> = {
  ligacao: 'Prospecção',
  google: 'Google',
  indicacao: 'Indicação',
  filial: 'Filial',
  porta_loja: 'Porta a porta',
  conta_azul: 'Conta Azul',
  conquistado: 'Conquistado',
}

const COLUMN_CFG: { key: KanbanColumn; label: string; color: string; dotColor: string }[] = [
  { key: 'sem_contato', label: 'Sem contato',      color: 'text-red-600',     dotColor: 'bg-red-500' },
  { key: 'contatado',   label: 'Contatado',         color: 'text-amber-600',   dotColor: 'bg-amber-500' },
  { key: 'proposta',    label: 'Proposta enviada',   color: 'text-[#3B5BDB]',  dotColor: 'bg-[#3B5BDB]' },
  { key: 'reativado',   label: 'Reativado',          color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

interface KanbanQueryResult {
  clients: InactiveClient[]
  recentTasks: RecentTask[]
  recentQuotes: RecentQuote[]
  reactivatedClients: { id: string }[]
}

export default function KanbanInativosPage() {
  const navigate = useNavigate()
  const { seller } = useAuth()

  const [contactModalClient, setContactModalClient] = useState<KanbanCard | null>(null)
  const [contactNote, setContactNote]     = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [savingReactivate, setSavingReactivate] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data, loading, refetch } = useSupabaseQuery<KanbanQueryResult>(
    async ({ company_id }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

      const [clientsRes, tasksRes, quotesRes, reactivatedRes] = await Promise.all([
        // Inactive clients (excluding filial)
        supabase
          .from('clients')
          .select('id, name, phone, status, seller_id, origem, last_order_at, created_at, sellers(name)')
          .eq('company_id', company_id)
          .eq('status', 'inactive')
          .neq('origem', 'filial')
          .order('last_order_at', { ascending: true, nullsFirst: true }),
        // Recent tasks linked to clients (last 30 days)
        supabase
          .from('tasks')
          .select('client_id')
          .eq('company_id', company_id)
          .gte('created_at', thirtyDaysAgo)
          .not('client_id', 'is', null),
        // Recent quotes pending (last 30 days)
        supabase
          .from('quotes')
          .select('client_id')
          .eq('company_id', company_id)
          .eq('status', 'pending')
          .gte('created_at', thirtyDaysAgo),
        // Recently reactivated clients
        supabase
          .from('clients')
          .select('id')
          .eq('company_id', company_id)
          .eq('status', 'active')
          .not('reativado_em' as string, 'is', null),
      ])

      if (clientsRes.error) return { data: null, error: clientsRes.error }

      return {
        data: {
          clients:            (clientsRes.data ?? []) as unknown as InactiveClient[],
          recentTasks:        (tasksRes.data ?? []) as unknown as RecentTask[],
          recentQuotes:       (quotesRes.data ?? []) as unknown as RecentQuote[],
          reactivatedClients: (reactivatedRes.data ?? []) as unknown as { id: string }[],
        },
        error: null,
      }
    },
    [],
  )

  // ── Classify into columns ────────────────────────────────────────────────

  const cards = useMemo(() => {
    if (!data) return []

    const taskClientIds   = new Set((data.recentTasks ?? []).map(t => t.client_id))
    const quoteClientIds  = new Set((data.recentQuotes ?? []).map(q => q.client_id))

    const result: KanbanCard[] = []

    // Add inactive clients
    for (const c of data.clients) {
      let column: KanbanColumn = 'sem_contato'

      if (quoteClientIds.has(c.id)) {
        column = 'proposta'
      } else if (taskClientIds.has(c.id)) {
        column = 'contatado'
      }

      result.push({
        ...c,
        column,
        daysSinceOrder: daysSince(c.last_order_at),
      })
    }

    // Mark any client that was reactivated into the "reativado" column
    const reactivatedIds = new Set((data.reactivatedClients ?? []).map(r => r.id))
    for (const card of result) {
      if (reactivatedIds.has(card.id)) card.column = 'reativado'
    }

    return result
  }, [data])

  const columns = useMemo(() => {
    const grouped: Record<KanbanColumn, KanbanCard[]> = {
      sem_contato: [],
      contatado: [],
      proposta: [],
      reativado: [],
    }
    for (const card of cards) {
      grouped[card.column].push(card)
    }
    return grouped
  }, [cards])

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleRegisterContact() {
    if (!contactModalClient || !seller) return
    setSavingContact(true)
    try {
      await supabase.from('tasks').insert({
        title:                  `Contato com ${contactModalClient.name}`,
        status:                 'open',
        status_crm:             'pendente',
        priority_crm:           'media',
        client_id:              contactModalClient.id,
        assigned_to_seller_id:  contactModalClient.seller_id ?? seller.id,
        assigned_to:            contactModalClient.seller_id ?? seller.id,
        created_by_seller_id:   seller.id,
        company_id:             seller.company_id,
        description:            contactNote || null,
        task_date:              new Date().toISOString().slice(0, 10),
      })
      setContactModalClient(null)
      setContactNote('')
      refetch()
    } finally {
      setSavingContact(false)
    }
  }

  async function handleReactivate(card: KanbanCard) {
    if (!seller) return
    setSavingReactivate(card.id)
    try {
      await supabase
        .from('clients')
        .update({
          status: 'active',
          reativado_em: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', card.id)
      refetch()
    } finally {
      setSavingReactivate(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <button
          onClick={() => navigate('/clientes')}
          className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] mb-3 transition-colors"
        >
          <ChevronLeft size={14} /> Carteira de Clientes
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Clientes Inativos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {loading ? 'Carregando...' : `${cards.length} cliente${cards.length !== 1 ? 's' : ''} inativo${cards.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="px-6 py-5">
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-16 flex items-center justify-center">
            <span className="text-sm text-[#9CA3AF]">Carregando clientes inativos...</span>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMN_CFG.map(({ key, label, color, dotColor }) => {
              const colCards = columns[key]
              return (
                <div key={key} className="min-w-[300px] w-[300px] shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    <span className="text-xs text-[#9CA3AF] ml-auto tabular-nums">{colCards.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {colCards.length === 0 ? (
                      <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-6 text-center">
                        <p className="text-xs text-[#9CA3AF]">Nenhum cliente</p>
                      </div>
                    ) : (
                      colCards.map(card => (
                        <div
                          key={card.id}
                          className="bg-white border border-[#E5E7EB] rounded-xl p-3 hover:shadow-[0_1px_4px_0_rgb(0,0,0,0.06)] transition-shadow"
                        >
                          {/* Client name + navigate */}
                          <button
                            onClick={() => navigate(`/clientes/${card.id}`)}
                            className="text-sm font-medium text-[#111827] hover:text-[#3B5BDB] text-left transition-colors leading-tight"
                          >
                            {card.name}
                          </button>

                          {/* Meta info */}
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {card.daysSinceOrder !== null ? (
                              <span className="text-[10px] text-[#9CA3AF]">
                                {card.daysSinceOrder} dias sem pedido
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#9CA3AF]">Sem pedidos</span>
                            )}
                            {card.sellers?.name && (
                              <span className="text-[10px] text-[#6B7280]">
                                · {card.sellers.name}
                              </span>
                            )}
                          </div>

                          {/* Origin badge */}
                          {card.origem && card.origem !== 'filial' && (
                            <span className="inline-flex mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              {ORIGEM_LABELS[card.origem] ?? card.origem}
                            </span>
                          )}

                          {/* Actions */}
                          {key !== 'reativado' && (
                            <div className="mt-2.5 pt-2 border-t border-[#F3F4F6] flex items-center gap-1.5">
                              {card.phone && (
                                <>
                                  <a
                                    href={`tel:${card.phone}`}
                                    title="Ligar"
                                    className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                                  >
                                    <Phone size={13} />
                                  </a>
                                  <a
                                    href={`https://wa.me/55${card.phone.replace(/\D/g, '')}`}
                                    target="_blank" rel="noreferrer" title="WhatsApp"
                                    className="p-1.5 rounded-md text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                </>
                              )}
                              <button
                                onClick={() => { setContactModalClient(card); setContactNote('') }}
                                title="Registrar contato"
                                className="flex items-center gap-1 ml-auto px-2 py-1 text-[10px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F9FAFB] transition-colors"
                              >
                                <MessageSquare size={11} /> Contato
                              </button>
                              <button
                                onClick={() => handleReactivate(card)}
                                disabled={savingReactivate === card.id}
                                title="Reativar cliente"
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                              >
                                <UserCheck size={11} />
                                {savingReactivate === card.id ? '...' : 'Reativar'}
                              </button>
                            </div>
                          )}

                          {key === 'reativado' && (
                            <div className="mt-2.5 pt-2 border-t border-[#F3F4F6]">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                Cliente reativado
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Contact Modal ──────────────────────────────────────────────── */}
      {contactModalClient && (
        <ContactModal
          client={contactModalClient}
          contactNote={contactNote}
          setContactNote={setContactNote}
          savingContact={savingContact}
          onClose={() => setContactModalClient(null)}
          onSave={handleRegisterContact}
        />
      )}
    </div>
  )
}

// ─── Contact Modal (extracted for Escape handler) ─────────────────────────────

function ContactModal({ client, contactNote, setContactNote, savingContact, onClose, onSave }: {
  client: KanbanCard
  contactNote: string
  setContactNote: (v: string) => void
  savingContact: boolean
  onClose: () => void
  onSave: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">Registrar Contato</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">{client.name}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Observação (opcional)</label>
              <textarea
                value={contactNote}
                onChange={e => setContactNote(e.target.value)}
                rows={3}
                placeholder="Ex: Ligou para verificar interesse em recompra..."
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition resize-none"
              />
            </div>

            <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={savingContact}
                className="px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-60 transition-colors"
              >
                {savingContact ? 'Salvando...' : 'Registrar Contato'}
              </button>
            </div>
          </div>
        </div>
  )
}
