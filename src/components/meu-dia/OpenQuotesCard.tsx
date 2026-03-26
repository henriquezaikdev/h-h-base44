import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import {
  DollarSign, Clock, ChevronRight, Building2, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * OpenQuotesCard — mostra orçamentos em aberto (tabela quotes, status=pending)
 * JOIN com clients para nome do cliente.
 * Colunas reais usadas: quotes(id, client_id, total, status, created_at), clients(name)
 */

interface OpenQuote {
  id: string;
  total: number | null;
  created_at: string;
  client_name: string;
}

interface OpenQuotesCardProps {
  sellerId: string | null;
  onCreateTask?: () => void;
}

export function OpenQuotesCard({ sellerId }: OpenQuotesCardProps) {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<OpenQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOpenQuotes() {
      setLoading(true);
      try {
        let query = supabase
          .from('quotes')
          .select('id, total, created_at, clients(name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20);

        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }

        const { data, error } = await query;
        if (error) throw error;

        setQuotes(
          (data || []).map((q: any) => ({
            id: q.id,
            total: q.total,
            created_at: q.created_at,
            client_name: q.clients?.name || 'Cliente',
          }))
        );
      } catch (error) {
        console.error('[OpenQuotesCard] Error:', error);
        setQuotes([]);
      } finally {
        setLoading(false);
      }
    }
    fetchOpenQuotes();
  }, [sellerId]);

  const formatCurrency = (value: number | null) => {
    if (!value) return '\u2014';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalValue = useMemo(() => quotes.reduce((sum, q) => sum + (q.total || 0), 0), [quotes]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <p className="text-[13px] text-muted-foreground">Nenhum orcamento em aberto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{quotes.length}</span>
        </div>
        <div className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          {formatCurrency(totalValue)}
        </div>
      </div>
      <ScrollArea className="h-[200px] pr-3">
        <div className="space-y-1">
          {quotes.map((quote) => (
            <div key={quote.id} onClick={() => navigate(`/pedidos`)}
              className="group p-3 rounded-lg border border-border hover:border-border/80 transition-all cursor-pointer bg-card hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-[13px] truncate text-foreground">{quote.client_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px] text-foreground">{formatCurrency(quote.total)}</span>
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
