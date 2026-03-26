import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, format } from 'date-fns';

/**
 * useActionCenterData — alertas e métricas do Action Center.
 * Usa APENAS tabelas reais: tasks (assigned_to, status, due_date), clients (seller_id, last_order_at)
 * Tabelas que NÃO existem: interactions, daily_goals
 */

export interface CriticalAlert {
  id: string;
  label: string;
  count: number;
  type: 'overdue_tasks' | 'clients_no_order';
}

export function useActionCenterData(sellerId?: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['action-center-data', sellerId],
    queryFn: async () => {
      if (!sellerId) return { alerts: [] as CriticalAlert[] };

      const today = format(new Date(), 'yyyy-MM-dd');
      const sixtyDaysAgo = format(subDays(new Date(), 60), 'yyyy-MM-dd');

      // 1. Overdue tasks
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', sellerId)
        .eq('status', 'open')
        .lt('due_date', today);

      // 2. Clients without order in 60+ days
      const { count: noOrderCount } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .lt('last_order_at', sixtyDaysAgo + 'T00:00:00');

      const alerts: CriticalAlert[] = [];

      if ((overdueCount || 0) > 0) {
        alerts.push({
          id: 'overdue_tasks',
          label: `${overdueCount} tarefas atrasadas`,
          count: overdueCount || 0,
          type: 'overdue_tasks',
        });
      }

      if ((noOrderCount || 0) > 0) {
        alerts.push({
          id: 'clients_no_order',
          label: `${noOrderCount} clientes sem pedido ha 60+ dias`,
          count: noOrderCount || 0,
          type: 'clients_no_order',
        });
      }

      return { alerts };
    },
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    alerts: data?.alerts || [],
    loading: isLoading,
    refetch,
  };
}
