import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ContactReason = 'RETORNO' | 'ACOMPANHAMENTO' | 'VENDA' | 'POS_VENDA';

export const CONTACT_REASON_OPTIONS: { value: ContactReason; label: string; color: string }[] = [
  { value: 'RETORNO', label: 'Retorno', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { value: 'ACOMPANHAMENTO', label: 'Acompanhamento', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  { value: 'VENDA', label: 'Venda', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  { value: 'POS_VENDA', label: 'Pos-venda', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
];

export interface PlanningProduct {
  name: string;
  price: string;
  deadline: string;
  product_id?: string;
  isManual?: boolean;
}

export interface TaskData {
  id: string;
  clientId: string;
  clientName: string;
  clientRankingTier: string;
  clientSellerId: string | null;
  contactType: 'ligacao' | 'whatsapp';
  contactReason: ContactReason;
  taskDate: string;
  taskTime: string | null;
  notes: string | null;
  status: 'pendente' | 'concluida';
  managerConfirmedAt?: string | null;
  createdAt: string;
  completedAt: string | null;
  createdBySellerId: string | null;
  assignedToSellerId?: string | null;
  priority: 'alta' | 'media' | 'baixa';
  planningProducts?: PlanningProduct[];
  planningNotes?: string;
  temOrcamentoAberto: boolean;
  orcamentoCaCodigo: string | null;
  orcamentoValor: number | null;
  orcamentoAbertoEm: string | null;
  taskSteps?: Array<{ label: string; done: boolean; done_at: string | null }>;
  taskCategory?: string;
  operationalError?: boolean;
  errorNote?: string | null;
  sourceModule?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  createdByTrigger?: boolean;
}

async function fetchTasksData(clientId?: string, sellerId?: string | null): Promise<TaskData[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      contact_reason,
      clients!tasks_client_id_fkey(
        id,
        company_name,
        ranking_tier,
        seller_id
      )
    `)
    .eq('is_deleted', false);

  if (!clientId) {
    // Fetch pending tasks + completed delegated tasks awaiting manager confirmation
    if (sellerId) {
      query = query.or(
        `and(status.eq.pendente,or(created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId})),` +
        `and(status.eq.concluida,manager_confirmed_at.is.null,created_by_seller_id.eq.${sellerId},assigned_to_seller_id.neq.${sellerId})`
      );
    } else {
      query = query.eq('status', 'pendente');
    }
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  // Remove the old sellerId filter since it's now embedded in the status OR above
  // (only apply if clientId is set — for client-specific views)
  if (sellerId && clientId) {
    query = query.or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);
  }

  // For seller feed, prioritize pending tasks first to avoid old completed items consuming the limit.
  if (!clientId && sellerId) {
    query = query
      .order('status', { ascending: false })
      .order('task_date', { ascending: true });
  } else {
    query = query.order('task_date', { ascending: true });
  }

  // Hard limit to prevent memory issues
  query = query.limit(clientId ? 200 : sellerId ? 300 : 50);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }

  const allData = data || [];

  return allData.map((t: any) => ({
    id: t.id,
    clientId: t.client_id,
    clientName: t.clients?.company_name || '',
    clientRankingTier: t.clients?.ranking_tier || 'eventual',
    clientSellerId: t.clients?.seller_id ?? null,
    contactType: t.contact_type as 'ligacao' | 'whatsapp',
    contactReason: (t.contact_reason as ContactReason) || 'RETORNO',
    taskDate: t.task_date,
    taskTime: t.task_time,
    notes: t.notes,
    status: t.status as 'pendente' | 'concluida',
    createdAt: t.created_at,
    completedAt: t.completed_at,
    createdBySellerId: t.created_by_seller_id,
    assignedToSellerId: t.assigned_to_seller_id || null,
    priority: (t.priority as 'alta' | 'media' | 'baixa') || 'media',
    planningProducts: (t.planning_products as PlanningProduct[]) || [],
    planningNotes: (t.planning_notes as string) || '',
    temOrcamentoAberto: t.tem_orcamento_aberto || false,
    orcamentoCaCodigo: t.orcamento_ca_codigo || null,
    orcamentoValor: t.orcamento_valor || null,
    orcamentoAbertoEm: t.orcamento_aberto_em || null,
    taskSteps: (t.task_steps as any[]) || [],
    taskCategory: t.task_category || '',
    operationalError: t.operational_error || false,
    errorNote: t.error_note || null,
    sourceModule: t.source_module || null,
    relatedType: t.related_type || null,
    relatedId: t.related_id || null,
    createdByTrigger: t.created_by_trigger || false,
    managerConfirmedAt: t.manager_confirmed_at || null,
  }));
}

export function useTasksData(clientId?: string, sellerId?: string | null) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['tasks', clientId ?? '__none__', sellerId ?? '__none__'],
    queryFn: () => fetchTasksData(clientId, sellerId),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', clientId ?? '__none__', sellerId ?? '__none__'] });
  };

  return { tasks, loading, refetch };
}
