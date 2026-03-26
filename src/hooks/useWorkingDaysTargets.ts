import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { isWeekend, eachDayOfInterval, startOfMonth, endOfMonth, isBefore, isSameDay, format } from 'date-fns';

/**
 * useWorkingDaysTargets — métricas reais de vendas e tarefas.
 * Usa APENAS tabelas reais: orders (seller_id, total, created_at), tasks (assigned_to, status, done_at), sellers (id, name)
 * Tabelas que NÃO existem: work_month_config, seller_levels, interactions, daily_goals
 */

export interface SellerMetricsCalculated {
  sellerId: string;
  sellerName: string;
  salesMonth: number;
  ordersMonth: number;
  tasksCompletedMonth: number;
  tasksOpenCount: number;
}

export interface WorkingDaysTargetsData {
  workMonthConfig: { yearMonth: string; workingDays: number };
  workDaysPassed: number;
  isConfigured: boolean;
  sellerMetrics: SellerMetricsCalculated | null;
  aggregated: AggregatedMetrics;
  loading: boolean;
  refetch: () => void;
}

export interface AggregatedMetrics {
  totalSalesMonth: number;
  totalOrdersMonth: number;
  totalTasksCompleted: number;
  totalTasksOpen: number;
}

export function useWorkingDaysTargets(sellerIdFilter?: string | null): WorkingDaysTargetsData {
  const [loading, setLoading] = useState(true);
  const [sellerMetrics, setSellerMetrics] = useState<SellerMetricsCalculated | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedMetrics>({
    totalSalesMonth: 0, totalOrdersMonth: 0, totalTasksCompleted: 0, totalTasksOpen: 0,
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workDaysTotal = allDays.filter(d => !isWeekend(d)).length;
  const workDaysPassed = allDays.filter(d => !isWeekend(d) && (isBefore(d, now) || isSameDay(d, now))).length;
  const yearMonth = format(now, 'yyyy-MM');

  const monthStartStr = format(monthStart, 'yyyy-MM-dd') + 'T00:00:00';
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd') + 'T23:59:59';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (sellerIdFilter) {
        // Fetch for specific seller
        const [ordersRes, tasksCompletedRes, tasksOpenRes, sellerRes] = await Promise.all([
          supabase.from('orders').select('total').eq('seller_id', sellerIdFilter)
            .gte('created_at', monthStartStr).lte('created_at', monthEndStr),
          supabase.from('tasks').select('id', { count: 'exact', head: true })
            .eq('assigned_to', sellerIdFilter).eq('status', 'done')
            .gte('done_at', monthStartStr).lte('done_at', monthEndStr),
          supabase.from('tasks').select('id', { count: 'exact', head: true })
            .eq('assigned_to', sellerIdFilter).eq('status', 'open'),
          supabase.from('sellers').select('id, name').eq('id', sellerIdFilter).maybeSingle(),
        ]);

        const orders = ordersRes.data || [];
        const salesMonth = orders.reduce((s, o) => s + (o.total || 0), 0);

        setSellerMetrics({
          sellerId: sellerIdFilter,
          sellerName: sellerRes.data?.name || '',
          salesMonth,
          ordersMonth: orders.length,
          tasksCompletedMonth: tasksCompletedRes.count || 0,
          tasksOpenCount: tasksOpenRes.count || 0,
        });

        setAggregated({
          totalSalesMonth: salesMonth,
          totalOrdersMonth: orders.length,
          totalTasksCompleted: tasksCompletedRes.count || 0,
          totalTasksOpen: tasksOpenRes.count || 0,
        });
      } else {
        // Fetch aggregated
        const [ordersRes, tasksCompletedRes, tasksOpenRes] = await Promise.all([
          supabase.from('orders').select('total')
            .gte('created_at', monthStartStr).lte('created_at', monthEndStr),
          supabase.from('tasks').select('id', { count: 'exact', head: true })
            .eq('status', 'done')
            .gte('done_at', monthStartStr).lte('done_at', monthEndStr),
          supabase.from('tasks').select('id', { count: 'exact', head: true })
            .eq('status', 'open'),
        ]);

        const orders = ordersRes.data || [];
        setAggregated({
          totalSalesMonth: orders.reduce((s, o) => s + (o.total || 0), 0),
          totalOrdersMonth: orders.length,
          totalTasksCompleted: tasksCompletedRes.count || 0,
          totalTasksOpen: tasksOpenRes.count || 0,
        });
      }
    } catch (err) {
      console.error('[useWorkingDaysTargets] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerIdFilter, monthStartStr, monthEndStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(() => ({
    workMonthConfig: { yearMonth, workingDays: workDaysTotal },
    workDaysPassed,
    isConfigured: true,
    sellerMetrics,
    aggregated,
    loading,
    refetch: fetchData,
  }), [yearMonth, workDaysTotal, workDaysPassed, sellerMetrics, aggregated, loading, fetchData]);
}
