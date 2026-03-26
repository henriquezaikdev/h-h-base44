import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays } from 'date-fns';

/**
 * PriorityQueueSection — fila de clientes por prioridade
 * Usa apenas colunas reais de clients (BANCO.md):
 * id, name, seller_id, last_order_at, priority_score, total_orders, total_revenue
 */

interface PriorityClient {
  id: string;
  name: string;
  priority_score: number;
  last_order_at: string | null;
  total_orders: number;
  total_revenue: number;
  days_since_order: number | null;
}

function useClientPriorityQueue() {
  const { seller } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-priority-queue', seller?.id],
    queryFn: async (): Promise<PriorityClient[]> => {
      if (!seller?.id) return [];

      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, last_order_at, priority_score, total_orders, total_revenue')
        .eq('seller_id', seller.id)
        .order('priority_score', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error('[PriorityQueue] Error:', error);
        return [];
      }

      const now = new Date();
      return (clients || []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Sem nome',
        priority_score: c.priority_score || 0,
        last_order_at: c.last_order_at,
        total_orders: c.total_orders || 0,
        total_revenue: c.total_revenue || 0,
        days_since_order: c.last_order_at
          ? differenceInDays(now, new Date(c.last_order_at))
          : null,
      }));
    },
    enabled: !!seller?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { queue: data || [], isLoading, refresh: refetch };
}

export function PriorityQueueSection() {
  const navigate = useNavigate();
  const { queue, isLoading, refresh } = useClientPriorityQueue();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const displayList = useMemo(() => {
    return showAll ? queue : queue.slice(0, 8);
  }, [queue, showAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Calculando prioridades...</span>
        </CardContent>
      </Card>
    );
  }

  if (queue.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              Prioridades de Hoje
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {queue.length} clientes analisados
            </p>
          </div>
        </button>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-7 text-[11px] gap-1.5 text-muted-foreground">
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {expanded && (
        <>
          <div className="space-y-1.5">
            {displayList.map((client) => (
              <Card
                key={client.id}
                className={cn(
                  "border-border/40 hover:border-border/70 transition-colors cursor-pointer group",
                  client.days_since_order !== null && client.days_since_order > 90 && "border-l-2 border-l-destructive",
                  client.days_since_order !== null && client.days_since_order > 60 && client.days_since_order <= 90 && "border-l-2 border-l-amber-500",
                )}
                onClick={() => navigate(`/clientes/${client.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{client.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {client.days_since_order !== null && (
                          <span className={cn(
                            "font-medium",
                            client.days_since_order > 90 ? "text-destructive" : client.days_since_order > 60 ? "text-amber-500" : ""
                          )}>
                            {client.days_since_order}d sem pedido
                          </span>
                        )}
                        {client.total_orders > 0 && (
                          <span>{client.total_orders} pedidos</span>
                        )}
                        {client.total_revenue > 0 && (
                          <span>R$ {client.total_revenue.toLocaleString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {queue.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-center py-2 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showAll ? 'Mostrar menos' : `Ver todos (${queue.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
