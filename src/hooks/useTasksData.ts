import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * TaskData — schema real da tabela tasks no banco hh-controle-2.
 * Usa colunas CRM: status_crm, priority_crm, task_date,
 * created_by_seller_id, assigned_to_seller_id, contact_type, etc.
 * Filtro de ativas: is_deleted = false
 */

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
  clientId: string | null;
  clientName: string;
  clientSellerId: string | null;
  contactType: 'ligacao' | 'whatsapp' | null;
  contactReason: ContactReason | null;
  taskDate: string;
  taskTime: string | null;
  notes: string | null;
  status: 'pendente' | 'concluida' | 'cancelada';
  createdAt: string;
  completedAt: string | null;
  createdBySellerId: string | null;
  assignedToSellerId: string | null;
  priority: 'alta' | 'media' | 'baixa' | 'urgente';
  planningProducts: PlanningProduct[] | null;
  planningNotes: string | null;
  temOrcamentoAberto: boolean;
  orcamentoCaCodigo: string | null;
  orcamentoValor: number | null;
  orcamentoAbertoEm: string | null;
  taskSteps: Array<{ label: string; done: boolean; done_at: string | null }> | null;
  taskCategory: string | null;
  operationalError: boolean;
  errorNote: string | null;
  sourceModule: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdByTrigger: boolean;
  managerConfirmedAt: string | null;
  // Campos extras do 2.0
  title: string | null;
  description: string | null;
}

interface FetchOptions {
  clientId?: string;
  sellerId?: string | null;
  role?: string | null;
}

async function fetchTasksData({ clientId, sellerId, role }: FetchOptions): Promise<TaskData[]> {
  const isAdminOrOwner = role === 'owner' || role === 'admin';

  let query = supabase
    .from('tasks')
    .select(`
      id, title, description, client_id,
      status_crm, priority_crm, task_date,
      contact_type, contact_reason,
      notes, planning_notes, planning_products,
      created_by_seller_id, assigned_to_seller_id,
      completed_at, manager_confirmed_at,
      task_category, task_steps, is_deleted,
      tem_orcamento_aberto, orcamento_ca_codigo, orcamento_valor, orcamento_aberto_em,
      operational_error, error_note,
      source_module, related_type, related_id, created_by_trigger,
      created_at,
      clients!tasks_client_id_fkey(id, name, seller_id)
    `)
    .eq('is_deleted', false);

  // Filtro por cliente específico
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  // Owner/admin vê TODAS as tarefas da company (RLS filtra por company_id)
  // Vendedor vê apenas tarefas criadas por ele OU atribuídas a ele
  // Se role não foi passado (undefined/null), NÃO aplica filtro de seller
  // para evitar bug de retornar 0 tarefas enquanto auth carrega
  if (sellerId && !clientId && !isAdminOrOwner && role) {
    query = query.or(`created_by_seller_id.eq.${sellerId},assigned_to_seller_id.eq.${sellerId}`);
  }

  query = query
    .order('task_date', { ascending: true, nullsFirst: false })
    .limit(clientId ? 200 : isAdminOrOwner ? 500 : 300);

  const { data, error } = await query;

  if (error) {
    console.error('[useTasksData] Error:', error.message, error.details);
    throw error;
  }

  console.log(`[useTasksData] Retornou ${(data || []).length} tarefas (role=${role}, sellerId=${sellerId}, clientId=${clientId})`);

  return (data || []).map((t: any) => ({
    id: t.id,
    title: t.title || null,
    description: t.description || null,
    clientId: t.client_id || null,
    clientName: t.clients?.name || '',
    clientSellerId: t.clients?.seller_id ?? null,
    contactType: t.contact_type || null,
    contactReason: t.contact_reason || null,
    taskDate: t.task_date || '',
    taskTime: null,
    notes: t.notes || null,
    status: (t.status_crm as TaskData['status']) || 'pendente',
    createdAt: t.created_at,
    completedAt: t.completed_at || null,
    createdBySellerId: t.created_by_seller_id || null,
    assignedToSellerId: t.assigned_to_seller_id || null,
    priority: (t.priority_crm as TaskData['priority']) || 'media',
    planningProducts: t.planning_products || null,
    planningNotes: t.planning_notes || null,
    temOrcamentoAberto: t.tem_orcamento_aberto || false,
    orcamentoCaCodigo: t.orcamento_ca_codigo || null,
    orcamentoValor: t.orcamento_valor || null,
    orcamentoAbertoEm: t.orcamento_aberto_em || null,
    taskSteps: t.task_steps || null,
    taskCategory: t.task_category || null,
    operationalError: t.operational_error || false,
    errorNote: t.error_note || null,
    sourceModule: t.source_module || null,
    relatedType: t.related_type || null,
    relatedId: t.related_id || null,
    createdByTrigger: t.created_by_trigger || false,
    managerConfirmedAt: t.manager_confirmed_at || null,
  }));
}

export function useTasksData(clientId?: string, sellerId?: string | null, role?: string | null) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['tasks', clientId, sellerId, role],
    queryFn: () => fetchTasksData({ clientId, sellerId, role }),
    enabled: !!sellerId || role === 'owner' || role === 'admin',
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  return { tasks, loading, refetch };
}
