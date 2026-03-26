import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { subDays } from 'date-fns';

export interface ProfileData {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  avatar_url: string | null;
  bio: string | null;
  xp_total: number;
  xp_spent: number;
  level: number;
  score_current: number;
  last_login_at: string | null;
  status: string;
}

export interface ProfileKPIs {
  completedCount: number;
  onTimePercent: number;
  overdueOpen: number;
  criticalOpen: number;
}

export interface StarsInfo {
  bronze_stars: number;
  silver_stars: number;
  gold_stars: number;
  current_streak: number;
}

export interface ActivityItem {
  id: string;
  action_type: string;
  entity_id: string | null;
  meta_json: any;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  owner: 'Proprietário',
  comprador: 'Comprador',
  financeiro_gestora: 'Financeiro / Gestora',
  logistica: 'Logística',
};

const DEPT_LABELS: Record<string, string> = {
  vendas: 'Vendas',
  financeiro_gestora: 'Financeiro / Gestão',
  logistica: 'Logística',
  compras: 'Compras',
};

export { ROLE_LABELS, DEPT_LABELS };

export function useProfileData(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [kpis, setKpis] = useState<ProfileKPIs>({ completedCount: 0, onTimePercent: 0, overdueOpen: 0, criticalOpen: 0 });
  const [stars, setStars] = useState<StarsInfo | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Profile
      const { data: seller } = await supabase
        .from('sellers')
        .select('id, name, email, role, department, avatar_url, bio, xp_total, xp_spent, level, score_current, last_login_at, status')
        .eq('id', userId)
        .maybeSingle();
      if (seller) setProfile(seller as unknown as ProfileData);

      // KPIs (30 days)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('id, completed_at, task_date')
        .eq('created_by_seller_id', userId)
        .eq('status', 'concluida')
        .gte('completed_at', thirtyDaysAgo);

      const completed = completedTasks || [];
      const onTime = completed.filter(t => {
        if (!t.completed_at || !t.task_date) return false;
        return t.completed_at.split('T')[0] <= t.task_date;
      });

      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_seller_id', userId)
        .neq('status', 'concluida')
        .neq('status', 'cancelada')
        .is('archived_at', null)
        .lt('task_date', today);

      const { count: criticalCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_seller_id', userId)
        .neq('status', 'concluida')
        .neq('status', 'cancelada')
        .is('archived_at', null)
        .eq('priority', 'alta');

      setKpis({
        completedCount: completed.length,
        onTimePercent: completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0,
        overdueOpen: overdueCount || 0,
        criticalOpen: criticalCount || 0,
      });

      // Stars
      const { data: starsData } = await supabase
        .from('seller_stars')
        .select('bronze_stars, silver_stars, gold_stars, current_streak')
        .eq('seller_id', userId)
        .maybeSingle();
      if (starsData) setStars(starsData as StarsInfo);

      // Activity log
      const { data: activityData } = await supabase
        .from('task_activity_log')
        .select('id, action_type, entity_id, meta_json, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15);
      setActivities((activityData || []) as ActivityItem[]);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { profile, kpis, stars, activities, loading, refetch: fetchAll };
}
