import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllPaginated } from '@/lib/paginatedQuery';
import { startOfMonth, subMonths, format, subDays, startOfWeek } from 'date-fns';
import {
  saoPauloDayKey,
  saoPauloDayRange,
  isEffectiveCall,
  isEffectiveWhatsapp
} from '@/lib/metricsService';
import { cancelPendingInvalidation } from '@/lib/realtimeUtils';
import { calculateDaysSinceDate } from '@/lib/utils';

export interface CriticalAlert {
  id: string;
  label: string;
  count: number;
  type: 'recurrent_no_order' | 'top_no_contact' | 'revenue_drop' | 'overdue_tasks' | 'replenishment_overdue' | 'entering_60days';
}

export interface PriorityClient {
  id: string;
  companyName: string;
  tier: string;
  lastOrderDate: string | null;
  daysSinceOrder: number | null;
  lastContactDate: string | null;
  daysSinceContact: number | null;
  reason: string;
  reasonType: string;
  phone: string | null;
  buyerWhatsapp: string | null;
}

export type ContactReason = 'RETORNO' | 'ACOMPANHAMENTO' | 'VENDA' | 'POS_VENDA';

export interface TodayTask {
  id: string;
  clientId: string;
  clientName: string;
  contactType: string;
  contactReason: ContactReason;
  taskDate: string;
  taskTime: string | null;
  notes: string | null;
  status: string;
  isOverdue: boolean;
  priority: 'alta' | 'media' | 'baixa';
}

export interface DailyScore {
  contactsToday: number;
  callsToday: number;
  whatsappsToday: number;
  ordersToday: number;
  orderValueToday: number;
  clientsNoContact15Days: number;
}

interface ActionCenterData {
  alerts: CriticalAlert[];
  priorityClients: PriorityClient[];
  todayTasks: TodayTask[];
  overdueTasks: TodayTask[];
  dailyScore: DailyScore;
  dailyTarget: number;
}

// Using unified metrics service helpers: saoPauloDayKey, saoPauloDayRange, isEffectiveCall, isEffectiveWhatsapp
// Imported from @/lib/metricsService

async function fetchActionCenterData(sellerId: string): Promise<ActionCenterData> {
  const now = new Date();
  const today = now;
  const { dayKey: todayStr } = saoPauloDayRange(now);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Parallel fetch: clients + daily score data
  const [clientsResult, todayInteractionsResult, todayTasksCompletedResult, todayOrdersResult, dailyGoalResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id, company_name, status, classification, ranking_tier, last_order_date, phone, seller_id, last_contact_at, related_client_id')
      .eq('seller_id', sellerId)
      .eq('is_deleted', false),
    supabase
      .from('interactions')
      .select('interaction_type')
      .eq('responsible_seller_id', sellerId)
      .eq('interaction_date', saoPauloDayRange(now).dayKey),
    supabase
      .from('tasks')
      .select('contact_type')
      .eq('created_by_seller_id', sellerId)
      .eq('status', 'concluida')
      .gte('completed_at', saoPauloDayRange(now).startIso)
      .lte('completed_at', saoPauloDayRange(now).endIso),
    supabase
      .from('orders')
      .select('total')
      .eq('seller_id', sellerId)
      .eq('is_accountable', true)
      .eq('order_date', saoPauloDayRange(now).dayKey),
    supabase
      .from('daily_goals')
      .select('contacts_target')
      .eq('seller_id', sellerId)
      .maybeSingle(),
  ]);

  const clients = clientsResult.data;
  const clientIds = clients?.map(c => c.id) || [];

  // Second batch: depends on clientIds
  const [buyersResult, ordersResult, tasksResult, interactionsForContactResult] = await Promise.all([
    supabase.from('buyers').select('client_id, whatsapp').in('client_id', clientIds),
    supabase.from('orders').select('client_id, total, order_date').in('client_id', clientIds.filter(Boolean)).eq('is_accountable', true).gte('order_date', format(startOfMonth(subMonths(today, 3)), 'yyyy-MM-dd')).limit(2000),
    supabase.from('tasks').select('id, client_id, contact_type, contact_reason, task_date, task_time, notes, status, created_by_seller_id, priority').in('status', ['pendente']).in('client_id', clientIds.length > 0 ? clientIds : ['__none__']).lte('task_date', todayStr).order('task_date', { ascending: true }).limit(100),
    // Fetch interactions only for clients without last_contact_at
    (() => {
      const clientsWithoutContact = clients?.filter(c => !c.last_contact_at).map(c => c.id).filter(Boolean) || [];
      if (clientsWithoutContact.length === 0) return Promise.resolve({ data: [] });
      return supabase.from('interactions').select('client_id, interaction_date').in('client_id', clientsWithoutContact).order('interaction_date', { ascending: false }).limit(500);
    })(),
  ]);

  const buyers = buyersResult.data;
  const orders = ordersResult.data || [];
  const tasks = tasksResult.data;

  const buyerMap = new Map<string, string>();
  buyers?.forEach(b => {
    if (b.whatsapp && !buyerMap.has(b.client_id)) {
      buyerMap.set(b.client_id, b.whatsapp);
    }
  });

  // Build last contact map
  const lastContactMap = new Map<string, string>();
  clients?.forEach(c => {
    if (c.last_contact_at) {
      lastContactMap.set(c.id, c.last_contact_at);
    }
  });

  (interactionsForContactResult.data || []).forEach((i: any) => {
    if (!lastContactMap.has(i.client_id)) {
      lastContactMap.set(i.client_id, i.interaction_date);
    }
  });

  // Calculate monthly averages per client
  const clientMonthlyRevenue = new Map<string, { currentMonth: number; lastThreeMonths: number[] }>();
  orders.forEach(o => {
    const orderDate = new Date(o.order_date);
    const monthKey = format(orderDate, 'yyyy-MM');
    const currentMonthKey = format(today, 'yyyy-MM');

    if (!clientMonthlyRevenue.has(o.client_id)) {
      clientMonthlyRevenue.set(o.client_id, { currentMonth: 0, lastThreeMonths: [] });
    }
    const data = clientMonthlyRevenue.get(o.client_id)!;

    if (monthKey === currentMonthKey) {
      data.currentMonth += o.total;
    } else {
      data.lastThreeMonths.push(o.total);
    }
  });

  // Calculate alerts
  let recurrentNoOrder = 0;
  let topNoContact = 0;
  let revenueDrop = 0;
  let entering60Days = 0; // New: clients transitioning from recurrent to 60 days

  const priorityList: PriorityClient[] = [];

  clients?.forEach(client => {
    // Skip linked branches - they follow their matrix status
    // This prevents duplicate alerts for branches that inherit from matrix
    if (client.related_client_id) {
      return;
    }

    const lastContact = lastContactMap.get(client.id);
    const daysSinceContact = lastContact
      ? Math.floor((today.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Dynamic calculation from last_order_date - always accurate
    const daysSinceOrder = calculateDaysSinceDate(client.last_order_date);
    const isRecurrent = client.classification === 'recorrente';
    const isTop = ['top20', 'top100'].includes(client.ranking_tier || '');

    // Check revenue drop
    const revenueData = clientMonthlyRevenue.get(client.id);
    let hasRevenueDrop = false;
    if (revenueData && revenueData.lastThreeMonths.length >= 2) {
      const avg = revenueData.lastThreeMonths.reduce((a, b) => a + b, 0) / revenueData.lastThreeMonths.length;
      if (avg > 0 && revenueData.currentMonth < avg * 0.7) {
        hasRevenueDrop = true;
      }
    }

    // Build reasons and priorities
    let reason = '';
    let reasonType = '';
    let priority = 0;

    // NEW: Check clients entering 60 days zone (46-60 days) - was recurrent, now at risk
    if (daysSinceOrder && daysSinceOrder >= 46 && daysSinceOrder <= 60) {
      entering60Days++;
      reason = `\u26a0\ufe0f Entrando em 60 dias (${daysSinceOrder} dias sem pedido)`;
      reasonType = 'entering_60days';
      priority = 5; // Highest priority - needs immediate action
    }

    // Recurrent clients without order for 45+ days (but more than 60 days = already counted above or inactive)
    if (daysSinceOrder && daysSinceOrder > 60) {
      recurrentNoOrder++;
      if (!reason) {
        reason = `Sem pedido ha ${daysSinceOrder} dias`;
        reasonType = 'recurrent_no_order';
        priority = Math.max(priority, 4);
      }
    }

    if (isTop && (daysSinceContact === null || daysSinceContact >= 15)) {
      topNoContact++;
      if (!reason) {
        reason = `Top cliente sem contato ha ${daysSinceContact ?? '?'} dias`;
        reasonType = 'top_no_contact';
      }
      priority = Math.max(priority, 3);
    }

    if (hasRevenueDrop) {
      revenueDrop++;
      if (!reason) {
        reason = 'Queda de compra vs media 3 meses';
        reasonType = 'revenue_drop';
      }
      priority = Math.max(priority, 2);
    }

    if (priority > 0) {
      priorityList.push({
        id: client.id,
        companyName: client.company_name,
        tier: client.ranking_tier || 'geral',
        lastOrderDate: client.last_order_date,
        daysSinceOrder: daysSinceOrder,
        lastContactDate: lastContact || null,
        daysSinceContact,
        reason,
        reasonType,
        phone: client.phone,
        buyerWhatsapp: buyerMap.get(client.id) || null,
      });
    }
  });

  // Tasks already fetched in parallel batch above (tasksResult)

  // Get client names for tasks
  const taskClientIds = [...new Set((tasks?.map(t => t.client_id) || []).filter(Boolean))];
  const { data: taskClients } = taskClientIds.length > 0
    ? await supabase.from('clients').select('id, company_name').in('id', taskClientIds)
    : { data: [] as { id: string; company_name: string }[] };

  const taskClientMap = new Map(taskClients?.map(c => [c.id, c.company_name]) || []);

  const todayTasksList: TodayTask[] = [];
  const overdueTasksList: TodayTask[] = [];
  let overdueCount = 0;

  tasks?.forEach(task => {
    const isOverdue = task.task_date < todayStr;
    const taskData: TodayTask = {
      id: task.id,
      clientId: task.client_id,
      clientName: taskClientMap.get(task.client_id) || '',
      contactType: task.contact_type,
      contactReason: (task.contact_reason as ContactReason) || 'RETORNO',
      taskDate: task.task_date,
      taskTime: task.task_time,
      notes: task.notes,
      status: task.status,
      isOverdue,
      priority: (task.priority as 'alta' | 'media' | 'baixa') || 'media',
    };

    if (isOverdue) {
      overdueTasksList.push(taskData);
      overdueCount++;
    } else {
      todayTasksList.push(taskData);
    }
  });

  // Add overdue tasks to priority list
  overdueTasksList.forEach(task => {
    const existingIndex = priorityList.findIndex(p => p.id === task.clientId);
    if (existingIndex === -1) {
      const client = clients?.find(c => c.id === task.clientId);
      if (client) {
        priorityList.unshift({
          id: client.id,
          companyName: client.company_name,
          tier: client.ranking_tier || 'geral',
          lastOrderDate: client.last_order_date,
          daysSinceOrder: calculateDaysSinceDate(client.last_order_date),
          lastContactDate: lastContactMap.get(client.id) || null,
          daysSinceContact: null,
          reason: 'Retorno vencido',
          reasonType: 'overdue_tasks',
          phone: client.phone,
          buyerWhatsapp: buyerMap.get(client.id) || null,
        });
      }
    }
  });

  // Daily score - use data already fetched in parallel batch
  const todayInteractions = todayInteractionsResult.data;
  const todayTasksCompleted = todayTasksCompletedResult.data;
  const todayOrders = todayOrdersResult.data;

  const interactionsCount = todayInteractions?.length || 0;
  const tasksCompletedCount = todayTasksCompleted?.length || 0;

  const interactionCalls = (todayInteractions || []).filter(i => isEffectiveCall(i.interaction_type)).length;
  const interactionWhats = (todayInteractions || []).filter(i => isEffectiveWhatsapp(i.interaction_type)).length;

  const taskCalls = (todayTasksCompleted || []).filter(t => isEffectiveCall(t.contact_type) || t.contact_type?.toLowerCase() === 'ligacao').length;
  const taskWhats = (todayTasksCompleted || []).filter(t => isEffectiveWhatsapp(t.contact_type) || t.contact_type?.toLowerCase() === 'whatsapp').length;

  const contactsToday = interactionsCount + tasksCompletedCount;
  const callsToday = interactionCalls + taskCalls;
  const whatsappsToday = interactionWhats + taskWhats;

  // Count clients with no contact in last 15 days
  const fifteenDaysAgo = subDays(now, 15);
  let noContact15Days = 0;
  clients?.forEach(client => {
    const lastContact = lastContactMap.get(client.id);
    if (!lastContact || new Date(lastContact) < fifteenDaysAgo) {
      noContact15Days++;
    }
  });

  const dailyGoalData = dailyGoalResult.data;

  return {
    alerts: [
      { id: '0', label: '\u26a0\ufe0f Entrando em 60 dias (46-60d)', count: entering60Days, type: 'entering_60days' },
      { id: '1', label: 'Clientes sem pedido (60+ dias)', count: recurrentNoOrder, type: 'recurrent_no_order' },
      { id: '2', label: 'Top clientes sem contato (15+ dias)', count: topNoContact, type: 'top_no_contact' },
      { id: '3', label: 'Queda de compra (<70% media)', count: revenueDrop, type: 'revenue_drop' },
      { id: '4', label: 'Retornos vencidos', count: overdueCount, type: 'overdue_tasks' },
    ],
    priorityClients: priorityList.slice(0, 40),
    todayTasks: todayTasksList,
    overdueTasks: overdueTasksList,
    dailyScore: {
      contactsToday,
      callsToday,
      whatsappsToday,
      ordersToday: todayOrders?.length || 0,
      orderValueToday: todayOrders?.reduce((sum, o) => sum + o.total, 0) || 0,
      clientsNoContact15Days: noContact15Days,
    },
    dailyTarget: dailyGoalData?.contacts_target || 20,
  };
}

/**
 * Hook para dados do Action Center usando React Query.
 *
 * IMPORTANTE: Usa useQuery para manter dados em cache e evitar
 * refetch desnecessario ao remontar componentes ou trocar abas.
 */
export function useActionCenterData(sellerId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<ActionCenterData>({
    queryKey: ['actionCenter', sellerId],
    queryFn: () => fetchActionCenterData(sellerId!),
    enabled: !!sellerId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 30, // 30 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Realtime updates (invalidate cache instead of direct setState)
  useEffect(() => {
    if (!sellerId) return;

    // TEMP: disabled realtime invalidation due to crash/loading regression - reintroduce after stabilization
    const invalidationKey = `action-center-${sellerId}`;

    return () => {
      cancelPendingInvalidation(invalidationKey);
    };
  }, [sellerId]);

  const defaultData: ActionCenterData = {
    alerts: [],
    priorityClients: [],
    todayTasks: [],
    overdueTasks: [],
    dailyScore: {
      contactsToday: 0,
      callsToday: 0,
      whatsappsToday: 0,
      ordersToday: 0,
      orderValueToday: 0,
      clientsNoContact15Days: 0,
    },
    dailyTarget: 20,
  };

  return {
    alerts: query.data?.alerts ?? defaultData.alerts,
    priorityClients: query.data?.priorityClients ?? defaultData.priorityClients,
    todayTasks: query.data?.todayTasks ?? defaultData.todayTasks,
    overdueTasks: query.data?.overdueTasks ?? defaultData.overdueTasks,
    dailyScore: query.data?.dailyScore ?? defaultData.dailyScore,
    dailyTarget: query.data?.dailyTarget ?? defaultData.dailyTarget,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
