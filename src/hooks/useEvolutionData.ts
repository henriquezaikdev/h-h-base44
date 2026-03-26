import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isWeekend, subMonths, isBefore, isSameDay
} from 'date-fns';

/**
 * useEvolutionData — baseado APENAS em tabelas reais do BANCO.md:
 * - orders (seller_id, total, status, created_at)
 * - tasks (assigned_to, status, due_date, done_at)
 * - sellers (id, name, role)
 *
 * Tabelas de gamificação (seller_levels, seller_errors, seller_stars,
 * interactions, work_month_config) NÃO existem no banco atual.
 * Quando forem criadas, este hook será expandido.
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
  workDaysInMonth: number;
  workDaysPassed: number;
  previousMonthSales: number;
  loading: boolean;
}

async function fetchEvolutionData(
  sellerId: string,
  month: number,
  year: number
): Promise<Omit<EvolutionData, 'loading'>> {
  const now = new Date();
  const refDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  // Calculate work days
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workDays = allDays.filter(d => !isWeekend(d));
  const workDaysInMonth = workDays.length;

  const isPastMonth = refDate < startOfMonth(now);
  const workDaysPassed = isPastMonth
    ? workDaysInMonth
    : workDays.filter(d => isBefore(d, now) || isSameDay(d, now)).length;

  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  // Fetch orders for current month (real columns: seller_id, total, created_at)
  const { data: ordersData } = await supabase
    .from('orders')
    .select('total, created_at')
    .eq('seller_id', sellerId)
    .gte('created_at', monthStartStr + 'T00:00:00')
    .lte('created_at', monthEndStr + 'T23:59:59');

  const orders = ordersData || [];
  const currentMonthSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const currentMonthOrderCount = orders.length;

  // Fetch tasks completed this month (real columns: assigned_to, done_at, status)
  const { data: completedTasksData } = await supabase
    .from('tasks')
    .select('done_at')
    .eq('assigned_to', sellerId)
    .eq('status', 'done')
    .gte('done_at', monthStartStr + 'T00:00:00')
    .lte('done_at', monthEndStr + 'T23:59:59');

  const completedTasks = completedTasksData || [];
  const currentMonthTasksCompleted = completedTasks.length;

  // Fetch open tasks count
  const { count: openCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', sellerId)
    .eq('status', 'open');

  // Build daily activity map from completed tasks
  const activityMap = new Map<string, DailyActivity>();
  workDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    activityMap.set(dateStr, { date: dateStr, sales: 0, tasksCompleted: 0 });
  });

  orders.forEach(order => {
    if (!order.created_at) return;
    const dateStr = order.created_at.split('T')[0];
    const activity = activityMap.get(dateStr);
    if (activity) {
      activity.sales += order.total || 0;
    }
  });

  completedTasks.forEach(task => {
    if (!task.done_at) return;
    const dateStr = task.done_at.split('T')[0];
    const activity = activityMap.get(dateStr);
    if (activity) {
      activity.tasksCompleted++;
    }
  });

  const dailyActivities = Array.from(activityMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Previous month sales for comparison
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
    workDaysInMonth,
    workDaysPassed,
    previousMonthSales,
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
    workDaysInMonth: 0,
    workDaysPassed: 0,
    previousMonthSales: 0,
    loading: query.isLoading,
  };

  return {
    ...(query.data || defaultData),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
