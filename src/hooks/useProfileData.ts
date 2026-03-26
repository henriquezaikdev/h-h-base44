import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * ProfileData — baseado no schema REAL da tabela sellers (BANCO.md)
 * Colunas reais: id, company_id, auth_user_id, name, email, role, department,
 *   avatar_url, active, created_at
 */
export interface ProfileData {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ProfileKPIs {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  seller: 'Vendedor',
  owner: 'Proprietário',
  logistics: 'Logística',
  manager: 'Gerente',
};

export const DEPT_LABELS: Record<string, string> = {
  vendas: 'Vendas',
  financeiro: 'Financeiro',
  logistica: 'Logística',
  compras: 'Compras',
};

export function useProfileData(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [kpis, setKpis] = useState<ProfileKPIs>({ totalTasks: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0 });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Profile from sellers table (real columns only)
      const { data: seller } = await supabase
        .from('sellers')
        .select('id, name, email, role, department, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (seller) setProfile(seller as ProfileData);

      const today = new Date().toISOString().split('T')[0];

      // KPIs from tasks table (schema 2.0: assigned_to_seller_id, status_crm, task_date, is_deleted)
      const { count: totalCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .or(`created_by_seller_id.eq.${userId},assigned_to_seller_id.eq.${userId}`);

      const { count: completedCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status_crm', 'concluida')
        .or(`created_by_seller_id.eq.${userId},assigned_to_seller_id.eq.${userId}`);

      const { count: openCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status_crm', 'pendente')
        .or(`created_by_seller_id.eq.${userId},assigned_to_seller_id.eq.${userId}`);

      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status_crm', 'pendente')
        .lt('task_date', today)
        .or(`created_by_seller_id.eq.${userId},assigned_to_seller_id.eq.${userId}`);

      setKpis({
        totalTasks: totalCount || 0,
        completedTasks: completedCount || 0,
        openTasks: openCount || 0,
        overdueTasks: overdueCount || 0,
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { profile, kpis, loading, refetch: fetchAll };
}
