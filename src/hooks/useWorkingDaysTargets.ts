import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { format, isWeekend, eachDayOfInterval, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import {
  saoPauloDayKey,
  saoPauloDayRange,
  isEffectiveCall,
  isEffectiveWhatsapp
} from '@/lib/metricsService';
import {
  LEVEL_MONTHLY_TARGETS,
} from '@/lib/sellerMetaService';
import type { SellerLevel } from '@/lib/sellerMetaService';
import { cancelPendingInvalidation } from '@/lib/realtimeUtils';

interface SellerTargets {
  sellerId: string;
  sellerName: string;
  currentLevel: SellerLevel;
  monthlySalesTarget: number;
}

interface SellerActuals {
  sellerId: string;
  callsToday: number;
  whatsappToday: number;
  callsMonth: number;
  whatsappMonth: number;
  salesMonth: number;
  salesToday: number;
}

interface WorkMonthConfig {
  yearMonth: string;
  workingDays: number;
  operationalStartDate: Date | null;
}

export interface SellerMetricsCalculated {
  sellerId: string;
  sellerName: string;
  currentLevel: string;

  // Metas do dia (padrão por nível)
  metaCallsToday: number;
  metaWhatsappToday: number;
  metaContactsToday: number;

  // Realizados do dia
  actualCallsToday: number;
  actualWhatsappToday: number;
  actualContactsToday: number;
  actualSalesToday: number;

  // Metas do mês
  metaCallsMonth: number;
  metaWhatsappMonth: number;
  metaContactsMonth: number;
  metaSalesMonth: number;

  // Realizados do mês
  actualCallsMonth: number;
  actualWhatsappMonth: number;
  actualContactsMonth: number;
  actualSalesMonth: number;

  // Faltante do mês
  remainingCallsMonth: number;
  remainingWhatsappMonth: number;
  remainingContactsMonth: number;
  remainingSalesMonth: number;

  // Meta dinâmica "necessária por dia restante"
  neededCallsPerDayFromNow: number;
  neededWhatsappPerDayFromNow: number;
  neededContactsPerDayFromNow: number;
  neededSalesPerDayFromNow: number;

  // Dias úteis
  workingDays: number;
  elapsedWorkdays: number;
  remainingWorkdays: number;
}

interface AggregatedMetrics {
  // Realizados do dia (todos)
  actualCallsTodayAll: number;
  actualWhatsappTodayAll: number;
  actualContactsTodayAll: number;
  actualSalesTodayAll: number;

  // Metas do dia (todos - soma por nível)
  metaCallsTodayAll: number;
  metaWhatsappTodayAll: number;
  metaContactsTodayAll: number;

  // Realizados do mês (todos)
  actualCallsMonthAll: number;
  actualWhatsappMonthAll: number;
  actualContactsMonthAll: number;
  actualSalesMonthAll: number;

  // Metas do mês (todos)
  metaCallsMonthAll: number;
  metaWhatsappMonthAll: number;
  metaContactsMonthAll: number;
  metaSalesMonthAll: number;

  // Faltante do mês (todos)
  remainingCallsMonthAll: number;
  remainingWhatsappMonthAll: number;
  remainingContactsMonthAll: number;
  remainingSalesMonthAll: number;
}

export interface WorkingDaysTargetsData {
  workMonthConfig: WorkMonthConfig | null;
  isConfigured: boolean;
  sellerMetrics: Map<string, SellerMetricsCalculated>;
  aggregated: AggregatedMetrics;
  loading: boolean;
  refetch: () => void;
}

function calculateElapsedWorkdays(
  today: Date,
  monthStart: Date,
  operationalStartDate: Date | null
): number {
  const effectiveStart = operationalStartDate && isBefore(monthStart, operationalStartDate)
    ? operationalStartDate
    : monthStart;

  if (isBefore(today, effectiveStart)) return 0;

  const daysInterval = eachDayOfInterval({ start: effectiveStart, end: today });

  // Contar dias úteis (seg-sex) até hoje (inclusive)
  return daysInterval.filter(d => !isWeekend(d)).length;
}

// Use unified metrics service helpers for contact type detection
// isEffectiveCall and isEffectiveWhatsapp are imported from @/lib/metricsService

export function useWorkingDaysTargets(sellerIdFilter?: string | null): WorkingDaysTargetsData {
  const [workMonthConfig, setWorkMonthConfig] = useState<WorkMonthConfig | null>(null);
  const [sellerTargets, setSellerTargets] = useState<SellerTargets[]>([]);
  const [sellerActuals, setSellerActuals] = useState<SellerActuals[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const yearMonth = format(today, 'yyyy-MM');

    const todayKey = saoPauloDayKey(today);
    const { startIso: todayStartIso, endIso: todayEndIso } = saoPauloDayRange(today);

    const monthStart = startOfMonth(today);
    const monthStartKey = saoPauloDayKey(monthStart);
    const { startIso: monthStartIso } = saoPauloDayRange(monthStart);

    try {
      // 1. Buscar configuração do mês
      const { data: configData } = await supabase
        .from('work_month_config')
        .select('*')
        .eq('year_month', yearMonth)
        .maybeSingle();

      if (configData) {
        setWorkMonthConfig({
          yearMonth: configData.year_month,
          workingDays: configData.working_days,
          operationalStartDate: configData.operational_start_date
            ? new Date(configData.operational_start_date)
            : null,
        });
      } else {
        // Fallback: calcular dias úteis automaticamente (seg-sex)
        const monthEnd = endOfMonth(today);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const autoWorkingDays = allDays.filter((d) => !isWeekend(d)).length;

        setWorkMonthConfig({
          yearMonth,
          workingDays: autoWorkingDays,
          operationalStartDate: null,
        });
      }

      // 2. Buscar vendedores
      // IMPORTANT: Meu Dia precisa funcionar para QUALQUER vendedor logado (inclusive admin/gestor)
      // então não filtramos por role aqui.
      // Quando sellerIdFilter é específico, buscar esse vendedor (pode ser inativo para histórico)
      // Quando busca todos, apenas ativos
      let sellersQuery = supabase.from('sellers').select('id, name, role');
      if (sellerIdFilter) {
        sellersQuery = sellersQuery.eq('id', sellerIdFilter);
      } else {
        sellersQuery = sellersQuery.or('status.eq.ATIVO,status.is.null');
      }

      const { data: sellersData } = await sellersQuery;

      const sellerIds = (sellersData || []).map((s: any) => s.id);
      if (sellerIds.length === 0) {
        setSellerTargets([]);
        setSellerActuals([]);
        return;
      }

      // 3. Buscar seller_levels para metas (somente IDs relevantes)
      const levelsQuery = supabase
        .from('seller_levels')
        .select('seller_id, current_level, monthly_sales_target')
        .in('seller_id', sellerIds);

      const { data: levelsData } = await levelsQuery;
      const levelsMap = new Map((levelsData || []).map((l) => [l.seller_id, l]));

      // Criar targets para os vendedores retornados
      // IMPORTANTE: Usar LEVEL_MONTHLY_TARGETS como fonte única de verdade
      // NÃO usar mais daily_calls_per_workday/daily_whatsapp_per_workday do banco
      const targets: SellerTargets[] = (sellersData || []).map((s: any) => {
        const level = levelsMap.get(s.id);
        return {
          sellerId: s.id,
          sellerName: s.name || 'Vendedor',
          currentLevel: (level?.current_level as SellerLevel) || 'ovo',
          monthlySalesTarget: level?.monthly_sales_target || 30000,
        };
      });

      setSellerTargets(targets);

      // 4. Buscar realizados do dia e mês
      let interactionsToday: any[] = [];
      let interactionsMonth: any[] = [];
      let tasksCompletedToday: any[] = [];
      let tasksCompletedMonth: any[] = [];
      let ordersToday: any[] = [];
      let ordersMonth: any[] = [];

      if (sellerIdFilter) {
        // --- Caminho principal (Meu Dia): 1 vendedor, queries PARALELAS ---
        const [
          interactionsTodayRes,
          interactionsMonthRes,
          tasksTodayRes,
          tasksMonthRes,
          ordersTodayRes,
          ordersMonthRes,
        ] = await Promise.all([
          supabase.from('interactions').select('responsible_seller_id, interaction_type').eq('responsible_seller_id', sellerIdFilter).eq('interaction_date', todayKey),
          supabase.from('interactions').select('responsible_seller_id, interaction_type').eq('responsible_seller_id', sellerIdFilter).gte('interaction_date', monthStartKey).lte('interaction_date', todayKey),
          supabase.from('tasks').select('created_by_seller_id, contact_type, completed_at, client:clients!tasks_client_id_fkey(seller_id)').eq('status', 'concluida').gte('completed_at', todayStartIso).lte('completed_at', todayEndIso).eq('client.seller_id', sellerIdFilter),
          supabase.from('tasks').select('created_by_seller_id, contact_type, completed_at, client:clients!tasks_client_id_fkey(seller_id)').eq('status', 'concluida').gte('completed_at', monthStartIso).lte('completed_at', todayEndIso).eq('client.seller_id', sellerIdFilter),
          supabase.from('orders').select('seller_id, total').eq('seller_id', sellerIdFilter).eq('order_date', todayKey),
          supabase.from('orders').select('seller_id, total').eq('seller_id', sellerIdFilter).gte('order_date', monthStartKey).lte('order_date', todayKey),
        ]);
        interactionsToday = interactionsTodayRes.data || [];
        interactionsMonth = interactionsMonthRes.data || [];
        tasksCompletedToday = tasksTodayRes.data || [];
        tasksCompletedMonth = tasksMonthRes.data || [];
        ordersToday = ordersTodayRes.data || [];
        ordersMonth = ordersMonthRes.data || [];
      } else {
        // --- Visão consolidada (sem filtro): queries PARALELAS ---
        const [
          interactionsTodayRes,
          interactionsMonthRes,
          tasksTodayRes,
          tasksMonthRes,
          ordersTodayRes,
          ordersMonthRes,
        ] = await Promise.all([
          supabase.from('interactions').select('responsible_seller_id, interaction_type').in('responsible_seller_id', sellerIds).eq('interaction_date', todayKey),
          supabase.from('interactions').select('responsible_seller_id, interaction_type').in('responsible_seller_id', sellerIds).gte('interaction_date', monthStartKey).lte('interaction_date', todayKey),
          supabase.from('tasks').select('created_by_seller_id, contact_type, completed_at').in('created_by_seller_id', sellerIds).eq('status', 'concluida').gte('completed_at', todayStartIso).lte('completed_at', todayEndIso),
          supabase.from('tasks').select('created_by_seller_id, contact_type, completed_at').in('created_by_seller_id', sellerIds).eq('status', 'concluida').gte('completed_at', monthStartIso).lte('completed_at', todayEndIso),
          supabase.from('orders').select('seller_id, total').in('seller_id', sellerIds).eq('order_date', todayKey),
          supabase.from('orders').select('seller_id, total').in('seller_id', sellerIds).gte('order_date', monthStartKey).lte('order_date', todayKey),
        ]);
        interactionsToday = interactionsTodayRes.data || [];
        interactionsMonth = interactionsMonthRes.data || [];
        tasksCompletedToday = tasksTodayRes.data || [];
        tasksCompletedMonth = tasksMonthRes.data || [];
        ordersToday = ordersTodayRes.data || [];
        ordersMonth = ordersMonthRes.data || [];
      }

      // Calcular actuals por vendedor
      const actuals: SellerActuals[] = sellerIds.map((sid) => {
        // Contagem de INTERAÇÕES efetivas usando unified metrics service
        const countInteractionEffective = (interactions: any[], type: 'call' | 'whatsapp') => {
          return (interactions || [])
            .filter((i) => {
              if (i.responsible_seller_id !== sid) return false;
              if (type === 'call') return isEffectiveCall(i.interaction_type);
              return isEffectiveWhatsapp(i.interaction_type);
            })
            .length;
        };

        // Contagem de TAREFAS concluídas por tipo
        // - se vier com join (client.seller_id), usamos isso
        // - senão (visão consolidada), usa created_by_seller_id
        const countTasksCompleted = (tasks: any[], type: 'call' | 'whatsapp') => {
          return (tasks || [])
            .filter((t) => {
              const taskSellerId = t?.client?.seller_id || t.created_by_seller_id;
              if (taskSellerId !== sid) return false;
              const contactType = t.contact_type || '';
              if (type === 'call') return isEffectiveCall(contactType) || contactType.toLowerCase() === 'ligacao';
              return isEffectiveWhatsapp(contactType) || contactType.toLowerCase() === 'whatsapp';
            })
            .length;
        };

        // Interações do dia
        const interactionCallsToday = countInteractionEffective(interactionsToday, 'call');
        const interactionWhatsappToday = countInteractionEffective(interactionsToday, 'whatsapp');

        // Tarefas concluídas do dia
        const taskCallsToday = countTasksCompleted(tasksCompletedToday, 'call');
        const taskWhatsappToday = countTasksCompleted(tasksCompletedToday, 'whatsapp');

        // TOTAL DO DIA = Interações + Tarefas concluídas
        const callsToday = interactionCallsToday + taskCallsToday;
        const whatsappToday = interactionWhatsappToday + taskWhatsappToday;

        // Interações do mês
        const interactionCallsMonth = countInteractionEffective(interactionsMonth, 'call');
        const interactionWhatsappMonth = countInteractionEffective(interactionsMonth, 'whatsapp');

        // Tarefas concluídas do mês
        const taskCallsMonth = countTasksCompleted(tasksCompletedMonth, 'call');
        const taskWhatsappMonth = countTasksCompleted(tasksCompletedMonth, 'whatsapp');

        // TOTAL DO MÊS = Interações + Tarefas concluídas
        const callsMonth = interactionCallsMonth + taskCallsMonth;
        const whatsappMonth = interactionWhatsappMonth + taskWhatsappMonth;

        const salesToday = (ordersToday || [])
          .filter((o) => o.seller_id === sid)
          .reduce((sum, o) => sum + (o.total || 0), 0);

        const salesMonth = (ordersMonth || [])
          .filter((o) => o.seller_id === sid)
          .reduce((sum, o) => sum + (o.total || 0), 0);

        return {
          sellerId: sid,
          callsToday,
          whatsappToday,
          callsMonth,
          whatsappMonth,
          salesMonth,
          salesToday,
        };
      });

      setSellerActuals(actuals);
    } catch (error) {
      console.error('Error fetching working days targets:', error);
    } finally {
      setLoading(false);
    }
  }, [sellerIdFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Atualização em tempo real (interações / tarefas concluídas / pedidos)
  useEffect(() => {
    const invalidationKey = `working-days-targets-${sellerIdFilter || 'all'}`;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData();
      }, 5000);
    };

    const channel = supabase
      .channel(`scoreboard-rt-${sellerIdFilter || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interactions' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debouncedRefetch)
      .subscribe();

    return () => {
      cancelPendingInvalidation(invalidationKey);
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [sellerIdFilter, fetchData]);
  // Calcular métricas por vendedor
  const sellerMetrics = useMemo(() => {
    const metricsMap = new Map<string, SellerMetricsCalculated>();

    if (!workMonthConfig) return metricsMap;

    const today = new Date();
    const monthStart = startOfMonth(today);
    const { workingDays, operationalStartDate } = workMonthConfig;

    const elapsedWorkdays = calculateElapsedWorkdays(today, monthStart, operationalStartDate);
    const remainingWorkdays = Math.max(1, workingDays - elapsedWorkdays);

    sellerTargets.forEach(target => {
      const actual = sellerActuals.find(a => a.sellerId === target.sellerId);
      if (!actual) return;

      // ==================================================================
      // USAR LEVEL_MONTHLY_TARGETS - FONTE ÚNICA DE VERDADE
      // ==================================================================
      const levelConfig = LEVEL_MONTHLY_TARGETS[target.currentLevel] || LEVEL_MONTHLY_TARGETS.ovo;

      // Metas do MÊS: valor fixo se existir (PENA/ÁGUIA), senão calcular (OVO)
      const metaCallsMonth = levelConfig.callsPerMonth ?? (levelConfig.baseCallsPerDay * workingDays);
      const metaWhatsappMonth = levelConfig.whatsappPerMonth ?? (levelConfig.baseWhatsappPerDay * workingDays);
      const metaContactsMonth = metaCallsMonth + metaWhatsappMonth;
      const metaSalesMonth = target.monthlySalesTarget;

      // Metas do DIA: meta_mes / dias_uteis (arredondado)
      const metaCallsToday = Math.ceil(metaCallsMonth / workingDays);
      const metaWhatsappToday = Math.ceil(metaWhatsappMonth / workingDays);
      const metaContactsToday = metaCallsToday + metaWhatsappToday;

      // Realizados
      const actualCallsMonth = actual.callsMonth;
      const actualWhatsappMonth = actual.whatsappMonth;
      const actualContactsMonth = actualCallsMonth + actualWhatsappMonth;
      const actualSalesMonth = actual.salesMonth;

      // Faltante do mês
      const remainingCallsMonth = Math.max(0, metaCallsMonth - actualCallsMonth);
      const remainingWhatsappMonth = Math.max(0, metaWhatsappMonth - actualWhatsappMonth);
      const remainingContactsMonth = remainingCallsMonth + remainingWhatsappMonth;
      const remainingSalesMonth = Math.max(0, metaSalesMonth - actualSalesMonth);

      // Meta dinâmica TBM "necessária por dia restante"
      const neededCallsPerDayFromNow = Math.ceil(remainingCallsMonth / remainingWorkdays);
      const neededWhatsappPerDayFromNow = Math.ceil(remainingWhatsappMonth / remainingWorkdays);
      const neededContactsPerDayFromNow = neededCallsPerDayFromNow + neededWhatsappPerDayFromNow;
      const neededSalesPerDayFromNow = Math.ceil(remainingSalesMonth / remainingWorkdays);

      metricsMap.set(target.sellerId, {
        sellerId: target.sellerId,
        sellerName: target.sellerName,
        currentLevel: target.currentLevel,

        metaCallsToday,
        metaWhatsappToday,
        metaContactsToday,

        actualCallsToday: actual.callsToday,
        actualWhatsappToday: actual.whatsappToday,
        actualContactsToday: actual.callsToday + actual.whatsappToday,
        actualSalesToday: actual.salesToday,

        metaCallsMonth,
        metaWhatsappMonth,
        metaContactsMonth,
        metaSalesMonth,

        actualCallsMonth,
        actualWhatsappMonth,
        actualContactsMonth,
        actualSalesMonth,

        remainingCallsMonth,
        remainingWhatsappMonth,
        remainingContactsMonth,
        remainingSalesMonth,

        neededCallsPerDayFromNow,
        neededWhatsappPerDayFromNow,
        neededContactsPerDayFromNow,
        neededSalesPerDayFromNow,

        workingDays,
        elapsedWorkdays,
        remainingWorkdays,
      });
    });

    return metricsMap;
  }, [workMonthConfig, sellerTargets, sellerActuals]);

  // Agregar métricas para "Todos"
  const aggregated = useMemo((): AggregatedMetrics => {
    const metrics = Array.from(sellerMetrics.values());

    // Se tiver filtro de vendedor, usar só ele
    const filtered = sellerIdFilter
      ? metrics.filter(m => m.sellerId === sellerIdFilter)
      : metrics;

    return {
      actualCallsTodayAll: filtered.reduce((sum, m) => sum + m.actualCallsToday, 0),
      actualWhatsappTodayAll: filtered.reduce((sum, m) => sum + m.actualWhatsappToday, 0),
      actualContactsTodayAll: filtered.reduce((sum, m) => sum + m.actualContactsToday, 0),
      actualSalesTodayAll: filtered.reduce((sum, m) => sum + m.actualSalesToday, 0),

      metaCallsTodayAll: filtered.reduce((sum, m) => sum + m.metaCallsToday, 0),
      metaWhatsappTodayAll: filtered.reduce((sum, m) => sum + m.metaWhatsappToday, 0),
      metaContactsTodayAll: filtered.reduce((sum, m) => sum + m.metaContactsToday, 0),

      actualCallsMonthAll: filtered.reduce((sum, m) => sum + m.actualCallsMonth, 0),
      actualWhatsappMonthAll: filtered.reduce((sum, m) => sum + m.actualWhatsappMonth, 0),
      actualContactsMonthAll: filtered.reduce((sum, m) => sum + m.actualContactsMonth, 0),
      actualSalesMonthAll: filtered.reduce((sum, m) => sum + m.actualSalesMonth, 0),

      metaCallsMonthAll: filtered.reduce((sum, m) => sum + m.metaCallsMonth, 0),
      metaWhatsappMonthAll: filtered.reduce((sum, m) => sum + m.metaWhatsappMonth, 0),
      metaContactsMonthAll: filtered.reduce((sum, m) => sum + m.metaContactsMonth, 0),
      metaSalesMonthAll: filtered.reduce((sum, m) => sum + m.metaSalesMonth, 0),

      remainingCallsMonthAll: filtered.reduce((sum, m) => sum + m.remainingCallsMonth, 0),
      remainingWhatsappMonthAll: filtered.reduce((sum, m) => sum + m.remainingWhatsappMonth, 0),
      remainingContactsMonthAll: filtered.reduce((sum, m) => sum + m.remainingContactsMonth, 0),
      remainingSalesMonthAll: filtered.reduce((sum, m) => sum + m.remainingSalesMonth, 0),
    };
  }, [sellerMetrics, sellerIdFilter]);

  return {
    workMonthConfig,
    isConfigured: workMonthConfig !== null,
    sellerMetrics,
    aggregated,
    loading,
    refetch: fetchData,
  };
}
