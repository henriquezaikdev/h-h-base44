import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Truck, CheckSquare, User, LogOut, RefreshCw, Menu,
  Fuel, Wrench, ChevronDown, ChevronUp, ExternalLink,
  Plus, Zap, Package, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { useSupabaseQuery } from '../hooks/useSupabaseQuery'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { cn } from '../lib/utils'
import type { Seller } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'entregas' | 'tarefas' | 'perfil' | 'abastecimentos' | 'manutencao'

interface EntregaEO {
  id: string
  cod_entrega: string | null
  destinatario: string | null
  endereco: string | null
  controle_pedido: string | null
  status: string | null
  data_baixa: string | null
  hora_baixa: string | null
  link: string | null
}

interface FuelLog {
  id: string
  fuel_date: string
  km: number | null
  liters: number | null
  amount: number | null
  fuel_type: string | null
  station: string | null
}

interface MaintenanceLog {
  id: string
  title: string
  maintenance_type: string | null
  maintenance_date: string
  km: number | null
  cost: number | null
  supplier: string | null
}

interface DeliveryTask {
  id: string
  title: string
  task_date: string | null
  priority_crm: string | null
  status_crm: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function getLevelTitle(nivel: number): string {
  if (nivel <= 2) return 'Iniciante'
  if (nivel <= 4) return 'Explorador'
  if (nivel <= 7) return 'Corredor'
  if (nivel <= 10) return 'Águia'
  return 'Lendário'
}

function getStatusBadge(status: string | null) {
  const s = (status ?? '').toUpperCase()
  if (s === 'ENTREGUE')                   return { label: 'Entregue',      cls: 'bg-emerald-100 text-emerald-700' }
  if (s === 'EM ROTA' || s === 'COLETADO') return { label: 'Em rota',       cls: 'bg-blue-100 text-blue-700' }
  if (s.includes('CANCELAD'))              return { label: 'Cancelada',     cls: 'bg-red-100 text-red-700' }
  if (s.includes('NÃO ENTREGUE'))          return { label: 'Não entregue',  cls: 'bg-orange-100 text-orange-700' }
  if (s.includes('REENTREGA'))             return { label: 'Reentrega',     cls: 'bg-yellow-100 text-yellow-700' }
  return { label: status ?? 'Pendente', cls: 'bg-gray-100 text-gray-600' }
}

function groupByMonth(list: EntregaEO[]): [string, EntregaEO[]][] {
  const map = new Map<string, EntregaEO[]>()
  for (const e of list) {
    const key = e.data_baixa ? e.data_baixa.substring(0, 7) : 'sem-data'
    const arr = map.get(key) ?? []
    arr.push(e)
    map.set(key, arr)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

function monthLabel(ym: string) {
  if (ym === 'sem-data') return 'Sem data'
  try {
    const s = format(parseISO(ym + '-01'), "MMMM yyyy", { locale: ptBR })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return ym }
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const TAB_LABELS: Record<Tab, string> = {
  entregas:       'Entregas',
  tarefas:        'Tarefas',
  perfil:         'Perfil',
  abastecimentos: 'Abastecimentos',
  manutencao:     'Manutenção do Veículo',
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function EntregadorDashboard() {
  const { seller, logout } = useAuthContext()
  const [tab, setTab]           = useState<Tab>('entregas')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fuelOpen, setFuelOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const firstName = seller?.name.split(' ')[0] ?? ''
  const ym = currentYearMonth()

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: entregas, loading: entregasLoading, refetch: refetchEntregas } =
    useSupabaseQuery<EntregaEO[]>(
      ({ company_id }) =>
        supabase
          .from('entregas_eo')
          .select('id, cod_entrega, destinatario, endereco, controle_pedido, status, data_baixa, hora_baixa, link')
          .eq('company_id', company_id)
          .ilike('entregador', `%${firstName}%`)
          .order('data_baixa', { ascending: false }),
      [firstName]
    )

  const { data: fuels, loading: fuelsLoading, refetch: refetchFuels } =
    useSupabaseQuery<FuelLog[]>(
      ({ seller: s, company_id }) =>
        supabase
          .from('vehicle_fuel_logs')
          .select('id, fuel_date, km, liters, amount, fuel_type, station')
          .eq('company_id', company_id)
          .eq('seller_id', s.id)
          .order('fuel_date', { ascending: false }),
      []
    )

  const { data: maintenances, loading: maintenancesLoading } =
    useSupabaseQuery<MaintenanceLog[]>(
      ({ seller: s, company_id }) =>
        supabase
          .from('vehicle_maintenance_logs')
          .select('id, title, maintenance_type, maintenance_date, km, cost, supplier')
          .eq('company_id', company_id)
          .eq('seller_id', s.id)
          .order('maintenance_date', { ascending: false }),
      []
    )

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } =
    useSupabaseQuery<DeliveryTask[]>(
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

  // ── XP / Gamificação ─────────────────────────────────────────────────────

  const allEntregas   = entregas ?? []
  const xpTotal       = allEntregas.filter(e => (e.status ?? '').toUpperCase() === 'ENTREGUE').length * 5
  const xpMes         = allEntregas.filter(e =>
    (e.status ?? '').toUpperCase() === 'ENTREGUE' && e.data_baixa?.startsWith(ym)
  ).length * 5
  const entregasMes   = allEntregas.filter(e => e.data_baixa?.startsWith(ym)).length
  const nivel         = Math.floor(xpTotal / 200) + 1
  const titulo        = getLevelTitle(nivel)
  const xpNoNivel     = xpTotal % 200
  const xpProgress    = (xpNoNivel / 200) * 100

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

  if (!seller) return null

  // ── Navigation ────────────────────────────────────────────────────────────

  const navItems: { key: Tab; icon: React.ReactNode }[] = [
    { key: 'perfil',         icon: <User className="h-5 w-5" strokeWidth={1.5} /> },
    { key: 'tarefas',        icon: <CheckSquare className="h-5 w-5" strokeWidth={1.5} /> },
    { key: 'entregas',       icon: <Truck className="h-5 w-5" strokeWidth={1.5} /> },
    { key: 'abastecimentos', icon: <Fuel className="h-5 w-5" strokeWidth={1.5} /> },
    { key: 'manutencao',     icon: <Wrench className="h-5 w-5" strokeWidth={1.5} /> },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#FAFAF9] overflow-hidden">

      {/* ── Header (indigo) ─────────────────────────────────────────────── */}
      <div className="bg-[#3B5BDB] text-white flex-shrink-0">

        {/* Title bar */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-base font-semibold">{TAB_LABELS[tab]}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={refetchEntregas}
              aria-label="Atualizar"
              className="opacity-80 hover:opacity-100 transition-opacity"
            >
              <RefreshCw className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="opacity-80 hover:opacity-100 transition-opacity"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Expanded XP section — only on Entregas tab */}
        {tab === 'entregas' && (
          <div className="px-4 pb-4 space-y-3">
            {/* Avatar + nome + nível */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-base font-bold select-none">
                {initials(seller.name)}
              </div>
              <div>
                <p className="text-base font-bold leading-tight">{seller.name}</p>
                <p className="text-[13px] text-white/70">{titulo} — Nível {nivel}</p>
              </div>
            </div>

            {/* XP bar */}
            <div>
              <div className="flex justify-between text-[11px] text-white/70 mb-1">
                <span>Nível {nivel}</span>
                <span>{xpNoNivel}/200 XP</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(xpProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* 4 KPI cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: <Zap className="h-3.5 w-3.5 text-amber-500" />, value: xpTotal,     label: 'XP Total' },
                { icon: <Zap className="h-3.5 w-3.5 text-[#3B5BDB]" />, value: xpMes,       label: 'XP Mês' },
                { icon: <span className="text-[12px] font-bold text-amber-500 leading-none">H</span>, value: 0, label: 'Hcoins' },
                { icon: <Truck className="h-3.5 w-3.5 text-[#3B5BDB]" />, value: entregasMes, label: 'Mês' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white rounded-xl p-2 text-center">
                  <div className="flex justify-center mb-1">{kpi.icon}</div>
                  <p className="text-sm font-bold text-gray-900">{kpi.value}</p>
                  <p className="text-[10px] text-gray-500">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'entregas' && (
          <EntregasTab
            entregas={allEntregas}
            loading={entregasLoading}
            nivel={nivel}
            xpTotal={xpTotal}
            xpNoNivel={xpNoNivel}
            currentYM={ym}
            onFuel={() => setFuelOpen(true)}
            onManual={() => setManualOpen(true)}
          />
        )}
        {tab === 'tarefas' && (
          <TarefasTab
            tasks={tasks ?? []}
            loading={tasksLoading}
            actionLoading={actionLoading}
            onConcluir={concluirTarefa}
          />
        )}
        {tab === 'perfil' && (
          <PerfilTab seller={seller} onLogout={logout} />
        )}
        {tab === 'abastecimentos' && (
          <AbastecimentosTab
            fuels={fuels ?? []}
            loading={fuelsLoading}
            onRegister={() => setFuelOpen(true)}
          />
        )}
        {tab === 'manutencao' && (
          <ManutencaoTab
            maintenances={maintenances ?? []}
            loading={maintenancesLoading}
          />
        )}
      </main>

      {/* ── Drawer de navegação ──────────────────────────────────────────── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-64 p-0">
          <SheetHeader className="p-4 border-b border-gray-100">
            <SheetTitle className="text-left">
              <p className="text-sm font-semibold text-gray-900">{seller.name}</p>
              <p className="text-xs text-gray-500 font-normal">Entregador</p>
            </SheetTitle>
          </SheetHeader>
          <nav className="py-2">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setTab(item.key); setMenuOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                  tab === item.key
                    ? 'bg-indigo-50 text-[#3B5BDB]'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                {item.icon}
                {TAB_LABELS[item.key]}
              </button>
            ))}
          </nav>
          <div className="absolute bottom-6 left-0 right-0 px-4">
            <button
              onClick={() => { void logout() }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
              Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Modais ──────────────────────────────────────────────────────── */}
      <FuelModal
        open={fuelOpen}
        onClose={() => setFuelOpen(false)}
        seller={seller}
        onSaved={refetchFuels}
      />
      <ManualDeliveryModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        seller={seller}
        onSaved={refetchEntregas}
      />
    </div>
  )
}

// ── Entregas Tab ─────────────────────────────────────────────────────────────

function EntregasTab({
  entregas, loading, nivel, xpTotal, xpNoNivel, currentYM, onFuel, onManual,
}: {
  entregas:   EntregaEO[]
  loading:    boolean
  nivel:      number
  xpTotal:    number
  xpNoNivel:  number
  currentYM:  string
  onFuel:     () => void
  onManual:   () => void
}) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(currentYM)
  const grouped = groupByMonth(entregas)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">

      {/* Como funciona seu nível */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900">Como funciona seu nível</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'NÍVEL',       value: nivel,              highlight: false },
            { label: 'XP TOTAL',    value: xpTotal,            highlight: false },
            { label: 'XP RESTANTE', value: 200 - xpNoNivel,   highlight: true  },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-2 text-center">
              <p className={cn('text-base font-bold', m.highlight ? 'text-[#3B5BDB]' : 'text-gray-900')}>
                {m.value}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Você sobe de nível a cada <strong>200 XP</strong> acumulados. Registre abastecimentos
          e entregas para ganhar XP.
        </p>
      </div>

      {/* Botões de ação */}
      <button
        onClick={onFuel}
        className="w-full bg-[#2F9E44] text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2B8A3E] active:bg-[#276037] transition-colors"
      >
        <Fuel className="h-4 w-4" />
        Registrar Abastecimento
      </button>
      <button
        onClick={onManual}
        className="w-full border border-[#3B5BDB] text-[#3B5BDB] rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Registrar Entrega Manual
      </button>

      {/* Relatório Mensal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-gray-900">Relatório Mensal</span>
        </div>
        <div className="space-y-2">
          {grouped.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" strokeWidth={1} />
              <p className="text-sm text-gray-400">Nenhuma entrega registrada</p>
            </div>
          ) : (
            grouped.map(([ym, list]) => {
              const entregues = list.filter(e => (e.status ?? '').toUpperCase() === 'ENTREGUE').length
              const xp = entregues * 5
              return (
                <div key={ym} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{monthLabel(ym)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{entregues} entregas</span>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      +{xp} XP
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Histórico de Entregas */}
      {grouped.map(([ym, list]) => {
        const entregues   = list.filter(e => (e.status ?? '').toUpperCase() === 'ENTREGUE').length
        const isExpanded  = expandedMonth === ym
        return (
          <div key={`hist-${ym}`}>
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : ym)}
              className="w-full flex items-center justify-between py-1 mb-2"
            >
              <span className="text-[11px] font-bold text-[#3B5BDB] uppercase tracking-wide">
                {monthLabel(ym)} — {list.length} REGISTROS ({entregues} ENTREGUES)
              </span>
              {isExpanded
                ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              }
            </button>
            {isExpanded && (
              <div className="space-y-2 mb-4">
                {list.slice(0, 50).map(e => (
                  <DeliveryCard key={e.id} entrega={e} />
                ))}
                {list.length > 50 && (
                  <p className="text-center text-xs text-gray-400 py-2">
                    Exibindo 50 de {list.length} registros
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DeliveryCard({ entrega }: { entrega: EntregaEO }) {
  const badge   = getStatusBadge(entrega.status)
  const dateStr = entrega.data_baixa
    ? format(parseISO(entrega.data_baixa), "d MMM yyyy", { locale: ptBR })
    : ''
  const timeStr = entrega.hora_baixa?.substring(0, 5) ?? ''

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {entrega.destinatario ?? '—'}
        </p>
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0', badge.cls)}>
          {badge.label}
        </span>
      </div>
      {entrega.endereco && (
        <p className="text-xs text-gray-500 line-clamp-2">{entrega.endereco}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 truncate">
          {[dateStr, timeStr, entrega.controle_pedido ? `#${entrega.controle_pedido}` : ''].filter(Boolean).join(' • ')}
        </span>
        {entrega.link && (
          <a
            href={entrega.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-[#3B5BDB] font-medium whitespace-nowrap shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Rastrear
          </a>
        )}
      </div>
    </div>
  )
}

// ── Tarefas Tab ───────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-yellow-100 text-yellow-700',
  baixa:   'bg-gray-100 text-gray-500',
}

function TarefasTab({
  tasks, loading, actionLoading, onConcluir,
}: {
  tasks:         DeliveryTask[]
  loading:       boolean
  actionLoading: string | null
  onConcluir:    (id: string) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const pending = tasks.filter(t => t.status_crm === 'pendente')
  const done    = tasks.filter(t => t.status_crm === 'concluida')

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  if (pending.length === 0 && done.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <CheckSquare className="h-10 w-10" strokeWidth={1} />
        <p className="text-sm font-medium">Nenhuma tarefa atribuída</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {pending.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pendentes ({pending.length})
          </p>
          <div className="space-y-3">
            {pending.map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    {task.task_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(task.task_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  {task.priority_crm && (
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', PRIORITY_COLOR[task.priority_crm] ?? 'bg-gray-100 text-gray-500')}>
                      {task.priority_crm}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-10 text-sm font-medium"
                  disabled={actionLoading === task.id}
                  onClick={() => onConcluir(task.id)}
                >
                  {actionLoading === task.id ? 'Concluindo...' : 'Marcar como concluída'}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-3"
          >
            Concluídas ({done.length}) {showDone ? '▲' : '▼'}
          </button>
          {showDone && (
            <div className="space-y-2">
              {done.map(task => (
                <div key={task.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
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

// ── Perfil Tab ────────────────────────────────────────────────────────────────

function PerfilTab({ seller, onLogout }: { seller: Seller; onLogout: () => Promise<void> }) {
  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="h-16 w-16 rounded-full bg-indigo-100 text-[#3B5BDB] flex items-center justify-center text-xl font-bold select-none">
          {initials(seller.name)}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900">{seller.name}</p>
          <p className="text-sm text-gray-400">Entregador</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">Email</span>
          <span className="text-sm text-gray-900 font-medium truncate max-w-[200px]">{seller.email}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">Departamento</span>
          <span className="text-sm text-gray-900 font-medium">Entregas</span>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        onClick={() => { void onLogout() }}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair da conta
      </Button>
    </div>
  )
}

// ── Abastecimentos Tab ────────────────────────────────────────────────────────

function AbastecimentosTab({
  fuels, loading, onRegister,
}: {
  fuels:      FuelLog[]
  loading:    boolean
  onRegister: () => void
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onRegister}
        className="w-full bg-[#2F9E44] text-white rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2B8A3E] transition-colors"
      >
        <Fuel className="h-4 w-4" />
        Registrar Abastecimento
      </button>

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">Histórico de Abastecimentos</p>
        {fuels.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Fuel className="h-8 w-8 text-gray-300 mx-auto mb-2" strokeWidth={1} />
            <p className="text-sm text-gray-400">Nenhum abastecimento registrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fuels.map(fuel => <FuelCard key={fuel.id} fuel={fuel} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function FuelCard({ fuel }: { fuel: FuelLog }) {
  const dateStr = fuel.fuel_date
    ? format(parseISO(fuel.fuel_date), "d MMM yyyy", { locale: ptBR })
    : '—'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
            <Fuel className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {fuel.amount != null
                ? fuel.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </p>
            <p className="text-xs text-gray-400">{dateStr}</p>
          </div>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
          {fuel.fuel_type ?? 'Gasolina'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'KM',     value: fuel.km     != null ? `${fuel.km.toLocaleString('pt-BR')} km` : '—' },
          { label: 'Litros', value: fuel.liters  != null ? `${fuel.liters}L`                       : '—' },
          { label: 'Posto',  value: fuel.station ?? '—' },
        ].map(m => (
          <div key={m.label}>
            <p className="text-xs text-gray-700 truncate">{m.value}</p>
            <p className="text-[10px] text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Manutenção Tab ────────────────────────────────────────────────────────────

function ManutencaoTab({
  maintenances, loading,
}: {
  maintenances: MaintenanceLog[]
  loading:      boolean
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    )
  }

  if (maintenances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Wrench className="h-10 w-10" strokeWidth={1} />
        <p className="text-sm font-medium">Nenhum registro de manutenção</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {maintenances.map(m => <MaintenanceCard key={m.id} maintenance={m} />)}
    </div>
  )
}

function MaintenanceCard({ maintenance }: { maintenance: MaintenanceLog }) {
  const dateStr = maintenance.maintenance_date
    ? format(parseISO(maintenance.maintenance_date), "d MMM yyyy", { locale: ptBR })
    : ''

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <Wrench className="h-5 w-5 text-orange-500" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{maintenance.title}</p>
            {maintenance.cost != null && (
              <p className="text-sm font-semibold text-gray-900 whitespace-nowrap shrink-0">
                {maintenance.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {[maintenance.maintenance_type ?? 'Manutenção', dateStr].filter(Boolean).join(' • ')}
          </p>
          {(maintenance.km != null || maintenance.supplier) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {[
                maintenance.km != null ? `KM: ${maintenance.km.toLocaleString('pt-BR')}` : '',
                maintenance.supplier ? `Fornecedor: ${maintenance.supplier}` : '',
              ].filter(Boolean).join('    ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal: Registrar Abastecimento ────────────────────────────────────────────

function FuelModal({
  open, onClose, seller, onSaved,
}: {
  open:    boolean
  onClose: () => void
  seller:  Seller
  onSaved: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    fuel_date: today, km: '', liters: '', amount: '', fuel_type: 'Gasolina', station: '',
  })
  const [saving, setSaving] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.amount) { toast.error('Informe o valor'); return }
    setSaving(true)
    const { error } = await supabase.from('vehicle_fuel_logs').insert({
      company_id: seller.company_id,
      seller_id:  seller.id,
      fuel_date:  form.fuel_date || today,
      km:         form.km     ? parseFloat(form.km)     : null,
      liters:     form.liters ? parseFloat(form.liters) : null,
      amount:     form.amount ? parseFloat(form.amount) : null,
      fuel_type:  form.fuel_type,
      station:    form.station || null,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao registrar abastecimento'); return }
    toast.success('Abastecimento registrado! +20 XP')
    onSaved()
    onClose()
    setForm({ fuel_date: today, km: '', liters: '', amount: '', fuel_type: 'Gasolina', station: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Abastecimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Data</label>
              <input type="date" value={form.fuel_date} onChange={e => set('fuel_date', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Tipo</label>
              <select value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} className="hh-select mt-1 w-full">
                <option>Gasolina</option>
                <option>Gasolina Aditivada</option>
                <option>Etanol</option>
                <option>Diesel</option>
                <option>GNV</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Valor (R$) *</label>
              <input type="number" step="0.01" placeholder="0,00" value={form.amount} onChange={e => set('amount', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Litros</label>
              <input type="number" step="0.1" placeholder="0,0" value={form.liters} onChange={e => set('liters', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">KM atual</label>
              <input type="number" placeholder="0" value={form.km} onChange={e => set('km', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Posto</label>
            <input type="text" placeholder="Nome do posto" value={form.station} onChange={e => set('station', e.target.value)} className="hh-input mt-1 w-full" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-[#2F9E44] hover:bg-[#2B8A3E] text-white">
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal: Registrar Entrega Manual ───────────────────────────────────────────

function ManualDeliveryModal({
  open, onClose, seller, onSaved,
}: {
  open:    boolean
  onClose: () => void
  seller:  Seller
  onSaved: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    destinatario: '', endereco: '', data_baixa: today, hora_baixa: '',
    status: 'ENTREGUE', controle_pedido: '', observa_de_baixa: '',
  })
  const [saving, setSaving] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.destinatario.trim()) { toast.error('Destinatário é obrigatório'); return }
    setSaving(true)
    const { error } = await supabase.from('entregas_eo').insert({
      company_id:       seller.company_id,
      destinatario:     form.destinatario.trim(),
      endereco:         form.endereco || null,
      data_baixa:       form.data_baixa || today,
      hora_baixa:       form.hora_baixa || null,
      status:           form.status,
      controle_pedido:  form.controle_pedido || null,
      entregador:       seller.name,
      observa_de_baixa: `[REGISTRO MANUAL]${form.observa_de_baixa ? ' ' + form.observa_de_baixa : ''}`,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao registrar entrega'); return }
    toast.success('Entrega registrada! +5 XP')
    onSaved()
    onClose()
    setForm({ destinatario: '', endereco: '', data_baixa: today, hora_baixa: '', status: 'ENTREGUE', controle_pedido: '', observa_de_baixa: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Entrega Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Use apenas para entregas não capturadas automaticamente pelo Entregador Online.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Destinatário *</label>
            <input type="text" placeholder="Nome do cliente/empresa" value={form.destinatario} onChange={e => set('destinatario', e.target.value)} className="hh-input mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Endereço</label>
            <input type="text" placeholder="Rua, número, bairro, cidade" value={form.endereco} onChange={e => set('endereco', e.target.value)} className="hh-input mt-1 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Data</label>
              <input type="date" value={form.data_baixa} onChange={e => set('data_baixa', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Hora</label>
              <input type="time" value={form.hora_baixa} onChange={e => set('hora_baixa', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="hh-select mt-1 w-full">
                <option value="ENTREGUE">Entregue</option>
                <option value="EM ROTA">Em rota</option>
                <option value="PENDENTE">Pendente</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Nº Pedido</label>
              <input type="text" placeholder="Opcional" value={form.controle_pedido} onChange={e => set('controle_pedido', e.target.value)} className="hh-input mt-1 w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Observação</label>
            <input type="text" placeholder="Opcional" value={form.observa_de_baixa} onChange={e => set('observa_de_baixa', e.target.value)} className="hh-input mt-1 w-full" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
