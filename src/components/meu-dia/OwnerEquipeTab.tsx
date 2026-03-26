import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  format, isBefore, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Star, Medal, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NovaOwnerTaskDrawer } from '@/components/meu-dia/NovaOwnerTaskDrawer';
import type { SellerRow } from '@/hooks/useSellersData';

type PeriodFilter = 'hoje' | 'semana' | 'mes';

interface TeamTask {
  id: string;
  clientName: string;
  taskDate: string;
  status: string;
  priority: string;
  notes: string | null;
  planningNotes: string | null;
  taskCategory: string | null;
  createdBySellerId: string | null;
  assignedToSellerId: string | null;
  completedAt: string | null;
}

function getPeriodRange(period: PeriodFilter) {
  const now = new Date();
  if (period === 'hoje') return { start: startOfDay(now), end: now };
  if (period === 'semana') return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

function MetricCard({ label, value, color = 'neutral' }: { label: string; value: number; color?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  return (
    <div className="h-[72px] flex flex-col justify-between p-4 rounded-xl bg-card border border-border shadow-sm transition-all hover:shadow-md">
      <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">{label}</span>
      <span className={cn(
        "text-[22px] font-semibold leading-none",
        value > 0 && color === 'danger' && "text-destructive",
        value > 0 && color === 'warning' && "text-amber-500",
        value > 0 && color === 'success' && "text-emerald-500",
        (color === 'neutral' || value === 0) && "text-foreground",
      )}>{value}</span>
    </div>
  );
}

function OwnerMedalHistory({ sellers, sellerMap }: { sellers: SellerRow[]; sellerMap: Record<string, SellerRow> }) {
  const [medals, setMedals] = useState<Array<{
    id: string;
    user_id: string;
    earned_at: string;
    context_json: unknown;
    period_key: string;
    medals: { id: string; code: string; name: string; tier: string; description: string } | null;
  }>>([]);
  const [loadingMedals, setLoadingMedals] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>('todos');

  useEffect(() => {
    async function fetchMedals() {
      setLoadingMedals(true);
      try {
        const { data, error } = await supabase
          .from('user_medals')
          .select('id, user_id, earned_at, context_json, period_key, medals(id, code, name, tier, description)')
          .gte('earned_at', '2026-01-01T00:00:00')
          .order('earned_at', { ascending: false });
        if (error) throw error;
        setMedals((data as typeof medals) || []);
      } catch (err) {
        console.error('Error fetching medal history:', err);
      } finally {
        setLoadingMedals(false);
      }
    }
    fetchMedals();
  }, []);

  const months = useMemo(() => {
    const set = new Set<string>();
    medals.forEach(m => {
      const d = new Date(m.earned_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort().reverse();
  }, [medals]);

  const filteredMedals = useMemo(() => {
    if (monthFilter === 'todos') return medals;
    return medals.filter(m => {
      const d = new Date(m.earned_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthFilter;
    });
  }, [medals, monthFilter]);

  const groupedBySeller = useMemo(() => {
    const map: Record<string, typeof medals> = {};
    filteredMedals.forEach(m => {
      if (!map[m.user_id]) map[m.user_id] = [];
      map[m.user_id].push(m);
    });
    return Object.entries(map)
      .map(([uid, ms]) => ({ sellerId: uid, name: sellerMap[uid]?.name || 'Desconhecido', medals: ms }))
      .sort((a, b) => b.medals.length - a.medals.length);
  }, [filteredMedals, sellerMap]);

  const tierColor = (tier: string) => {
    if (tier === 'OURO') return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    if (tier === 'PRATA') return 'bg-slate-400/10 text-slate-500 border-slate-400/30';
    return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return format(d, "MMMM 'de' yyyy", { locale: ptBR });
  };

  if (loadingMedals) {
    return (
      <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Historico de Medalhas</span>
        </div>
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
            Historico de Medalhas - Jan/2026 ate agora
          </span>
          <Badge variant="outline" className="text-[10px] ml-1">{filteredMedals.length} medalhas</Badge>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-muted border border-border flex-wrap">
          <button onClick={() => setMonthFilter('todos')}
            className={cn("px-3 py-1.5 text-[11px] font-medium rounded transition-colors",
              monthFilter === 'todos' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            Todos
          </button>
          {months.map(m => (
            <button key={m} onClick={() => setMonthFilter(m)}
              className={cn("px-3 py-1.5 text-[11px] font-medium rounded transition-colors capitalize",
                monthFilter === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {groupedBySeller.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma medalha encontrada no periodo.</p>
      ) : (
        <div className="space-y-4">
          {groupedBySeller.map(({ sellerId, name, medals: sellerMedals }) => (
            <div key={sellerId} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-muted text-muted-foreground">
                  {name[0]}
                </div>
                <span className="text-[13px] font-medium text-foreground">{name}</span>
                <Badge variant="outline" className="text-[10px]">{sellerMedals.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {sellerMedals.map((um) => (
                  <div key={um.id} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium", tierColor(um.medals?.tier || 'BRONZE'))}>
                    <Medal className="h-3.5 w-3.5" />
                    <span>{um.medals?.name || 'Medalha'}</span>
                    <span className="text-[9px] opacity-70">
                      {format(new Date(um.earned_at), 'dd/MM', { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OwnerEquipeTab({ sellers }: { sellers: SellerRow[] }) {
  const { seller: currentSeller } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('semana');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [delegatePrefill, setDelegatePrefill] = useState('');
  const [praiseTarget, setPraiseTarget] = useState<string | null>(null);
  const [praiseNote, setPraiseNote] = useState('');
  const [praiseLoading, setPraiseLoading] = useState(false);

  const { start, end } = getPeriodRange(period);
  const today = startOfDay(new Date());

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: allTasks = [], isLoading } = useQuery<TeamTask[]>({
    queryKey: ['owner-team-tasks', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, clients!tasks_client_id_fkey(company_name)')
        .eq('is_deleted', false)
        .gte('task_date', monthStart)
        .order('task_date', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        clientName: ((t.clients as Record<string, string> | null)?.company_name) || '',
        taskDate: t.task_date as string,
        status: t.status as string,
        priority: (t.priority as string) || 'media',
        notes: t.notes as string | null,
        planningNotes: t.planning_notes as string | null,
        taskCategory: t.task_category as string | null,
        createdBySellerId: t.created_by_seller_id as string | null,
        assignedToSellerId: t.assigned_to_seller_id as string | null,
        completedAt: t.completed_at as string | null,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });

  const activeSellers = sellers.filter(s => (!s.status || s.status === 'ATIVO') && s.id !== currentSeller?.id);
  const sellerMap = useMemo(() => {
    const m: Record<string, SellerRow> = {};
    sellers.forEach(s => { m[s.id] = s; });
    return m;
  }, [sellers]);

  const getSellerTasks = (sellerId: string) =>
    allTasks.filter(t => t.createdBySellerId === sellerId || t.assignedToSellerId === sellerId);
  const getOpenTasks = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status !== 'concluida');
  const getOverdueTasks = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status !== 'concluida' && isBefore(new Date(t.taskDate), today));
  const getCompletedInPeriod = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status === 'concluida' && t.completedAt &&
      new Date(t.completedAt) >= start && new Date(t.completedAt) <= end);

  const teamOpen = allTasks.filter(t => t.status !== 'concluida').length;
  const teamOverdue = allTasks.filter(t => t.status !== 'concluida' && isBefore(new Date(t.taskDate), today)).length;
  const teamCompleted = allTasks.filter(t => t.status === 'concluida' && t.completedAt &&
    new Date(t.completedAt) >= start && new Date(t.completedAt) <= end).length;
  const collaboratorsWithOverdue = activeSellers.filter(s => getOverdueTasks(s.id).length > 0).length;

  const allOverdue = useMemo(() =>
    allTasks
      .filter(t => t.status !== 'concluida' && isBefore(new Date(t.taskDate), today))
      .sort((a, b) => new Date(a.taskDate).getTime() - new Date(b.taskDate).getTime()),
    [allTasks, today]
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Equipe - Visao do Gestor</span>
          <p className="text-[13px] capitalize mt-1 text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-muted border border-border">
          {([['hoje', 'Hoje'], ['semana', 'Esta Semana'], ['mes', 'Este Mes']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium rounded transition-colors",
                period === val ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Tarefas Abertas" value={teamOpen} />
        <MetricCard label="Atrasadas" value={teamOverdue} color="danger" />
        <MetricCard label="Concluidas no Periodo" value={teamCompleted} color="success" />
        <MetricCard label="Colaboradores com Atraso" value={collaboratorsWithOverdue} color={collaboratorsWithOverdue > 0 ? 'danger' : 'neutral'} />
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Colaboradores</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          {activeSellers.map(s => {
            const open = getOpenTasks(s.id).length;
            const overdueList = getOverdueTasks(s.id);
            const completed = getCompletedInPeriod(s.id).length;
            const hasOverdue = overdueList.length > 0;
            const isExpanded = expandedCard === s.id;

            return (
              <div key={s.id}
                className={cn(
                  "rounded-xl p-4 cursor-pointer transition-all bg-card border shadow-sm hover:shadow-md",
                  hasOverdue ? "border-l-4 border-l-destructive border-t-border border-r-border border-b-border" : "border-l-4 border-l-emerald-500 border-t-border border-r-border border-b-border"
                )}
                onClick={() => setExpandedCard(isExpanded ? null : s.id)}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold bg-muted text-muted-foreground">
                    {s.name[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{s.name}</p>
                    <span className="text-[10px] text-muted-foreground">{s.role}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[18px] font-semibold text-foreground">{open}</p>
                    <p className="text-[10px] text-muted-foreground">Abertas</p>
                  </div>
                  <div>
                    <p className={cn("text-[18px] font-semibold", hasOverdue ? "text-destructive" : "text-foreground")}>{overdueList.length}</p>
                    <p className="text-[10px] text-muted-foreground">Atrasadas</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-semibold text-emerald-500">{completed}</p>
                    <p className="text-[10px] text-muted-foreground">Concluidas</p>
                  </div>
                </div>
                {isExpanded && overdueList.length > 0 && (
                  <div className="mt-3 pt-3 space-y-1 border-t border-border">
                    <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-destructive">Tarefas atrasadas</span>
                    {overdueList.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border-destructive/20 bg-destructive/5 border">
                        <p className="text-[11px] truncate flex-1 text-foreground">{t.clientName || t.planningNotes || t.notes || 'Tarefa Geral'}</p>
                        <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded text-[10px] font-semibold ml-2">
                          {Math.abs(differenceInCalendarDays(new Date(t.taskDate), today))}d
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {allOverdue.length > 0 && (
        <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Tarefas Atrasadas da Equipe</span>
          <div className="space-y-1 mt-3">
            {allOverdue.slice(0, 20).map(t => {
              const owner = sellerMap[t.assignedToSellerId || t.createdBySellerId || ''];
              const daysOverdue = Math.abs(differenceInCalendarDays(new Date(t.taskDate), today));
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border-destructive/20 bg-destructive/5 border">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">
                    {(owner?.name || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate text-foreground">{t.clientName || t.planningNotes || t.notes || 'Tarefa Geral'}</p>
                    <p className="text-[11px] text-muted-foreground">{owner?.name || 'Desconhecido'}</p>
                  </div>
                  <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">{daysOverdue}d atraso</span>
                  <Button size="sm" variant="ghost" className="text-[11px] shrink-0 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDelegatePrefill(t.assignedToSellerId || t.createdBySellerId || '');
                      setDrawerOpen(true);
                    }}>
                    Delegar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NovaOwnerTaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} sellers={sellers} prefillDelegateTo={delegatePrefill} />

      {/* Praise XP section */}
      <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Creditar Elogio de Cliente</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Quando um vendedor comunicar um elogio de cliente, credite +150 XP ao colaborador.</p>
        <div className="flex flex-wrap gap-2">
          {activeSellers
            .sort((a, b) => (a.role === 'logistica' ? -1 : b.role === 'logistica' ? 1 : 0))
            .map(s => (
              <Button
                key={s.id}
                variant={praiseTarget === s.id ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setPraiseTarget(praiseTarget === s.id ? null : s.id);
                  setPraiseNote('');
                }}
              >
                <Star className="h-3.5 w-3.5" />
                {s.name.split(' ')[0]}
              </Button>
            ))}
        </div>
        {praiseTarget && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              placeholder="Motivo do elogio (opcional)"
              value={praiseNote}
              onChange={e => setPraiseNote(e.target.value)}
              className="flex-1 h-9 text-sm"
            />
            <Button
              size="sm"
              disabled={praiseLoading}
              onClick={async () => {
                setPraiseLoading(true);
                try {
                  const { error } = await supabase.rpc('grant_praise_xp', {
                    p_seller_id: praiseTarget,
                    p_note: praiseNote || 'Elogio de cliente',
                  });
                  if (error) throw error;
                  const name = sellers.find(s => s.id === praiseTarget)?.name || '';
                  toast.success(`+150 XP creditados para ${name.split(' ')[0]}!`);
                  setPraiseTarget(null);
                  setPraiseNote('');
                } catch (err) {
                  console.error(err);
                  toast.error('Erro ao creditar XP');
                } finally {
                  setPraiseLoading(false);
                }
              }}
            >
              {praiseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Creditar +150 XP'}
            </Button>
          </div>
        )}
      </div>

      {/* Medal History Section */}
      <OwnerMedalHistory sellers={activeSellers} sellerMap={sellerMap} />
    </div>
  );
}
