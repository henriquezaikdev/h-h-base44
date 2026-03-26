import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasksData, TaskData } from '@/hooks/useTasksData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckSquare, Plus, ChevronDown, ChevronRight,
  Loader2, CheckCircle2, Eye, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NovaOwnerTaskDrawer } from '@/components/meu-dia/NovaOwnerTaskDrawer';
import { TaskUnifiedModal } from '@/components/tasks/TaskUnifiedModal';
import { DeleteTaskModal } from '@/components/tasks/DeleteTaskModal';
import type { SellerRow } from '@/hooks/useSellersData';

function getGreeting(name: string) {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${prefix}, ${name.split(' ')[0]}`;
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

export function OwnerTarefasTab({ sellers }: { sellers: SellerRow[] }) {
  const { seller } = useAuth();
  const { tasks, loading } = useTasksData(undefined, seller?.id);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ alta: true, media: true, baixa: false });
  const [delegatePrefill, setDelegatePrefill] = useState('');
  const [queryError, setQueryError] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const today = startOfDay(new Date());

  const myTasks = useMemo(() =>
    (tasks || []).filter(t => t.status !== 'concluida' && t.createdBySellerId === seller?.id &&
      (!t.assignedToSellerId || t.assignedToSellerId === seller?.id)),
    [tasks, seller?.id]
  );

  const delegatedByMe = useMemo(() =>
    (tasks || []).filter(t => t.createdBySellerId === seller?.id &&
      t.assignedToSellerId && t.assignedToSellerId !== seller?.id &&
      (t.status === 'pendente' || (t.status === 'concluida' && !t.managerConfirmedAt))),
    [tasks, seller?.id]
  );

  const dueToday = useMemo(() => (tasks || []).filter(t => t.status !== 'concluida' && isToday(new Date(t.taskDate))).length, [tasks]);
  const overdue = useMemo(() => (tasks || []).filter(t => t.status !== 'concluida' &&
    isBefore(new Date(t.taskDate), today)).length, [tasks, today]);

  const groupByPriority = (list: TaskData[]) => {
    const grouped: Record<string, TaskData[]> = { alta: [], media: [], baixa: [] };
    list.forEach(t => grouped[t.priority]?.push(t));
    return grouped;
  };

  const grouped = groupByPriority(myTasks);
  const sellerMap = useMemo(() => {
    const m: Record<string, string> = {};
    sellers.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [sellers]);

  const delegatedGrouped = useMemo(() => {
    const g: Record<string, TaskData[]> = {};
    delegatedByMe.forEach(t => {
      const key = t.assignedToSellerId || 'unknown';
      if (!g[key]) g[key] = [];
      g[key].push(t);
    });
    return g;
  }, [delegatedByMe]);

  const completeTask = async (taskId: string) => {
    await supabase.from('tasks').update({ status: 'concluida', completed_at: new Date().toISOString() }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['actionCenter'] });
    toast.success('Tarefa concluida!');
  };

  const confirmDelegatedTask = async (taskId: string) => {
    await supabase.from('tasks').update({ manager_confirmed_at: new Date().toISOString() } as Record<string, unknown>).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const completeAndConfirmTask = async (taskId: string) => {
    const now = new Date().toISOString();
    await supabase.from('tasks').update({
      status: 'concluida',
      completed_at: now,
      manager_confirmed_at: now,
    } as Record<string, unknown>).eq('id', taskId);
    toast.success('Tarefa concluida e confirmada!');
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['actionCenter'] });
  };

  const priorityLabel: Record<string, string> = { alta: 'Alta', media: 'Media', baixa: 'Baixa' };

  if (!tasks || (tasks.length === 0 && !loading && queryError)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-muted-foreground">Erro ao carregar tarefas. Tente novamente.</p>
        <Button size="sm" variant="outline" onClick={() => { setQueryError(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{getGreeting(seller?.name || 'Gestor')}</h2>
          <p className="text-[13px] capitalize text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Minhas Tarefas Abertas" value={myTasks.length} />
        <MetricCard label="Vencendo Hoje" value={dueToday} color="warning" />
        <MetricCard label="Atrasadas" value={overdue} color="danger" />
        <MetricCard label="Delegadas Pendentes" value={delegatedByMe.length} />
      </div>

      <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Minhas Tarefas</span>
          <Button size="sm" onClick={() => { setDelegatePrefill(''); setDrawerOpen(true); }} className="gap-1.5 text-[11px]">
            <Plus className="h-3 w-3" /> Nova Tarefa
          </Button>
        </div>
        {myTasks.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-[13px] text-muted-foreground">Nenhuma tarefa pendente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(['alta', 'media', 'baixa'] as const).map(p => {
              const items = grouped[p];
              if (!items?.length) return null;
              return (
                <div key={p}>
                  <button onClick={() => setExpandedGroups(g => ({ ...g, [p]: !g[p] }))}
                    className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-2">
                    {expandedGroups[p] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {priorityLabel[p]} ({items.length})
                  </button>
                  {expandedGroups[p] && (
                    <div className="space-y-1 ml-5">
                      {items.map(t => (
                        <div key={t.id} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
                          isBefore(new Date(t.taskDate), today) ? "border-destructive/20 bg-destructive/5" : "border-border bg-card"
                        )} onClick={() => setEditingTask(t)}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate text-foreground">{t.clientName || t.planningNotes || t.notes || 'Tarefa Geral'}</p>
                            {(t.clientName && (t.planningNotes || t.notes)) && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.planningNotes || t.notes}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {t.taskCategory && <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px]">{t.taskCategory}</span>}
                              <span className="text-[11px] text-muted-foreground">{format(new Date(t.taskDate), 'dd/MM')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); completeTask(t.id); }} className="h-7 w-7 p-0">
                              <CheckSquare className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeletingTaskId(t.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl p-5 bg-card border border-border shadow-sm">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Delegadas por mim</span>
        {delegatedByMe.length === 0 ? (
          <p className="text-[13px] mt-4 text-center py-4 text-muted-foreground">Nenhuma tarefa delegada</p>
        ) : (
          <div className="space-y-4 mt-4">
            {Object.entries(delegatedGrouped).map(([sellerId, items]) => {
              const hasOverdue = items.some(t => isBefore(new Date(t.taskDate), today));
              return (
                <div key={sellerId}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground">
                      {(sellerMap[sellerId] || '?')[0]}
                    </div>
                    <span className="text-[13px] font-medium text-foreground">{sellerMap[sellerId] || 'Desconhecido'}</span>
                    {hasOverdue && <span className="bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">Atraso</span>}
                  </div>
                  <div className="space-y-1 ml-8">
                    {items.map(t => {
                      const isCompleted = t.status === 'concluida' && !t.managerConfirmedAt;
                      return (
                        <div key={t.id} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all",
                          isCompleted
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : isBefore(new Date(t.taskDate), today) ? "border-destructive/20 bg-destructive/5" : "border-border bg-card"
                        )} onClick={() => setEditingTask(t)}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] truncate text-foreground">{t.clientName || t.planningNotes || t.notes || 'Tarefa Geral'}</p>
                            <span className="text-[11px] text-muted-foreground">{format(new Date(t.taskDate), 'dd/MM')}</span>
                          </div>
                          {isCompleted ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full">Concluida</span>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); confirmDelegatedTask(t.id); }} className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                                OK
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                                isBefore(new Date(t.taskDate), today)
                                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                                  : 'bg-muted text-muted-foreground border-border'
                              )}>
                                {isBefore(new Date(t.taskDate), today) ? 'Atrasada' : 'Pendente'}
                              </span>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); completeAndConfirmTask(t.id); }} className="h-7 px-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                                Concluir
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NovaOwnerTaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} sellers={sellers} prefillDelegateTo={delegatePrefill} />

      {editingTask && (
        <TaskUnifiedModal
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          mode="edit"
          task={editingTask}
          sellers={sellers}
          onCompleted={() => {
            setEditingTask(null);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }}
        />
      )}

      {deletingTaskId && (
        <DeleteTaskModal
          open={!!deletingTaskId}
          onOpenChange={(open) => !open && setDeletingTaskId(null)}
          taskId={deletingTaskId}
          isCompleted={false}
          onDeleted={() => {
            setDeletingTaskId(null);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['actionCenter'] });
          }}
        />
      )}
    </div>
  );
}
