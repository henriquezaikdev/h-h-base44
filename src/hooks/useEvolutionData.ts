import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isWeekend, subMonths, isBefore, isSameDay
} from 'date-fns';

// ── Public types ───────────────────────────────────────────────────────────────

export interface DailyActivity {
  date: string;
  sales: number;
  tasksCompleted: number;
}

export interface SalesBreakdown {
  total: number;
  orderCount: number;
}

export interface SellerLevelInfo {
  current_level: string;           // 'ovo' | 'pena' | 'aguia'
  monthly_sales_target: number;
  errors_this_month: number;
}

export interface ComissaoCategoria {
  category_key: string;
  realizado: number;
  meta: number;
  margem_media: number;            // 0..1
  bonus_pct: number;               // 0, 0.5 ou 1.0
  comissao_bonus: number;          // R$
}

export interface EvolutionData {
  // ── dados originais ─────────────────────────────────────
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
  previousMonthMet: boolean | null;
  level: null;
  errors: never[];
  stars: null;
  salesByMargin: never[];
  // ── dados de comissão ────────────────────────────────────
  sellerLevel: SellerLevelInfo;
  comissaoBase: number;            // R$ — soma de comissão base de todos os pedidos
  comissaoCategorias: ComissaoCategoria[];
  comissaoTotal: number;           // R$ — comissaoBase + soma de comissao_bonus
  pedidosSemMargem: number;        // pedidos sem cost_at_sale registrado
  aceleracaoAtiva: boolean;        // vendas >= 130% da meta mensal
  // ── dados de performance ─────────────────────────────────
  metaMensal: number;              // seller_levels.monthly_sales_target
  ligacoesMes: number;             // interactions do tipo ligação no período
  whatsappMes: number;             // interactions do tipo whatsapp no período
  metaLigacoes: number;            // meta mensal de ligações pelo nível
  metaWhatsapp: number;            // meta mensal de whatsapp pelo nível
  tbm: number;                     // R$/dia restante para bater a meta (0 = meta atingida)
  loading: boolean;
}

// ── Helpers de comissão ────────────────────────────────────────────────────────

function getCommissionRate(margemReal: number, aceleracaoAtiva: boolean): number {
  if (aceleracaoAtiva) {
    if (margemReal >= 0.30) return 2.0;
    if (margemReal >= 0.15) return 1.0;
    if (margemReal >= 0.005) return 0.5;
    return 0;
  }
  if (margemReal >= 0.45) return 2.0;
  if (margemReal >= 0.35) return 1.3;
  if (margemReal >= 0.20) return 1.0;
  if (margemReal >= 0.005) return 0.5;
  return 0;
}

const CATEGORY_DEFAULTS: Array<{
  key: string;
  meta: number;
  match: (n: string) => boolean;
}> = [
  { key: 'TONERS',      meta: 35000, match: n => n.includes('toner') },
  { key: 'PAPELARIA',   meta: 25000, match: n => n.includes('papelaria') },
  { key: 'MERCADO',     meta: 19000, match: n => n.includes('mercado') },
  { key: 'CARTUCHOS',   meta: 13000, match: n => n.includes('cartucho') || n.includes('tinta') || n.includes('fita') },
  { key: 'INFORMATICA', meta: 15000, match: n => n.includes('inform') || n.includes('ferrag') },
];

function matchCategory(categoryName: string) {
  const lower = categoryName.toLowerCase();
  return CATEGORY_DEFAULTS.find(c => c.match(lower)) ?? null;
}

// ── Helpers de data ────────────────────────────────────────────────────────────

const toBrtDateStr = (isoStr: string): string => {
  const date = new Date(isoStr.replace(' ', 'T'));
  return format(new Date(date.getTime() - 3 * 60 * 60 * 1000), 'yyyy-MM-dd');
};

// ── Core fetch ─────────────────────────────────────────────────────────────────

type OrderRow = { id: string; total: number; created_at: string };

type ItemRow = {
  order_id: string;
  qty: number;
  total: number;
  cost_at_sale: number | null;
  products: { category_id: string | null } | null;
};

async function fetchEvolutionData(
  sellerId: string,
  month: number,
  year: number
): Promise<Omit<EvolutionData, 'loading'>> {
  const now = new Date();
  const refDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(refDate);
  const monthEnd   = endOfMonth(refDate);

  const allDays       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workDays      = allDays.filter(d => !isWeekend(d));
  const workDaysInMonth = workDays.length;
  const isPastMonth   = refDate < startOfMonth(now);
  const workDaysPassed = isPastMonth
    ? workDaysInMonth
    : workDays.filter(d => isBefore(d, now) || isSameDay(d, now)).length;

  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr   = format(monthEnd,   'yyyy-MM-dd');

  // ── 1. Orders do mês (inclui id para join com order_items) ─────────────────
  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, total, created_at')
    .eq('seller_id', sellerId)
    .gte('created_at', monthStartStr + 'T00:00:00')
    .lte('created_at', monthEndStr + 'T23:59:59');

  const orders = (ordersData ?? []) as OrderRow[];
  const currentMonthSales      = orders.reduce((s, o) => s + (o.total || 0), 0);
  const currentMonthOrderCount = orders.length;

  // ── 2. Tasks concluídas no mês ─────────────────────────────────────────────
  const { data: completedTasksData } = await supabase
    .from('tasks')
    .select('completed_at, task_date, contact_type')
    .eq('is_deleted', false)
    .eq('status_crm', 'concluida')
    .gte('task_date', monthStartStr)
    .lte('task_date', monthEndStr)
    .or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);

  const completedTasks = completedTasksData ?? [];
  const currentMonthTasksCompleted = completedTasks.length;
  const currentMonthCalls    = completedTasks.filter((t: any) => t.contact_type === 'ligacao').length;
  const currentMonthWhatsapp = completedTasks.filter((t: any) => t.contact_type === 'whatsapp').length;

  // ── 3. Tasks abertas ───────────────────────────────────────────────────────
  const { count: openCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('status_crm', 'pendente')
    .or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);

  // ── 4. Daily activities ────────────────────────────────────────────────────
  const activityMap = new Map<string, DailyActivity>();
  allDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    activityMap.set(dateStr, { date: dateStr, sales: 0, tasksCompleted: 0 });
  });

  orders.forEach(order => {
    if (!order.created_at) return;
    const dateStr = toBrtDateStr(order.created_at);
    const act = activityMap.get(dateStr);
    if (act) act.sales += order.total || 0;
  });

  completedTasks.forEach((task: any) => {
    const dateSource = task.completed_at || task.task_date;
    if (!dateSource) return;
    const dateStr = task.completed_at ? toBrtDateStr(task.completed_at) : dateSource;
    const act = activityMap.get(dateStr);
    if (act) act.tasksCompleted++;
  });

  const dailyActivities = Array.from(activityMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // ── 5. Previous month sales ────────────────────────────────────────────────
  const prevMonth = subMonths(refDate, 1);
  const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
  const prevEnd   = format(endOfMonth(prevMonth),   'yyyy-MM-dd');

  const { data: prevOrdersData } = await supabase
    .from('orders')
    .select('total')
    .eq('seller_id', sellerId)
    .gte('created_at', prevStart + 'T00:00:00')
    .lte('created_at', prevEnd + 'T23:59:59');

  const previousMonthSales = (prevOrdersData ?? []).reduce((s, o) => s + (o.total || 0), 0);

  // ── 6. Seller level (tabela pode não existir ainda) ────────────────────────
  const DEFAULT_LEVEL: SellerLevelInfo = {
    current_level: 'ovo',
    monthly_sales_target: 30000,
    errors_this_month: 0,
  };
  let sellerLevel: SellerLevelInfo = { ...DEFAULT_LEVEL };

  const { data: levelData, error: levelErr } = await supabase
    .from('seller_levels')
    .select('current_level, monthly_sales_target, errors_this_month')
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (!levelErr && levelData) {
    sellerLevel = {
      current_level:        levelData.current_level        ?? 'ovo',
      monthly_sales_target: levelData.monthly_sales_target ?? 30000,
      errors_this_month:    levelData.errors_this_month    ?? 0,
    };
  }

  // Complementa com seller_errors do mês (tabela pode não existir)
  const { data: errorsData } = await supabase
    .from('seller_errors')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('month', month)
    .eq('year', year);

  if (errorsData) {
    sellerLevel.errors_this_month = errorsData.length;
  }

  // ── 7. Aceleração ──────────────────────────────────────────────────────────
  const aceleracaoAtiva = currentMonthSales >= 1.3 * sellerLevel.monthly_sales_target;

  // ── 7b. Interactions do mês (contatos: ligações e whatsapp) ────────────────
  const LIGACAO_TYPES  = new Set(['Ligação', 'phone_call', 'Ligação (Tentativa)', 'ligacao']);
  const WHATSAPP_TYPES = new Set(['WhatsApp', 'message', 'WhatsApp (Tentativa)', 'whatsapp']);

  const { data: interactionsData } = await supabase
    .from('interactions')
    .select('interaction_type')
    .eq('responsible_seller_id', sellerId)
    .gte('interaction_date', monthStartStr)
    .lte('interaction_date', monthEndStr);

  const ligacoesMes = (interactionsData ?? []).filter(
    (i: { interaction_type: string }) => LIGACAO_TYPES.has(i.interaction_type)
  ).length;
  const whatsappMes = (interactionsData ?? []).filter(
    (i: { interaction_type: string }) => WHATSAPP_TYPES.has(i.interaction_type)
  ).length;

  // Metas de contato por nível
  const nivelAtual    = sellerLevel.current_level;
  const metaLigacoes  = (nivelAtual === 'pena' || nivelAtual === 'aguia') ? 210 : 18 * workDaysInMonth;
  const metaWhatsapp  = (nivelAtual === 'pena' || nivelAtual === 'aguia') ? 336 : 15 * workDaysInMonth;

  // TBM — meta diária restante (R$)
  const metaMensal     = sellerLevel.monthly_sales_target;
  const diasRestantes  = workDaysInMonth - workDaysPassed;
  const tbm = (currentMonthSales >= metaMensal || diasRestantes <= 0)
    ? 0
    : Math.ceil((metaMensal - currentMonthSales) / diasRestantes);

  // ── 8. Comissão base + categorias ─────────────────────────────────────────
  let comissaoBase     = 0;
  let pedidosSemMargem = 0;
  const comissaoCategorias: ComissaoCategoria[] = [];

  const orderIds = orders.map(o => o.id).filter(Boolean);

  if (orderIds.length > 0) {
    const [itemsResult, catsResult] = await Promise.all([
      supabase
        .from('order_items')
        .select('order_id, qty, total, cost_at_sale, products(category_id)')
        .in('order_id', orderIds),
      supabase
        .from('product_categories')
        .select('id, name'),
    ]);

    const items      = (itemsResult.data ?? []) as unknown as ItemRow[];
    const categories = catsResult.data ?? [];

    // Agrupa itens por pedido
    const itemsByOrder = new Map<string, ItemRow[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    // Comissão base: percorre cada pedido
    for (const order of orders) {
      const orderItems = itemsByOrder.get(order.id) ?? [];
      if (orderItems.length === 0) { pedidosSemMargem++; continue; }

      const totalRevenue = orderItems.reduce((s, i) => s + (i.total ?? 0), 0);
      const hasCost      = orderItems.some(i => i.cost_at_sale != null && i.cost_at_sale > 0);
      if (!hasCost) { pedidosSemMargem++; continue; }

      const totalCost = orderItems.reduce((s, i) =>
        s + (i.cost_at_sale != null ? (i.qty ?? 0) * i.cost_at_sale : 0), 0);

      const margemReal = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
      comissaoBase += totalRevenue * (getCommissionRate(margemReal, aceleracaoAtiva) / 100);
    }

    // Acumula por categoria
    type CatAccum = { revenue: number; cost: number; meta: number };
    const catMap = new Map<string, CatAccum>();

    for (const item of items) {
      const catId = item.products?.category_id;
      if (!catId) continue;
      const cat    = categories.find(c => c.id === catId);
      if (!cat) continue;
      const catDef = matchCategory(cat.name);
      if (!catDef) continue;

      const acc = catMap.get(catDef.key) ?? { revenue: 0, cost: 0, meta: catDef.meta };
      acc.revenue += item.total ?? 0;
      if (item.cost_at_sale != null) {
        acc.cost += (item.qty ?? 0) * item.cost_at_sale;
      }
      catMap.set(catDef.key, acc);
    }

    const bonusBlocked = sellerLevel.errors_this_month >= 4;

    for (const [key, acc] of catMap.entries()) {
      const margem_media = acc.revenue > 0 ? (acc.revenue - acc.cost) / acc.revenue : 0;
      let bonus_pct = 0;
      if (!bonusBlocked && acc.revenue >= acc.meta && margem_media >= 0.40) {
        bonus_pct = margem_media >= 0.60 ? 1.0 : 0.5;
      }
      comissaoCategorias.push({
        category_key: key,
        realizado:    acc.revenue,
        meta:         acc.meta,
        margem_media,
        bonus_pct,
        comissao_bonus: acc.revenue * (bonus_pct / 100),
      });
    }

    comissaoCategorias.sort((a, b) => b.realizado - a.realizado);
  }

  const comissaoTotal = comissaoBase
    + comissaoCategorias.reduce((s, c) => s + c.comissao_bonus, 0);

  // ── Retorno ────────────────────────────────────────────────────────────────
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
    previousMonthMet: null,
    level: null,
    errors: [],
    stars: null,
    salesByMargin: [],
    sellerLevel,
    comissaoBase,
    comissaoCategorias,
    comissaoTotal,
    pedidosSemMargem,
    aceleracaoAtiva,
    metaMensal,
    ligacoesMes,
    whatsappMes,
    metaLigacoes,
    metaWhatsapp,
    tbm,
  };
}

// ── Hook público ───────────────────────────────────────────────────────────────

export function useEvolutionData(sellerId: string | null, month?: number, year?: number) {
  const now = new Date();
  const effectiveMonth = month ?? (now.getMonth() + 1);
  const effectiveYear  = year  ?? now.getFullYear();

  const queryKey = useMemo(
    () => ['evolution-data', sellerId, effectiveMonth, effectiveYear] as const,
    [sellerId, effectiveMonth, effectiveYear]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchEvolutionData(sellerId!, effectiveMonth, effectiveYear),
    enabled:   !!sellerId,
    staleTime: 1000 * 60 * 2,
    gcTime:    1000 * 60 * 10,
  });

  const defaultData: EvolutionData = {
    dailyActivities:          [],
    currentMonthSales:        0,
    currentMonthOrderCount:   0,
    currentMonthTasksCompleted: 0,
    currentMonthTasksOpen:    0,
    currentMonthCalls:        0,
    currentMonthWhatsapp:     0,
    workDaysInMonth:          0,
    workDaysPassed:           0,
    previousMonthSales:       0,
    previousMonthMet:         null,
    level:                    null,
    errors:                   [],
    stars:                    null,
    salesByMargin:            [],
    sellerLevel:              { current_level: 'ovo', monthly_sales_target: 30000, errors_this_month: 0 },
    comissaoBase:             0,
    comissaoCategorias:       [],
    comissaoTotal:            0,
    pedidosSemMargem:         0,
    aceleracaoAtiva:          false,
    metaMensal:               30000,
    ligacoesMes:              0,
    whatsappMes:              0,
    metaLigacoes:             0,
    metaWhatsapp:             0,
    tbm:                      0,
    loading:                  query.isLoading,
  };

  return {
    ...(query.data || defaultData),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
