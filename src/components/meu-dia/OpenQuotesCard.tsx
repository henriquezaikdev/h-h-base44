import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import {
  FileText, DollarSign, Clock, ChevronRight, Building2, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface OpenQuoteClient {
  id: string;
  company_name: string;
  orcamento_ca_codigo_atual: string | null;
  orcamento_valor_atual: number | null;
  orcamento_aberto_em_atual: string | null;
  ranking_tier: string | null;
}

interface OpenQuotesCardProps {
  sellerId: string | null;
  onCreateTask?: () => void;
}

export function OpenQuotesCard({ sellerId, onCreateTask }: OpenQuotesCardProps) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<OpenQuoteClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOpenQuotes() {
      setLoading(true);
      try {
        let query = supabase
          .from('clients')
          .select('id, company_name, orcamento_ca_codigo_atual, orcamento_valor_atual, orcamento_aberto_em_atual, ranking_tier')
          .eq('orcamento_em_aberto', true)
          .eq('is_deleted', false)
          .order('orcamento_aberto_em_atual', { ascending: false })
          .limit(20);
        if (sellerId) query = query.eq('orcamento_vendedor_id', sellerId);
        const { data, error } = await query;
        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching open quotes:', error);
        setClients([]);
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

  const totalValue = useMemo(() => clients.reduce((sum, c) => sum + (c.orcamento_valor_atual || 0), 0), [clients]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-hh-sm p-5">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-hh-sm p-5">
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <p className="text-[13px] text-muted-foreground">Nenhum orcamento em acompanhamento</p>
          {onCreateTask && (
            <Button variant="outline" size="sm" onClick={onCreateTask} className="mt-2 text-[11px]">
              <Clock className="h-3 w-3 mr-1" /> Nova Tarefa
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-hh-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Orcamentos em Aberto</span>
          <span className="hh-badge-accent">{clients.length}</span>
        </div>
        <div className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          {formatCurrency(totalValue)}
        </div>
      </div>
      <ScrollArea className="h-[200px] pr-3">
        <div className="space-y-1">
          {clients.map((client) => (
            <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
              className="group p-3 rounded-lg border border-border hover:border-border/80 transition-all cursor-pointer bg-card hover:shadow-hh-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-[13px] truncate text-foreground">{client.company_name}</span>
                    {client.ranking_tier && <span className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground">{client.ranking_tier}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {client.orcamento_ca_codigo_atual && (
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />#{client.orcamento_ca_codigo_atual}</span>
                    )}
                    {client.orcamento_aberto_em_atual && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(client.orcamento_aberto_em_atual), { addSuffix: true, locale: ptBR })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px] text-foreground">{formatCurrency(client.orcamento_valor_atual)}</span>
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {clients.length >= 20 && (
        <div className="mt-3 pt-3 text-center border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => navigate('/orcamentos')} className="text-[11px] text-primary">
            Ver todos os orcamentos
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
