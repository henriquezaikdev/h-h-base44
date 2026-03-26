import { useState, useCallback } from 'react';
import type { TaskData } from '@/hooks/useTasksData';
import { useAuth } from '@/hooks/useAuth';

/**
 * useDailyFocus — foco diário do vendedor.
 * Tabela daily_focus ainda não existe no banco.
 * Usa localStorage como fallback até a tabela ser criada.
 */

export interface FocusItem {
  id: string;
  taskId: string;
  completedAt: string | null;
  xpBonusAwarded: boolean;
}

function getStorageKey(sellerId: string) {
  const today = new Date().toISOString().split('T')[0];
  return `hh_daily_focus_${sellerId}_${today}`;
}

function loadFromStorage(sellerId: string): FocusItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(sellerId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(sellerId: string, items: FocusItem[]) {
  localStorage.setItem(getStorageKey(sellerId), JSON.stringify(items));
}

export function useDailyFocus() {
  const { seller } = useAuth();
  const [focusItems, setFocusItems] = useState<FocusItem[]>(() =>
    seller?.id ? loadFromStorage(seller.id) : []
  );

  const persist = useCallback((items: FocusItem[]) => {
    setFocusItems(items);
    if (seller?.id) saveToStorage(seller.id, items);
  }, [seller?.id]);

  const addFocus = useCallback((taskId: string) => {
    if (focusItems.length >= 3) return;
    if (focusItems.some(f => f.taskId === taskId)) return;
    const item: FocusItem = {
      id: crypto.randomUUID(),
      taskId,
      completedAt: null,
      xpBonusAwarded: false,
    };
    persist([...focusItems, item]);
  }, [focusItems, persist]);

  const removeFocus = useCallback((taskId: string) => {
    persist(focusItems.filter(f => f.taskId !== taskId));
  }, [focusItems, persist]);

  const markCompleted = useCallback((taskId: string) => {
    persist(focusItems.map(f =>
      f.taskId === taskId ? { ...f, completedAt: new Date().toISOString() } : f
    ));
  }, [focusItems, persist]);

  const suggestFocus = (tasks: TaskData[]): TaskData[] => {
    if (focusItems.length > 0) return [];
    const pending = tasks.filter(t => t.status === 'open');
    if (pending.length === 0) return [];

    const suggestions: TaskData[] = [];
    const used = new Set<string>();

    const alta = pending.find(t => t.priority === 'alta' && !used.has(t.id));
    if (alta) { suggestions.push(alta); used.add(alta.id); }

    const sorted = [...pending].sort(
      (a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime()
    );
    const closest = sorted.find(t => !used.has(t.id));
    if (closest) { suggestions.push(closest); used.add(closest.id); }

    const oldest = [...pending]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .find(t => !used.has(t.id));
    if (oldest) { suggestions.push(oldest); used.add(oldest.id); }

    return suggestions.slice(0, 3);
  };

  return {
    focusItems,
    loading: false,
    addFocus,
    removeFocus,
    markCompleted,
    suggestFocus,
    focusTaskIds: new Set(focusItems.map(f => f.taskId)),
    refetch: () => { /* no-op with localStorage */ },
  };
}
