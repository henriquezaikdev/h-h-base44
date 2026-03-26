import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * TaskData — baseado no schema REAL da tabela tasks (BANCO.md)
 * Colunas reais: id, company_id, title, description, client_id, assigned_to,
 *   priority (baixa|normal|alta|urgente), due_date, done_at, status (open|completed|cancelled),
 *   is_recurring, created_at, updated_at
 */
export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  clientId: string | null;
  clientName: string;
  clientSellerId: string | null;
  assignedTo: string | null;
  assignedToName: string;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  dueDate: string | null;
  doneAt: string | null;
  status: 'open' | 'done' | 'cancelled';
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
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
      id, title, description, client_id, assigned_to,
      priority, due_date, done_at, status, is_recurring,
      created_at, updated_at,
      clients(id, name, seller_id)
    `)
    .neq('status', 'cancelled')
    .not('assigned_to', 'is', null);

  // Filtro por cliente específico
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  // Owner/admin vê TODAS as tarefas da empresa (RLS filtra por company_id)
  // Vendedor vê apenas tarefas atribuídas a ele
  if (sellerId && !clientId && !isAdminOrOwner) {
    query = query.eq('assigned_to', sellerId);
  }

  if (!clientId) {
    query = query
      .order('status', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('due_date', { ascending: true, nullsFirst: false });
  }

  // Owner/admin precisa de mais registros já que vê tudo
  query = query.limit(clientId ? 200 : isAdminOrOwner ? 500 : 300);

  const { data, error } = await query;

  if (error) {
    console.error('[useTasksData] Error:', error.message, error.details);
    throw error;
  }

  console.log(`[useTasksData] Retornou ${(data || []).length} tarefas (role=${role}, sellerId=${sellerId}, clientId=${clientId})`);
  if (data && data.length > 0) {
    console.log('[useTasksData] Amostra raw:', JSON.stringify(data[0], null, 2));
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    title: t.title || '',
    description: t.description || null,
    clientId: t.client_id || null,
    clientName: t.clients?.name || '',
    clientSellerId: t.clients?.seller_id ?? null,
    assignedTo: t.assigned_to || null,
    assignedToName: '',
    priority: (t.priority as TaskData['priority']) || 'normal',
    dueDate: t.due_date || null,
    doneAt: t.done_at || null,
    status: (t.status as TaskData['status']) || 'open',
    isRecurring: t.is_recurring || false,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

export function useTasksData(clientId?: string, sellerId?: string | null, role?: string | null) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['tasks', clientId ?? '__none__', sellerId ?? '__none__', role ?? '__none__'],
    queryFn: () => fetchTasksData({ clientId, sellerId, role }),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  return { tasks, loading, refetch };
}
