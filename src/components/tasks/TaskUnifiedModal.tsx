import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { TaskData } from '@/hooks/useTasksData';
import type { SellerRow } from '@/hooks/useSellersData';

interface TaskUnifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  task?: TaskData | null;
  sellers?: SellerRow[];
  onCompleted?: () => void;
}

export function TaskUnifiedModal({
  open, onOpenChange, mode, task, sellers = [], onCompleted,
}: TaskUnifiedModalProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(task?.notes || '');
  const [planningNotes, setPlanningNotes] = useState(task?.planningNotes || '');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>(task?.priority || 'media');
  const [assignedTo, setAssignedTo] = useState(task?.assignedToSellerId || '__none__');
  const [status, setStatus] = useState(task?.status || 'pendente');

  const isEdit = mode === 'edit' && task;

  const handleSave = async () => {
    if (!isEdit) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        notes: notes || null,
        planning_notes: planningNotes || null,
        priority,
        assigned_to_seller_id: assignedTo === '__none__' ? null : assignedTo,
        status,
      };
      if (status === 'concluida' && task.status !== 'concluida') {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (error) throw error;
      toast.success('Tarefa atualizada');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onCompleted?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao atualizar tarefa';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {isEdit
              ? `${task.clientName || task.planningNotes || 'Tarefa Geral'} - ${format(new Date(task.taskDate), 'dd/MM/yyyy', { locale: ptBR })}`
              : 'Preencha os dados da tarefa'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isEdit && task.clientName && (
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Cliente</label>
              <p className="text-sm text-foreground mt-1">{task.clientName}</p>
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Titulo / Planejamento</label>
            <Input value={planningNotes} onChange={e => setPlanningNotes(e.target.value)} placeholder="Notas de planejamento..." className="mt-1" />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Observacoes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observacoes..." className="mt-1" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'alta' | 'media' | 'baixa')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'pendente' | 'concluida')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluida">Concluida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {sellers.length > 0 && (
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Atribuida a</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Ninguem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ninguem</SelectItem>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isEdit && (
            <div className="flex gap-2 text-[11px] text-muted-foreground">
              {task.taskCategory && <span className="bg-muted px-2 py-0.5 rounded text-[10px]">{task.taskCategory}</span>}
              {task.contactType && <span className="bg-muted px-2 py-0.5 rounded text-[10px]">{task.contactType}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
