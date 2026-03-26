import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { TaskData } from '@/hooks/useTasksData';

/**
 * useTaskLimits — limites de tarefas por departamento.
 * Tabela app_config não existe ainda, usa defaults hardcoded.
 */

const DEFAULT_LIMITS: Record<string, { warn: number; block: number }> = {
  vendedor: { warn: 20, block: 50 },
  financeiro: { warn: 30, block: 60 },
  logistica: { warn: 15, block: 50 },
  default: { warn: 20, block: 50 },
};

export function useTaskLimits(tasks: TaskData[], sellerId: string | null) {
  const { seller } = useAuth();
  const department = seller?.department;

  return useMemo(() => {
    const pendingCount = tasks.filter(
      (t) => t.status === 'pendente' && !t.completedAt && (sellerId ? (t.clientSellerId === sellerId || t.assignedToSellerId === sellerId) : true)
    ).length;

    const role = department || 'default';
    const limits = DEFAULT_LIMITS[role] || DEFAULT_LIMITS.default;

    return {
      pendingCount,
      warnLimit: limits.warn,
      blockLimit: limits.block,
      showWarning: pendingCount > limits.warn,
      isBlocked: pendingCount > limits.block,
    };
  }, [tasks, sellerId, department]);
}
