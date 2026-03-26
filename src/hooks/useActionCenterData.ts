import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, format } from 'date-fns';

/**
 * useActionCenterData — alertas e métricas do Action Center.
 * Schema real do banco 2.0:
 * - tasks: status_crm, task_date, created_by_seller_id, assigned_to_seller_id, is_deleted
 * - clients: seller_id, last_order_at, classification, ranking_tier
 * - interactions: responsible_seller_id, interaction_date
 */

export interface CriticalAlert {
  id: string;
  label: string;
  count: number;
  type: 'recurrent_no_order' | 'top_no_contact' | 'revenue_drop' | 'overdue_tasks' | 'entering_60days';
}

export interface PriorityClient {
  id: string;
  name: string;
  ranking_tier: string | null;
  days_since_order: number | null;
  classification: string | null;
  last_order_at: string | null;
}

export interface DailyScore {
  calls: number;
  whatsapp: number;
  contacts: number;
  sales: number;
}

export function useActionCenterData(sellerId?: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['action-center-data', sellerId],
    queryFn: async () => {
      if (!sellerId) return { alerts: [] as CriticalAlert[], dailyScore: null as DailyScore | null };

      const today = format(new Date(), 'yyyy-MM-dd');
      const sixtyDaysAgo = format(subDays(new Date(), 60), 'yyyy-MM-dd');
      // 1. Tarefas atrasadas (status_crm = pendente, task_date < hoje)
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status_crm', 'pendente')
        .lt('task_date', today)
        .or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);

      // 2. Clientes recorrentes sem pedido há 60+ dias
      const { count: recurrentNoOrder } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .in('classification', ['recorrente', 'top_20', 'top_100'])
        .lt('last_order_at', sixtyDaysAgo + 'T00:00:00');

      // 3. Clientes entrando na zona de 60 dias (entre 50 e 60 dias sem pedido)
      const fiftyDaysAgo = format(subDays(new Date(), 50), 'yyyy-MM-dd');
      const { count: entering60 } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .lt('last_order_at', fiftyDaysAgo + 'T00:00:00')
        .gte('last_order_at', sixtyDaysAgo + 'T00:00:00');

      // 4. Contatos de hoje (interações do vendedor)
      let dailyScore: DailyScore = { calls: 0, whatsapp: 0, contacts: 0, sales: 0 };

      const { data: todayInteractions } = await supabase
        .from('interactions')
        .select('interaction_type')
        .eq('responsible_seller_id', sellerId)
        .eq('interaction_date', today);

      if (todayInteractions) {
        dailyScore.calls = todayInteractions.filter((i: any) => i.interaction_type === 'ligacao').length;
        dailyScore.whatsapp = todayInteractions.filter((i: any) => i.interaction_type === 'whatsapp').length;
        dailyScore.contacts = todayInteractions.length;
      }

      // 5. Vendas de hoje
      const { data: todaySales } = await supabase
        .from('orders')
        .select('total')
        .eq('seller_id', sellerId)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');

      if (todaySales) {
        dailyScore.sales = todaySales.reduce((sum, o) => sum + (o.total || 0), 0);
      }

      // Montar alertas
      const alerts: CriticalAlert[] = [];

      if ((overdueCount || 0) > 0) {
        alerts.push({
          id: 'overdue_tasks',
          label: `${overdueCount} tarefas atrasadas`,
          count: overdueCount || 0,
          type: 'overdue_tasks',
        });
      }

      if ((recurrentNoOrder || 0) > 0) {
        alerts.push({
          id: 'recurrent_no_order',
          label: `${recurrentNoOrder} clientes recorrentes sem pedido ha 60+ dias`,
          count: recurrentNoOrder || 0,
          type: 'recurrent_no_order',
        });
      }

      if ((entering60 || 0) > 0) {
        alerts.push({
          id: 'entering_60days',
          label: `${entering60} clientes entrando na zona de 60 dias`,
          count: entering60 || 0,
          type: 'entering_60days',
        });
      }

      return { alerts, dailyScore };
    },
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    alerts: data?.alerts || [],
    dailyScore: data?.dailyScore || null,
    loading: isLoading,
    refetch,
  };
}
