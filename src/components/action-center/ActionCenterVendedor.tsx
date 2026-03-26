import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActionCenterData } from '@/hooks/useActionCenterData';
import type { CriticalAlert } from '@/hooks/useActionCenterData';
import { useTasksData } from '@/hooks/useTasksData';
import type { TaskData } from '@/hooks/useTasksData';
import { useWorkingDaysTargets } from '@/hooks/useWorkingDaysTargets';
import { useDailyFocus } from '@/hooks/useDailyFocus';
import { useCriticalBlocker } from '@/hooks/useCriticalBlocker';
import { useTaskLimits } from '@/hooks/useTaskLimits';
import { TaskPrioritySection } from '@/components/meu-dia/TaskPrioritySection';
import { BulkActionsBar } from '@/components/meu-dia/BulkActionsBar';
import { ClickableScoreboard } from '@/components/meu-dia/ClickableScoreboard';
import { EmptyStateCard } from '@/components/meu-dia/EmptyStateCard';
import { QuickShortcutsCard } from '@/components/meu-dia/QuickShortcutsCard';
import { OpenQuotesCard } from '@/components/meu-dia/OpenQuotesCard';
import { PriorityQueueSection } from '@/components/meu-dia/PriorityQueueSection';
import { DailyFocusBlock } from '@/components/meu-dia/DailyFocusBlock';
import { CriticalBlockerModal } from '@/components/meu-dia/CriticalBlockerModal';
import { AlertTriangle, Clock, CalendarCheck, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isToday, isPast, parseISO, isFuture } from 'date-fns';

interface Props {
  effectiveSellerId: string | null;
  sellerId: string;
  isAdminOrOwner: boolean;
  isOwner?: boolean;
  debugEnabled: boolean;
  contactFilter: string | null;
  searchTerm: string;
  onSetTaskModalOpen: (v: boolean) => void;
  onSetPlanningModalOpen: (v: boolean) => void;
  onSetConfigModalOpen: (v: boolean) => void;
  onSetSelectedTask: (t: TaskData | null) => void;
  onSetAlertDetailsType: (t: CriticalAlert['type'] | null) => void;
  onSetCallsReportModalOpen: (v: boolean) => void;
  onSetWhatsappReportModalOpen: (v: boolean) => void;
  onSetContactFilter: (v: string | null) => void;
}

export function ActionCenterVendedor({
  effectiveSellerId, sellerId, isAdminOrOwner, isOwner = false, debugEnabled,
  contactFilter, searchTerm,
  onSetTaskModalOpen, onSetPlanningModalOpen, onSetConfigModalOpen,
  onSetSelectedTask, onSetAlertDetailsType: _onSetAlertDetailsType,
  onSetCallsReportModalOpen, onSetWhatsappReportModalOpen, onSetContactFilter,
}: Props) {
  const navigate = useNavigate();
  const overdueRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [deletingTask, setDeletingTask] = useState<TaskData | null>(null);

  const { alerts: baseAlerts, refetch } = useActionCenterData(effectiveSellerId);

  const alerts = useMemo(() => {
    const combined = [...baseAlerts];
    return combined;
  }, [baseAlerts]);

  const { workMonthConfig, isConfigured, sellerMetrics, aggregated, refetch: refetchTargets } = useWorkingDaysTargets(effectiveSellerId);
  const { tasks, refetch: refetchTasks } = useTasksData(undefined, effectiveSellerId, isOwner ? 'owner' : 'seller');
  const { hasCriticalBlock, criticalTasks, snooze } = useCriticalBlocker();
  const { focusItems, focusTaskIds, addFocus, removeFocus, suggestFocus, refetch: refetchFocus } = useDailyFocus();
  const taskLimits = useTaskLimits(tasks, effectiveSellerId);

  const handleRefresh = () => {
    refetch();
    refetchTasks();
    refetchTargets();
    refetchFocus();
    setSelectedTasks(new Set());
  };

  const pendingForSeller = useMemo(() =>
    tasks.filter(t => {
      if (t.status !== 'pendente') return false;
      if (!t.clientId && !t.clientName) return false;
      if (effectiveSellerId) {
        return t.clientSellerId === effectiveSellerId || t.assignedToSellerId === effectiveSellerId;
      }
      return true;
    }),
    [tasks, effectiveSellerId]
  );
  const focusSuggestions = useMemo(() => suggestFocus(pendingForSeller), [pendingForSeller, suggestFocus, focusItems]);

  const currentMetrics = useMemo(() => ({
    salesMonth: sellerMetrics?.salesMonth || aggregated.totalSalesMonth,
    ordersMonth: sellerMetrics?.ordersMonth || aggregated.totalOrdersMonth,
    tasksCompletedMonth: sellerMetrics?.tasksCompletedMonth || aggregated.totalTasksCompleted,
    tasksOpenCount: sellerMetrics?.tasksOpenCount || aggregated.totalTasksOpen,
    workingDays: workMonthConfig?.workingDays || 22,
  }), [sellerMetrics, aggregated, workMonthConfig]);

  const { overdueTasks, todayTasks, upcomingTasks } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const pending = tasks
      .filter(t => t.status === 'pendente')
      .filter(t => t.clientId || t.clientName)
      .filter(t => (effectiveSellerId ? (t.assignedToSellerId === effectiveSellerId) : true))
      .filter(t => { if (!searchLower) return true; return t.clientName.toLowerCase().includes(searchLower); });

    const overdue: TaskData[] = [];
    const today: TaskData[] = [];
    const upcoming: TaskData[] = [];

    pending.forEach(task => {
      if (!task.taskDate) { today.push(task); return; }
      const taskDate = parseISO(task.taskDate);
      if (isPast(taskDate) && !isToday(taskDate)) overdue.push(task);
      else if (isToday(taskDate)) today.push(task);
      else if (isFuture(taskDate)) upcoming.push(task);
    });

    const sortTasks = (a: TaskData, b: TaskData) => {
      const priorityOrder: Record<string, number> = { alta: 0, urgente: 1, normal: 2, baixa: 3 };
      const aPrio = priorityOrder[a.priority] ?? 2;
      const bPrio = priorityOrder[b.priority] ?? 2;
      if (aPrio !== bPrio) return aPrio - bPrio;
      const aDate = a.taskDate ? parseISO(a.taskDate).getTime() : 0;
      const bDate = b.taskDate ? parseISO(b.taskDate).getTime() : 0;
      return aDate - bDate;
    };

    return {
      overdueTasks: overdue.sort(sortTasks),
      todayTasks: today.sort(sortTasks),
      upcomingTasks: upcoming.sort(sortTasks),
    };
  }, [tasks, effectiveSellerId, searchTerm]);

  const totalPending = overdueTasks.length + todayTasks.length + upcomingTasks.length;

  const toggleTask = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleTaskClick = (task: TaskData) => onSetSelectedTask(task);
  const _handleDeleteTask = (task: TaskData) => setDeletingTask(task);

  // Suppress unused variable warnings
  void deletingTask;
  void alerts;
  void debugEnabled;
  void contactFilter;

  return (
    <>
      <DailyFocusBlock
        focusItems={focusItems}
        allTasks={pendingForSeller}
        suggestions={focusSuggestions}
        focusTaskIds={focusTaskIds}
        onAddFocus={addFocus}
        onRemoveFocus={removeFocus}
        onTaskClick={handleTaskClick}
      />

      {taskLimits.showWarning && (
        <p className="text-[12px] text-muted-foreground">
          Limite atingido ({taskLimits.pendingCount} abertas, max. {taskLimits.warnLimit}).
          {taskLimits.isBlocked ? ' Criacao bloqueada.' : ' Finalize antes de criar novas.'}
        </p>
      )}

      <OpenQuotesCard sellerId={effectiveSellerId} onCreateTask={() => onSetTaskModalOpen(true)} />

      <QuickShortcutsCard
        overdueCount={overdueTasks.length}
        todayCount={todayTasks.length}
        upcomingCount={upcomingTasks.length}
        onScrollToOverdue={() => overdueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onScrollToToday={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onScrollToUpcoming={() => upcomingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      <PriorityQueueSection />

      {isAdminOrOwner && (
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="sm" onClick={() => onSetConfigModalOpen(true)}
            className="text-[11px] font-medium text-muted-foreground">
            <Settings2 className="h-3 w-3 mr-1" />
            Configurar dias uteis
          </Button>
        </div>
      )}
      <ClickableScoreboard
        metrics={currentMetrics}
        isConfigured={isConfigured}
        activeFilter={contactFilter}
        onFilterChange={onSetContactFilter}
        onCallsCardClick={() => onSetCallsReportModalOpen(true)}
        onWhatsappCardClick={() => onSetWhatsappReportModalOpen(true)}
      />

      <div ref={overdueRef}>
        <TaskPrioritySection
          title="Atrasadas"
          subtitle={overdueTasks.length > 0 ? `${overdueTasks.length} tarefas precisam de atencao` : undefined}
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          tasks={overdueTasks}
          variant="overdue"
          selectedTasks={selectedTasks}
          onToggleTask={toggleTask}
          onComplete={handleTaskClick}
          onTaskClick={handleTaskClick}
          onDeleteTask={isOwner ? _handleDeleteTask : undefined}
          onRequestReschedule={(task) => console.log('Request reschedule:', task.id)}
          isAdmin={isAdminOrOwner}
          isOwner={isOwner}
          emptyState={
            <EmptyStateCard
              variant="overdue"
              onCreateTask={() => onSetTaskModalOpen(true)}
              onSearchClients={() => navigate('/clients?filter=no-contact-20')}
            />
          }
        />
      </div>

      <div ref={todayRef}>
        <TaskPrioritySection
          title="Tarefas de Hoje"
          subtitle={todayTasks.length > 0 ? `${todayTasks.length} tarefas para hoje` : undefined}
          icon={<Clock className="h-5 w-5 text-status-warning" />}
          tasks={todayTasks}
          variant="today"
          selectedTasks={selectedTasks}
          onToggleTask={toggleTask}
          onComplete={handleTaskClick}
          onTaskClick={handleTaskClick}
          onDeleteTask={isOwner ? _handleDeleteTask : undefined}
          onCreateFollowup={(task) => console.log('Create followup:', task.id)}
          isAdmin={isAdminOrOwner}
          isOwner={isOwner}
          emptyState={
            <EmptyStateCard
              variant="today"
              onCreateTask={() => onSetTaskModalOpen(true)}
              onSearchClients={() => navigate('/clients?filter=no-contact-20')}
              onPlanWeek={() => onSetPlanningModalOpen(true)}
            />
          }
        />
      </div>

      <div ref={upcomingRef}>
        <TaskPrioritySection
          title="Proximos Dias"
          subtitle={upcomingTasks.length > 0 ? `${upcomingTasks.length} tarefas agendadas` : undefined}
          icon={<CalendarCheck className="h-5 w-5 text-primary" />}
          tasks={upcomingTasks}
          variant="upcoming"
          selectedTasks={selectedTasks}
          onToggleTask={toggleTask}
          onComplete={handleTaskClick}
          onTaskClick={handleTaskClick}
          onDeleteTask={isOwner ? _handleDeleteTask : undefined}
          isAdmin={isAdminOrOwner}
          isOwner={isOwner}
          emptyState={
            <EmptyStateCard
              variant="upcoming"
              onCreateTask={() => onSetTaskModalOpen(true)}
              onSearchClients={() => navigate('/clients?filter=no-contact-20')}
              onPlanWeek={() => onSetPlanningModalOpen(true)}
            />
          }
        />
      </div>

      {totalPending === 0 && (
        <EmptyStateCard
          variant="all"
          onCreateTask={() => onSetTaskModalOpen(true)}
          onSearchClients={() => navigate('/clients?filter=no-contact-20')}
          onPlanWeek={() => onSetPlanningModalOpen(true)}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedTasks.size}
        selectedTaskIds={selectedTasks}
        onClearSelection={() => setSelectedTasks(new Set())}
        onActionComplete={handleRefresh}
        sellerId={sellerId}
      />

      <CriticalBlockerModal
        open={hasCriticalBlock}
        tasks={criticalTasks}
        onOpenTask={(taskId) => {
          const task = tasks.find(t => t.id === taskId);
          if (task) onSetSelectedTask(task);
        }}
        onSnooze={snooze}
      />
    </>
  );
}
