import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isWeekend, subMonths, isBefore, isSameDay
} from 'date-fns';

/**
 * useEvolutionData — schema real do banco 2.0:
 * - orders (seller_id, total, created_at)
 * - tasks (created_by_seller_id, assigned_to_seller_id, status_crm,
 *          completed_at, contact_type, is_deleted)
 *
 * Tabelas que NÃO existem: seller_levels, seller_errors, seller_stars,
 * interactions, work_month_config
 */

export interface DailyActivity {
  date: string;
  sales: number;
  tasksCompleted: number;
}

export interface SalesBreakdown {
  total: number;
  orderCount: number;
}

export interface EvolutionData {
  dailyActivities: DailyActivity[];
  currentMonthSales: number;
  currentMonthOrderCount: number;
  currentMonthTasksCompleted: number;
  currentMonthTasksOpen: number;
  currentMonthCalls: number;
  currentMonthWhatsapp: number;
  workDaysInMonth: number;
  workDaysPassed: number;
  previousMonthSales: number;
  // Placeholders — tabelas de gamificação não existem ainda
  previousMonthMet: boolean | null;
  level: null;
  errors: never[];
  stars: null;
  salesByMargin: never[];
  loading: boolean;
}

const toBrtDateStr = (isoStr: string): string => {
  const date = new Date(isoStr.replace(' ', 'T'));
  return format(new Date(date.getTime() - 3 * 60 * 60 * 1000), 'yyyy-MM-dd');
};

async function fetchEvolutionData(
  sellerId: string,
  month: number,
  year: number
): Promise<Omit<EvolutionData, 'loading'>> {
  const now = new Date();
  const refDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workDays = allDays.filter(d => !isWeekend(d));
  const workDaysInMonth = workDays.length;

  const isPastMonth = refDate < startOfMonth(now);
  const workDaysPassed = isPastMonth
    ? workDaysInMonth
    : workDays.filter(d => isBefore(d, now) || isSameDay(d, now)).length;

  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  // 1. Orders do mês
  const { data: ordersData } = await supabase
    .from('orders')
    .select('total, created_at')
    .eq('seller_id', sellerId)
    .gte('created_at', monthStartStr + 'T00:00:00')
    .lte('created_at', monthEndStr + 'T23:59:59');

  const orders = ordersData || [];
  const currentMonthSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const currentMonthOrderCount = orders.length;

  // 2. Tasks concluídas no mês (schema 2.0)
  // Usa task_date para filtro de mês (completed_at pode ser null em tarefas antigas)
  const { data: completedTasksData } = await supabase
    .from('tasks')
    .select('completed_at, task_date, contact_type')
    .eq('is_deleted', false)
    .eq('status_crm', 'concluida')
    .gte('task_date', monthStartStr)
    .lte('task_date', monthEndStr)
    .or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);

  const completedTasks = completedTasksData || [];
  const currentMonthTasksCompleted = completedTasks.length;
  const currentMonthCalls = completedTasks.filter((t: any) => t.contact_type === 'ligacao').length;
  const currentMonthWhatsapp = completedTasks.filter((t: any) => t.contact_type === 'whatsapp').length;

  // 3. Tasks abertas
  const { count: openCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('status_crm', 'pendente')
    .or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);

  // 4. Daily activity map — todos os dias do mês
  const activityMap = new Map<string, DailyActivity>();
  allDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    activityMap.set(dateStr, { date: dateStr, sales: 0, tasksCompleted: 0 });
  });

  orders.forEach(order => {
    if (!order.created_at) return;
    const dateStr = toBrtDateStr(order.created_at);
    const activity = activityMap.get(dateStr);
    if (activity) {
      activity.sales += order.total || 0;
    }
  });

  completedTasks.forEach((task: any) => {
    // Usa completed_at se disponível, senão usa task_date
    const dateSource = task.completed_at || task.task_date;
    if (!dateSource) return;
    const dateStr = task.completed_at ? toBrtDateStr(task.completed_at) : dateSource;
    const activity = activityMap.get(dateStr);
    if (activity) {
      activity.tasksCompleted++;
    }
  });

  const dailyActivities = Array.from(activityMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 5. Previous month sales
  const prevMonth = subMonths(refDate, 1);
  const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

  const { data: prevOrdersData } = await supabase
    .from('orders')
    .select('total')
    .eq('seller_id', sellerId)
    .gte('created_at', prevStart + 'T00:00:00')
    .lte('created_at', prevEnd + 'T23:59:59');

  const previousMonthSales = (prevOrdersData || []).reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    dailyActivities,
    currentMonthSales,
    currentMonthOrderCount,
    currentMonthTasksCompleted,
    currentMonthTasksOpen: openCount || 0,
    currentMonthCalls,
    currentMonthWhatsapp,
    workDaysInMonth,
    workDaysPassed,
    previousMonthSales,
    // Placeholders
    previousMonthMet: null,
    level: null,
    errors: [],
    stars: null,
    salesByMargin: [],
  };
}

export function useEvolutionData(sellerId: string | null, month?: number, year?: number) {
  const now = new Date();
  const effectiveMonth = month ?? (now.getMonth() + 1);
  const effectiveYear = year ?? now.getFullYear();

  const queryKey = useMemo(
    () => ['evolution-data', sellerId, effectiveMonth, effectiveYear] as const,
    [sellerId, effectiveMonth, effectiveYear]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchEvolutionData(sellerId!, effectiveMonth, effectiveYear),
    enabled: !!sellerId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const defaultData: EvolutionData = {
    dailyActivities: [],
    currentMonthSales: 0,
    currentMonthOrderCount: 0,
    currentMonthTasksCompleted: 0,
    currentMonthTasksOpen: 0,
    currentMonthCalls: 0,
    currentMonthWhatsapp: 0,
    workDaysInMonth: 0,
    workDaysPassed: 0,
    previousMonthSales: 0,
    previousMonthMet: null,
    level: null,
    errors: [],
    stars: null,
    salesByMargin: [],
    loading: query.isLoading,
  };

  return {
    ...(query.data || defaultData),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
