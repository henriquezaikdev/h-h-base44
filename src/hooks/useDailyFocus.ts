import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TaskData } from '@/hooks/useTasksData';

export interface FocusItem {
  id: string;
  taskId: string;
  completedAt: string | null;
  xpBonusAwarded: boolean;
}

export function useDailyFocus() {
  const { seller } = useAuth();
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const fetchFocus = useCallback(async () => {
    if (!seller?.id) return;
    const { data } = await supabase
      .from('daily_focus')
      .select('*')
      .eq('seller_id', seller.id)
      .eq('focus_date', today) as any;

    if (data) {
      setFocusItems(
        data.map((d: any) => ({
          id: d.id,
          taskId: d.task_id,
          completedAt: d.completed_at,
          xpBonusAwarded: d.xp_bonus_awarded,
        }))
      );
    }
    setLoading(false);
  }, [seller?.id, today]);

  useEffect(() => {
    fetchFocus();
  }, [fetchFocus]);

  const addFocus = async (taskId: string) => {
    if (!seller?.id || focusItems.length >= 3) return;
    if (focusItems.some((f) => f.taskId === taskId)) return;

    await supabase.from('daily_focus').insert({
      seller_id: seller.id,
      task_id: taskId,
      focus_date: today,
    } as any);

    fetchFocus();
  };

  const removeFocus = async (taskId: string) => {
    if (!seller?.id) return;
    await supabase
      .from('daily_focus')
      .delete()
      .eq('seller_id', seller.id)
      .eq('task_id', taskId)
      .eq('focus_date', today);

    fetchFocus();
  };

  const markCompleted = async (taskId: string) => {
    if (!seller?.id) return;
    await supabase
      .from('daily_focus')
      .update({ completed_at: new Date().toISOString() } as any)
      .eq('seller_id', seller.id)
      .eq('task_id', taskId)
      .eq('focus_date', today);

    fetchFocus();
  };

  // Auto-suggest: 1 alta priority, 1 closest due, 1 oldest
  const suggestFocus = (tasks: TaskData[]): TaskData[] => {
    if (focusItems.length > 0) return [];
    const pending = tasks.filter((t) => t.status === 'pendente');
    if (pending.length === 0) return [];

    const suggestions: TaskData[] = [];
    const used = new Set<string>();

    // 1) Alta priority first
    const alta = pending.find((t) => t.priority === 'alta' && !used.has(t.id));
    if (alta) { suggestions.push(alta); used.add(alta.id); }

    // 2) Closest due date
    const sorted = [...pending].sort(
      (a, b) => new Date(a.taskDate).getTime() - new Date(b.taskDate).getTime()
    );
    const closest = sorted.find((t) => !used.has(t.id));
    if (closest) { suggestions.push(closest); used.add(closest.id); }

    // 3) Oldest open
    const oldest = [...pending]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .find((t) => !used.has(t.id));
    if (oldest) { suggestions.push(oldest); used.add(oldest.id); }

    return suggestions.slice(0, 3);
  };

  return {
    focusItems,
    loading,
    addFocus,
    removeFocus,
    markCompleted,
    suggestFocus,
    focusTaskIds: new Set(focusItems.map((f) => f.taskId)),
    refetch: fetchFocus,
  };
}
