import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAllPaginated } from '@/lib/paginatedQuery';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subMonths, isBefore, isAfter, isSameDay } from 'date-fns';
import { isEffectiveCall, isEffectiveWhatsapp } from '@/lib/metricsService';

export interface SellerLevel {
  id: string;
  seller_id: string;
  current_level: 'ovo' | 'pena' | 'aguia';
  monthly_sales_target: number;
  daily_calls_target: number;
  consecutive_months_met: number;
  consecutive_months_missed: number;
  commission_bonus: number;
  errors_this_month: number;
}

export interface SellerError {
  id: string;
  seller_id: string;
  error_type: string;
  description: string | null;
  error_date: string;
  month: number;
  year: number;
  created_at: string;
}

export interface DailyActivity {
  date: string;
  calls: number;
  whatsapp: number;
  total: number;
}

export interface SalesBreakdown {
  margin: number; // margem_real como decimal (0.XX)
  revenue: number;
}

export interface SellerStars {
  id: string;
  seller_id: string;
  bronze_stars: number;
  silver_stars: number;
  gold_stars: number;
  current_streak: number;
  last_streak_date: string | null;
}

export interface EvolutionData {
  level: SellerLevel | null;
  errors: SellerError[];
  dailyActivities: DailyActivity[];
  salesByMargin: SalesBreakdown[];
  currentMonthSales: number;
  currentMonthCalls: number;
  currentMonthWhatsapp: number;
  workDaysInMonth: number;
  workDaysPassed: number;
  previousMonthMet: boolean | null;
  stars: SellerStars | null;
  loading: boolean;
}

async function fetchEvolutionData(sellerId: string, month: number, year: number): Promise<Omit<EvolutionData, 'loading'>> {
  const now = new Date();
  const refDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const currentMonth = month;
  const currentYear = year;
  const yearMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Buscar configuração de dias úteis do mês na tabela work_month_config
  const { data: workMonthConfig } = await supabase
    .from('work_month_config')
    .select('working_days, operational_start_date')
    .eq('year_month', yearMonthKey)
    .maybeSingle();

  // Calcular dias úteis: usar config se existir, senão calcular automaticamente
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const calculatedWorkDays = allDays.filter(d => !isWeekend(d));

  // Dias úteis totais do mês - priorizar configuração
  const workDaysInMonth = workMonthConfig?.working_days || calculatedWorkDays.length;

  // Dias úteis passados considerando data de início operacional
  // Se for mês passado, todos os dias úteis já passaram
  const isPastMonth = refDate < startOfMonth(now);
  let workDaysPassed: number;

  if (isPastMonth) {
    workDaysPassed = workDaysInMonth;
  } else if (workMonthConfig?.operational_start_date) {
    const startDate = new Date(workMonthConfig.operational_start_date);
    const operationalDays = calculatedWorkDays.filter(d =>
      (isAfter(d, startDate) || isSameDay(d, startDate)) && (isBefore(d, now) || isSameDay(d, now))
    );
    workDaysPassed = operationalDays.length;
  } else {
    workDaysPassed = calculatedWorkDays.filter(d => isBefore(d, now) || isSameDay(d, now)).length;
  }

  // Fetch seller level
  const { data: levelData } = await supabase
    .from('seller_levels')
    .select('*')
    .eq('seller_id', sellerId)
    .maybeSingle();

  // Fetch errors for current month
  const { data: errorsData } = await supabase
    .from('seller_errors')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .order('error_date', { ascending: false });

  // Fetch interactions for the month (com paginação para crescimento)
  const interactionsData = await fetchAllPaginated<{ interaction_date: string; interaction_type: string }>(() =>
    supabase
      .from('interactions')
      .select('interaction_date, interaction_type')
      .eq('responsible_seller_id', sellerId)
      .gte('interaction_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('interaction_date', format(monthEnd, 'yyyy-MM-dd'))
  );

  // ==================================================================
  // UNIFICAÇÃO: Buscar TAREFAS CONCLUÍDAS do mês (igual ao Meu Dia)
  // ==================================================================
  const tasksData = await fetchAllPaginated<{ contact_type: string; completed_at: string; created_by_seller_id: string; client: { seller_id: string } | null }>(() =>
    supabase
      .from('tasks')
      .select('contact_type, completed_at, created_by_seller_id, client:clients!tasks_client_id_fkey(seller_id)')
      .eq('status', 'concluida')
      .gte('completed_at', format(monthStart, 'yyyy-MM-dd') + 'T00:00:00-03:00')
      .lte('completed_at', format(monthEnd, 'yyyy-MM-dd') + 'T23:59:59-03:00')
  );

  // Filtrar tarefas do vendedor (dono do cliente OU criador da tarefa)
  const sellerTasks = tasksData.filter(t =>
    (t as any).client?.seller_id === sellerId || t.created_by_seller_id === sellerId
  );

  // Process daily activities
  const activityMap = new Map<string, DailyActivity>();
  calculatedWorkDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    activityMap.set(dateStr, { date: dateStr, calls: 0, whatsapp: 0, total: 0 });
  });

  // Contar INTERAÇÕES
  interactionsData.forEach(int => {
    const dateStr = int.interaction_date;
    const activity = activityMap.get(dateStr);
    if (activity) {
      const type = int.interaction_type || '';
      if (isEffectiveCall(type)) {
        activity.calls++;
        activity.total++;
      } else if (isEffectiveWhatsapp(type)) {
        activity.whatsapp++;
        activity.total++;
      }
    }
  });

  // Contar TAREFAS CONCLUÍDAS (unificação com Meu Dia)
  sellerTasks.forEach(task => {
    // Extrair data da tarefa concluída
    if (!task.completed_at) return;
    const completedDate = new Date(task.completed_at);
    const dateStr = format(completedDate, 'yyyy-MM-dd');
    const activity = activityMap.get(dateStr);
    if (activity) {
      const contactType = (task.contact_type || '').toLowerCase();
      if (isEffectiveCall(contactType) || contactType === 'ligacao') {
        activity.calls++;
        activity.total++;
      } else if (isEffectiveWhatsapp(contactType) || contactType === 'whatsapp') {
        activity.whatsapp++;
        activity.total++;
      }
    }
  });

  const dailyActivities = Array.from(activityMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const totalCalls = dailyActivities.reduce((sum, d) => sum + d.calls, 0);
  const totalWhatsapp = dailyActivities.reduce((sum, d) => sum + d.whatsapp, 0);

  // Fetch orders for the month with margem_real (CMV Real)
  const ordersData = await fetchAllPaginated<{ total: number; margem_real: number | null; profit_margin: number | null }>(() =>
    supabase
      .from('orders')
      .select('total, margem_real, profit_margin')
      .eq('seller_id', sellerId)
      .eq('is_accountable', true)
      .gte('order_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('order_date', format(monthEnd, 'yyyy-MM-dd'))
  );

  const currentMonthSales = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);

  // Group sales by margin bands usando MARGEM REAL (decimal 0.XX convertido para %)
  // Faixas corrigidas:
  // - >=45% → 2.0%
  // - 35-44.99% → 1.3%
  // - 20-34.99% → 1.0%
  // - 0.5-19.99% → 0.5%
  // - <0.5% → 0%
  const marginBands = [
    { min: 0.45, max: Infinity, revenue: 0 },    // Premium: >=45% → 2.0%
    { min: 0.35, max: 0.4499, revenue: 0 },      // Alta: 35-44.99% → 1.3%
    { min: 0.20, max: 0.3499, revenue: 0 },      // Média: 20-34.99% → 1.0%
    { min: 0.005, max: 0.1999, revenue: 0 },     // Baixa: 0.5-19.99% → 0.5%
    { min: -Infinity, max: 0.0049, revenue: 0 }   // Sem comissão: <0.5%
  ];

  ordersData.forEach(order => {
    // Usar margem_real (decimal) como fonte primária
    let margin = order.margem_real;

    // Fallback para profit_margin (%) se margem_real não existir
    if (margin === null || margin === undefined) {
      margin = (order.profit_margin || 0) / 100;
    }

    // Proteção contra -Infinity, NaN
    if (!isFinite(margin)) margin = 0;

    const band = marginBands.find(b => margin! >= b.min && margin! <= b.max);
    if (band) {
      band.revenue += order.total || 0;
    }
  });

  // Retornar margem como decimal (formato esperado pela CommissionCalculator atualizada)
  const salesByMargin = marginBands
    .filter(b => b.revenue > 0)
    .map(b => ({ margin: b.min, revenue: b.revenue }));

  // Check previous month performance
  const prevMonth = subMonths(now, 1);
  const prevMonthStart = startOfMonth(prevMonth);
  const prevMonthEnd = endOfMonth(prevMonth);

  const { data: prevOrdersData } = await supabase
    .from('orders')
    .select('total')
    .eq('seller_id', sellerId)
    .eq('is_accountable', true)
    .gte('order_date', format(prevMonthStart, 'yyyy-MM-dd'))
    .lte('order_date', format(prevMonthEnd, 'yyyy-MM-dd'));

  const prevMonthSales = prevOrdersData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
  const target = levelData?.monthly_sales_target || 30000;
  const previousMonthMet = prevMonthSales >= target;

  // Fetch seller stars
  const { data: starsData } = await supabase
    .from('seller_stars')
    .select('*')
    .eq('seller_id', sellerId)
    .maybeSingle();

  return {
    level: levelData as SellerLevel | null,
    errors: (errorsData || []) as SellerError[],
    dailyActivities,
    salesByMargin,
    currentMonthSales,
    currentMonthCalls: totalCalls,
    currentMonthWhatsapp: totalWhatsapp,
    workDaysInMonth,
    workDaysPassed,
    previousMonthMet,
    stars: starsData as SellerStars | null,
  };
}

export function useEvolutionData(sellerId: string | null, month?: number, year?: number) {
  const now = new Date();
  const effectiveMonth = month ?? (now.getMonth() + 1);
  const effectiveYear = year ?? now.getFullYear();

  // Stable query key - changes when sellerId, month or year changes
  const queryKey = useMemo(() => ['evolution-data', sellerId, effectiveMonth, effectiveYear] as const, [sellerId, effectiveMonth, effectiveYear]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchEvolutionData(sellerId!, effectiveMonth, effectiveYear),
    enabled: !!sellerId,
    staleTime: 1000 * 60 * 2, // 2 minutes - dados ficam frescos por menos tempo
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnWindowFocus: true, // Atualiza quando usuário volta à aba
    refetchOnReconnect: true, // Atualiza quando reconecta internet
    refetchOnMount: 'always', // Sempre atualiza ao montar componente
  });

  const defaultData: EvolutionData = {
    level: null,
    errors: [],
    dailyActivities: [],
    salesByMargin: [],
    currentMonthSales: 0,
    currentMonthCalls: 0,
    currentMonthWhatsapp: 0,
    workDaysInMonth: 0,
    workDaysPassed: 0,
    previousMonthMet: null,
    stars: null,
    loading: query.isLoading,
  };

  return {
    ...(query.data || defaultData),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
