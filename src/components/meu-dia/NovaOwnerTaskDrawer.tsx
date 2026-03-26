import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose,
} from '@/components/ui/drawer';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { SellerRow } from '@/hooks/useSellersData';

const TASK_CATEGORIES = [
  'Financeiro', 'Comercial', 'Operacional', 'Estoque', 'RH', 'Estratégico', 'Geral',
] as const;

interface NovaOwnerTaskDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sellers: SellerRow[];
  prefillDelegateTo?: string;
}

export function NovaOwnerTaskDrawer({
  open, onOpenChange, sellers, prefillDelegateTo,
}: NovaOwnerTaskDrawerProps) {
  const { seller } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('Geral');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [prioridade, setPrioridade] = useState<'alta' | 'media' | 'baixa'>('media');
  const [delegarPara, setDelegarPara] = useState(prefillDelegateTo || '__none__');
  const [observacoes, setObservacoes] = useState('');

  const reset = () => {
    setTitulo(''); setCategoria('Geral'); setData(format(new Date(), 'yyyy-MM-dd'));
    setPrioridade('media'); setDelegarPara('__none__'); setObservacoes('');
  };

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error('Titulo e obrigatorio'); return; }
    setSaving(true);
    try {
      const uniqueKey = `owner-${seller?.id}-${Date.now()}`;
      const { error } = await supabase.from('tasks').insert([{
        notes: observacoes || null,
        task_date: data,
        task_time: null,
        contact_type: 'ligacao',
        contact_reason: 'RETORNO',
        priority: prioridade,
        status: 'pendente',
        task_category: categoria,
        created_by_seller_id: seller?.id || null,
        assigned_to_seller_id: delegarPara === '__none__' ? null : delegarPara,
        client_id: null,
        planning_notes: titulo,
        unique_key: uniqueKey,
      }]);
      if (error) throw error;
      toast.success('Tarefa criada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao criar tarefa';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="text-base font-semibold text-foreground">Nova Tarefa</DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">Crie uma tarefa e delegue se necessario</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Titulo *</label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Revisar contratos" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Categoria</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Data</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !data && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(new Date(data + 'T12:00:00'), "dd/MM/yyyy") : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[10200]" align="start">
                  <Calendar
                    mode="single"
                    selected={data ? new Date(data + 'T12:00:00') : undefined}
                    onSelect={(d) => d && setData(format(d, 'yyyy-MM-dd'))}
                    locale={ptBR}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Prioridade</label>
            <div className="flex gap-2 mt-1">
              {(['alta', 'media', 'baixa'] as const).map(p => (
                <button key={p} onClick={() => setPrioridade(p)}
                  className={cn(
                    'px-3 py-1.5 rounded text-[11px] font-semibold border transition-colors',
                    prioridade === p && p === 'alta' && 'bg-destructive/10 text-destructive border-destructive/30',
                    prioridade === p && p === 'media' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                    prioridade === p && p === 'baixa' && 'bg-muted text-muted-foreground border-border',
                    prioridade !== p && 'text-muted-foreground border-border bg-transparent',
                  )}>
                  {p === 'alta' ? 'Alta' : p === 'media' ? 'Media' : 'Baixa'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Delegar para</label>
            <Select value={delegarPara} onValueChange={setDelegarPara}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Ninguem (minha tarefa)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguem (minha tarefa)</SelectItem>
                {sellers.filter(s => s.id !== seller?.id).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Observacoes</label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Detalhes..." className="mt-1" rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Tarefa
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
