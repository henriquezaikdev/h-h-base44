import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const SNOOZE_KEY = 'critical_blocker_snoozed_until';
const SNOOZE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface CriticalTask {
  id: string;
  clientName: string;
  taskDate: string;
  notes: string | null;
  priority: string;
  clientRankingTier: string | null;
  clientClassification: string | null;
}

// Only block for Top 20, Top 100, or Recorrente clients
const BLOCKING_TIERS = ['top_20', 'top_100'];
const BLOCKING_CLASSIFICATIONS = ['recorrente'];

function isBlockingClient(tier: string | null, classification: string | null): boolean {
  if (tier && BLOCKING_TIERS.includes(tier.toLowerCase())) return true;
  if (classification && BLOCKING_CLASSIFICATIONS.includes(classification.toLowerCase())) return true;
  return false;
}

function isSnoozed(): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

export function useCriticalBlocker() {
  const { seller, isOwner } = useAuth();
  const [criticalTasks, setCriticalTasks] = useState<CriticalTask[]>([]);
  const [snoozed, setSnoozed] = useState(isSnoozed());
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!seller?.id || isOwner) {
      setCriticalTasks([]);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('tasks')
      .select(`
        id, task_date, notes, priority,
        clients!tasks_client_id_fkey(company_name, seller_id, ranking_tier, classification)
      `)
      .eq('status', 'pendente')
      .eq('is_deleted', false)
      .eq('priority', 'alta')
      .lt('task_date', today)
      .order('task_date', { ascending: true }) as any;

    if (data) {
      const myTasks = data
        .filter((t: any) => t.clients?.seller_id === seller.id)
        .filter((t: any) => isBlockingClient(t.clients?.ranking_tier, t.clients?.classification));

      setCriticalTasks(
        myTasks.map((t: any) => ({
          id: t.id,
          clientName: t.clients?.company_name || 'Cliente',
          taskDate: t.task_date,
          notes: t.notes,
          priority: t.priority,
          clientRankingTier: t.clients?.ranking_tier || null,
          clientClassification: t.clients?.classification || null,
        }))
      );
    }
    setLoading(false);
  }, [seller?.id, isOwner]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Check snooze expiry periodically
  useEffect(() => {
    if (!snoozed) return;
    const interval = setInterval(() => {
      if (!isSnoozed()) {
        setSnoozed(false);
      }
    }, 30_000); // check every 30s
    return () => clearInterval(interval);
  }, [snoozed]);

  const snooze = useCallback(() => {
    const until = Date.now() + SNOOZE_DURATION_MS;
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch { /* ignore */ }
    setSnoozed(true);
  }, []);

  return {
    hasCriticalBlock: criticalTasks.length > 0 && !isOwner && !snoozed,
    criticalTasks,
    loading,
    snoozed,
    snooze,
    refetch: fetchTasks,
  };
}
