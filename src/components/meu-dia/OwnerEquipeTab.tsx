import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  format, isBefore, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  differenceInCalendarDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NovaOwnerTaskDrawer } from '@/components/meu-dia/NovaOwnerTaskDrawer';
import type { SellerRow } from '@/hooks/useSellersData';

type PeriodFilter = 'hoje' | 'semana' | 'mes';

interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  clientName: string;
  clientSellerId: string | null;
  assignedTo: string | null;
  priority: string;
  dueDate: string | null;
  doneAt: string | null;
  status: string;
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

export function OwnerEquipeTab({ sellers }: { sellers: SellerRow[] }) {
  const { seller: currentSeller } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('semana');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [delegatePrefill, setDelegatePrefill] = useState('');

  const { start, end } = getPeriodRange(period);
  const today = startOfDay(new Date());

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: allTasks = [], isLoading } = useQuery<TeamTask[]>({
    queryKey: ['owner-team-tasks', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, client_id, assigned_to, priority, due_date, done_at, status, clients(id, name, seller_id)')
        .neq('status', 'cancelled')
        .gte('due_date', monthStart)
        .order('due_date', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        title: t.title || '',
        description: t.description || null,
        clientName: t.clients?.name || '',
        clientSellerId: t.clients?.seller_id || null,
        assignedTo: t.assigned_to || null,
        priority: t.priority || 'normal',
        dueDate: t.due_date || null,
        doneAt: t.done_at || null,
        status: t.status || 'open',
      }));
    },
    staleTime: 1000 * 60 * 2,
  });

  const activeSellers = sellers.filter(s => s.id !== currentSeller?.id);
  const sellerMap = useMemo(() => {
    const m: Record<string, SellerRow> = {};
    sellers.forEach(s => { m[s.id] = s; });
    return m;
  }, [sellers]);

  const getSellerTasks = (sellerId: string) =>
    allTasks.filter(t => t.assignedTo === sellerId);
  const getOpenTasks = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status === 'open');
  const getOverdueTasks = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status === 'open' && t.dueDate && isBefore(new Date(t.dueDate), today));
  const getCompletedInPeriod = (sellerId: string) =>
    getSellerTasks(sellerId).filter(t => t.status === 'done' && t.doneAt &&
      new Date(t.doneAt) >= start && new Date(t.doneAt) <= end);

  const teamOpen = allTasks.filter(t => t.status === 'open').length;
  const teamOverdue = allTasks.filter(t => t.status === 'open' && t.dueDate && isBefore(new Date(t.dueDate), today)).length;
  const teamCompleted = allTasks.filter(t => t.status === 'done' && t.doneAt &&
    new Date(t.doneAt) >= start && new Date(t.doneAt) <= end).length;
  const collaboratorsWithOverdue = activeSellers.filter(s => getOverdueTasks(s.id).length > 0).length;

  const allOverdue = useMemo(() =>
    allTasks
      .filter(t => t.status === 'open' && t.dueDate && isBefore(new Date(t.dueDate), today))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
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
                        <p className="text-[11px] truncate flex-1 text-foreground">{t.title || t.clientName || t.description || 'Tarefa Geral'}</p>
                        <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded text-[10px] font-semibold ml-2">
                          {t.dueDate ? Math.abs(differenceInCalendarDays(new Date(t.dueDate), today)) : 0}d
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
              const owner = sellerMap[t.assignedTo || ''];
              const daysOverdue = t.dueDate ? Math.abs(differenceInCalendarDays(new Date(t.dueDate), today)) : 0;
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border-destructive/20 bg-destructive/5 border">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">
                    {(owner?.name || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate text-foreground">{t.title || t.clientName || t.description || 'Tarefa Geral'}</p>
                    <p className="text-[11px] text-muted-foreground">{owner?.name || 'Desconhecido'}</p>
                  </div>
                  <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">{daysOverdue}d atraso</span>
                  <Button size="sm" variant="ghost" className="text-[11px] shrink-0 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDelegatePrefill(t.assignedTo || '');
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
    </div>
  );
}
