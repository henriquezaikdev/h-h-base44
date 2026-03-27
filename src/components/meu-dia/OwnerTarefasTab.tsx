import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasksData } from '@/hooks/useTasksData';
import type { TaskData } from '@/hooks/useTasksData';
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
    <div className="h-[72px] flex flex-col justify-between p-4 rounded-xl bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md">
      <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-500">{label}</span>
      <span className={cn(
        "text-[22px] font-semibold leading-none",
        value > 0 && color === 'danger' && "text-red-600",
        value > 0 && color === 'warning' && "text-amber-500",
        value > 0 && color === 'success' && "text-[#3B5BDB]",
        (color === 'neutral' || value === 0) && "text-gray-900",
      )}>{value}</span>
    </div>
  );
}

export function OwnerTarefasTab({ sellers }: { sellers: SellerRow[] }) {
  const { seller, role } = useAuth();
  const { tasks, loading } = useTasksData(undefined, seller?.id, role);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ alta: true, media: true, baixa: false });
  const [delegatePrefill] = useState('');
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const today = startOfDay(new Date());

  // Owner vê TODAS as tarefas pendentes da empresa
  const myTasks = useMemo(() =>
    (tasks || []).filter(t => t.status === 'pendente'),
    [tasks]
  );

  // Delegadas: pendentes atribuídas a outros sellers
  const delegatedByMe = useMemo(() =>
    (tasks || []).filter(t =>
      t.assignedToSellerId &&
      t.assignedToSellerId !== seller?.id &&
      t.status === 'pendente'
    ),
    [tasks, seller?.id]
  );

  const dueToday = useMemo(() =>
    myTasks.filter(t => t.taskDate && isToday(new Date(t.taskDate))).length,
    [myTasks]
  );

  const overdue = useMemo(() =>
    myTasks.filter(t => t.taskDate && isBefore(new Date(t.taskDate), today)).length,
    [myTasks, today]
  );

  const groupByPriority = (list: TaskData[]) => {
    const grouped: Record<string, TaskData[]> = { urgente: [], alta: [], media: [], baixa: [] };
    list.forEach(t => {
      if (grouped[t.priority]) grouped[t.priority].push(t);
      else grouped['media'].push(t);
    });
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
    await supabase.from('tasks').update({
      status_crm: 'concluida',
      completed_at: new Date().toISOString(),
    } as any).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    toast.success('Tarefa concluida!');
  };

  const priorityLabel: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baixa: 'Baixa' };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#3B5BDB]" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{getGreeting(seller?.name || 'Gestor')}</h2>
          <p className="text-[13px] capitalize text-gray-500">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Minhas Tarefas Abertas" value={myTasks.length} />
        <MetricCard label="Vencendo Hoje" value={dueToday} color="warning" />
        <MetricCard label="Atrasadas" value={overdue} color="danger" />
        <MetricCard label="Delegadas Pendentes" value={delegatedByMe.length} />
      </div>

      <div className="rounded-xl p-5 bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-500">Minhas Tarefas</span>
          <Button size="sm" onClick={() => setDrawerOpen(true)} className="gap-1.5 text-[11px]">
            <Plus className="h-3 w-3" /> Nova Tarefa
          </Button>
        </div>
        {myTasks.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-gray-300" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-500">Nenhuma tarefa pendente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(['urgente', 'alta', 'media', 'baixa'] as const).map(p => {
              const items = grouped[p];
              if (!items?.length) return null;
              return (
                <div key={p}>
                  <button onClick={() => setExpandedGroups(g => ({ ...g, [p]: !g[p] }))}
                    className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-500 mb-2">
                    {expandedGroups[p] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {priorityLabel[p]} ({items.length})
                  </button>
                  {expandedGroups[p] && (
                    <div className="space-y-1 ml-5">
                      {items.map(t => (
                        <div key={t.id} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
                          t.taskDate && isBefore(new Date(t.taskDate), today) ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
                        )} onClick={() => setEditingTask(t)}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate text-gray-900">{t.title || t.clientName || 'Tarefa Geral'}</p>
                            {(t.planningNotes || t.notes) && (
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">{t.planningNotes || t.notes}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {t.taskDate && <span className="text-[11px] text-gray-500">{format(new Date(t.taskDate), 'dd/MM')}</span>}
                              {t.assignedToSellerId && sellerMap[t.assignedToSellerId] && (
                                <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{sellerMap[t.assignedToSellerId]}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-[#3B5BDB]" onClick={(e) => { e.stopPropagation(); setEditingTask(t); }}>
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); completeTask(t.id); }} className="h-7 w-7 p-0">
                              <CheckSquare className="h-4 w-4 text-[#3B5BDB]" strokeWidth={1.5} />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeletingTaskId(t.id); }}>
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
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

      {/* Delegated tasks */}
      <div className="rounded-xl p-5 bg-white border border-gray-100 shadow-sm">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-500">Delegadas / Equipe</span>
        {delegatedByMe.length === 0 ? (
          <p className="text-[13px] mt-4 text-center py-4 text-gray-500">Nenhuma tarefa delegada</p>
        ) : (
          <div className="space-y-4 mt-4">
            {Object.entries(delegatedGrouped).map(([sellerId, items]) => {
              const hasOverdue = items.some(t => t.taskDate && isBefore(new Date(t.taskDate), today));
              return (
                <div key={sellerId}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-100 text-gray-500">
                      {(sellerMap[sellerId] || '?')[0]}
                    </div>
                    <span className="text-[13px] font-medium text-gray-900">{sellerMap[sellerId] || 'Desconhecido'}</span>
                    {hasOverdue && <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">Atraso</span>}
                  </div>
                  <div className="space-y-1 ml-8">
                    {items.map(t => (
                      <div key={t.id} className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:ring-1 hover:ring-indigo-200 transition-all",
                        t.taskDate && isBefore(new Date(t.taskDate), today) ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
                      )} onClick={() => setEditingTask(t)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] truncate text-gray-900">{t.title || t.clientName || 'Tarefa Geral'}</p>
                          {t.taskDate && <span className="text-[11px] text-gray-500">{format(new Date(t.taskDate), 'dd/MM')}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                            t.taskDate && isBefore(new Date(t.taskDate), today)
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          )}>
                            {t.taskDate && isBefore(new Date(t.taskDate), today) ? 'Atrasada' : 'Pendente'}
                          </span>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); completeTask(t.id); }} className="h-7 px-2 text-xs bg-[#3B5BDB] hover:bg-[#3B5BDB]/90 text-white">
                            Concluir
                          </Button>
                        </div>
                      </div>
                    ))}
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
          }}
        />
      )}
    </div>
  );
}
