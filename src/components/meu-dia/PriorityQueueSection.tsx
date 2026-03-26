import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target, AlertTriangle, TrendingUp, ShoppingCart, CheckCircle, ExternalLink, MessageSquare, Eye, ChevronDown, ChevronUp, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

// ---------- Types ----------

export interface PriorityQueueItem {
  client_id: string;
  client_name: string;
  ranking_tier: string | null;
  prioridade_nivel: 'maxima' | 'alta' | 'media' | 'baixa';
  motivo_prioridade: string;
  dias_sem_pedido: number | null;
  cliente_em_risco: boolean;
  oportunidade_recompra: boolean;
  has_pending_task: boolean;
  contacted_today: boolean;
  melhor_proxima_acao: string;
}

// ---------- Hook (inline, since useClientPriorityQueue doesn't exist yet) ----------

function useClientPriorityQueue() {
  const { seller } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-priority-queue', seller?.id],
    queryFn: async (): Promise<PriorityQueueItem[]> => {
      if (!seller?.id) return [];

      // Fetch clients with their priority data
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, company_name, ranking_tier, dias_sem_pedido, cliente_em_risco, oportunidade_recompra, prioridade_nivel, motivo_prioridade, melhor_proxima_acao, has_pending_task, contacted_today')
        .eq('seller_id', seller.id)
        .eq('is_deleted', false)
        .not('prioridade_nivel', 'is', null)
        .order('prioridade_score', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching priority queue:', error);
        return [];
      }

      return (clients || []).map((c: Record<string, unknown>) => ({
        client_id: c.id as string,
        client_name: c.company_name as string,
        ranking_tier: c.ranking_tier as string | null,
        prioridade_nivel: (c.prioridade_nivel as PriorityQueueItem['prioridade_nivel']) || 'baixa',
        motivo_prioridade: (c.motivo_prioridade as string) || '',
        dias_sem_pedido: c.dias_sem_pedido as number | null,
        cliente_em_risco: (c.cliente_em_risco as boolean) || false,
        oportunidade_recompra: (c.oportunidade_recompra as boolean) || false,
        has_pending_task: (c.has_pending_task as boolean) || false,
        contacted_today: (c.contacted_today as boolean) || false,
        melhor_proxima_acao: (c.melhor_proxima_acao as string) || 'Entrar em contato',
      }));
    },
    enabled: !!seller?.id,
    staleTime: 5 * 60 * 1000,
  });

  const queue = data || [];
  const topClients = queue.filter(q => q.prioridade_nivel === 'maxima' || q.prioridade_nivel === 'alta');
  const atRisk = queue.filter(q => q.cliente_em_risco);

  return { queue, isLoading, refresh: refetch, topClients, atRisk };
}

// ---------- Filters ----------

type FilterType = 'todos' | 'criticos' | 'recompra' | 'risco' | 'tarefa' | 'sem_contato';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'criticos', label: 'Maxima/Alta' },
  { key: 'recompra', label: 'Recompra' },
  { key: 'risco', label: 'Em risco' },
  { key: 'tarefa', label: 'Com tarefa' },
  { key: 'sem_contato', label: 'Sem contato' },
];

const NIVEL_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  maxima: { label: 'Maxima', cls: 'text-destructive bg-destructive/10', dot: 'bg-destructive' },
  alta: { label: 'Alta', cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10', dot: 'bg-amber-500' },
  media: { label: 'Media', cls: 'text-primary bg-primary/10', dot: 'bg-primary' },
  baixa: { label: 'Baixa', cls: 'text-muted-foreground bg-muted', dot: 'bg-muted-foreground/40' },
};

// ---------- Component ----------

export function PriorityQueueSection() {
  const navigate = useNavigate();
  const { queue, isLoading, refresh, topClients, atRisk } = useClientPriorityQueue();
  const [filter, setFilter] = useState<FilterType>('todos');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let list = queue.filter(q => !dismissed.has(q.client_id));
    switch (filter) {
      case 'criticos': list = list.filter(q => q.prioridade_nivel === 'maxima' || q.prioridade_nivel === 'alta'); break;
      case 'recompra': list = list.filter(q => q.oportunidade_recompra); break;
      case 'risco': list = list.filter(q => q.cliente_em_risco); break;
      case 'tarefa': list = list.filter(q => q.has_pending_task); break;
      case 'sem_contato': list = list.filter(q => !q.contacted_today); break;
    }
    return list;
  }, [queue, filter, dismissed]);

  const displayList = showAll ? filtered : filtered.slice(0, 8);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleDismiss = (clientId: string) => {
    setDismissed(prev => new Set(prev).add(clientId));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              Prioridades de Hoje
              {topClients.length > 0 && (
                <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                  {topClients.length}
                </span>
              )}
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {atRisk.length > 0 ? `${atRisk.length} em risco \u00B7 ` : ''}{queue.length} clientes analisados
            </p>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 text-[11px] gap-1.5 text-muted-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {expanded && (
        <>
          {/* Filters */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Queue list */}
          <div className="space-y-1.5">
            {displayList.map((item) => (
              <PriorityCard
                key={item.client_id}
                item={item}
                onOpen={() => navigate(`/clients/${item.client_id}`)}
                onDismiss={() => handleDismiss(item.client_id)}
              />
            ))}
          </div>

          {filtered.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-center py-2 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showAll ? 'Mostrar menos' : `Ver todos (${filtered.length})`}
            </button>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-[12px] text-muted-foreground py-4">
              Nenhum cliente neste filtro.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Priority Card ----------

function PriorityCard({ item, onOpen, onDismiss }: { item: PriorityQueueItem; onOpen: () => void; onDismiss: () => void }) {
  const nivel = NIVEL_CONFIG[item.prioridade_nivel] || NIVEL_CONFIG.baixa;
  const [_showFeedback, setShowFeedback] = useState(false);
  return (
    <Card
      className={cn(
        "border-border/40 hover:border-border/70 transition-colors cursor-pointer group",
        item.prioridade_nivel === 'maxima' && "border-l-2 border-l-destructive",
        item.prioridade_nivel === 'alta' && "border-l-2 border-l-amber-500",
      )}
      onClick={onOpen}
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Row 1: Name + Priority badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", nivel.dot)} />
              <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                {item.client_name}
              </p>
            </div>
            {item.ranking_tier && (
              <span className="text-[10px] text-muted-foreground/70 ml-3.5 uppercase tracking-wider">
                {item.ranking_tier.replace('top', 'Top ')}
              </span>
            )}
          </div>
          <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0", nivel.cls)}>
            {nivel.label}
          </span>
        </div>

        {/* Row 2: Motivo + Dias */}
        <div className="flex items-center justify-between gap-2 ml-3.5">
          <p className="text-[11px] text-muted-foreground leading-snug truncate flex-1">
            {item.motivo_prioridade}
          </p>
          {item.dias_sem_pedido != null && (
            <span className={cn(
              "text-[10px] font-medium tabular-nums flex-shrink-0",
              item.dias_sem_pedido > 90 ? "text-destructive" : item.dias_sem_pedido > 60 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}>
              {item.dias_sem_pedido}d
            </span>
          )}
        </div>

        {/* Row 3: Status badges */}
        <div className="flex flex-wrap items-center gap-1 ml-3.5">
          {item.cliente_em_risco && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-destructive bg-destructive/8 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="h-2.5 w-2.5" /> Em risco
            </span>
          )}
          {item.oportunidade_recompra && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
              <ShoppingCart className="h-2.5 w-2.5" /> Recompra
            </span>
          )}
          {item.has_pending_task && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              <CheckCircle className="h-2.5 w-2.5" /> Tarefa ativa
            </span>
          )}
          {item.contacted_today && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              <MessageSquare className="h-2.5 w-2.5" /> Contatado
            </span>
          )}
        </div>

        {/* Row 4: Action recommendation + quick actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/20 ml-3.5">
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium min-w-0">
            <TrendingUp className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{item.melhor_proxima_acao}</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); setShowFeedback(prev => !prev); }}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Registrar feedback"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Abrir cliente"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Marcar como visto"
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
