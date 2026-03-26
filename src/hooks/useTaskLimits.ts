import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSellerDepartment } from '@/hooks/useSellerDepartment';
import { supabase } from '@/lib/supabase';
import type { TaskData } from '@/hooks/useTasksData';

const DEFAULT_LIMITS: Record<string, { warn: number; block: number }> = {
  vendedor: { warn: 20, block: 50 },
  financeiro_gestora: { warn: 30, block: 60 },
  logistica: { warn: 15, block: 50 },
  default: { warn: 20, block: 50 },
};

function useTaskLimitsConfig() {
  return useQuery({
    queryKey: ['app_config', 'task_limits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'task_limits')
        .maybeSingle();
      return (data?.value as Record<string, { warn: number; block: number }>) || DEFAULT_LIMITS;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaskLimits(tasks: TaskData[], sellerId: string | null) {
  const { department } = useSellerDepartment();
  const { data: configLimits } = useTaskLimitsConfig();

  return useMemo(() => {
    const pendingCount = tasks.filter(
      (t) => t.status === 'pendente' && !t.completedAt && (sellerId ? (t.clientSellerId === sellerId || t.assignedToSellerId === sellerId || t.createdBySellerId === sellerId) : true)
    ).length;

    const limitsMap = configLimits || DEFAULT_LIMITS;
    const role = department || 'default';
    const limits = limitsMap[role] || limitsMap.default || DEFAULT_LIMITS.default;

    return {
      pendingCount,
      warnLimit: limits.warn,
      blockLimit: limits.block,
      showWarning: pendingCount > limits.warn,
      isBlocked: pendingCount > limits.block,
    };
  }, [tasks, sellerId, department, configLimits]);
}
