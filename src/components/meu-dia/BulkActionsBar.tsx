import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, RotateCcw, CalendarPlus, Flag, X, Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { format, addDays } from 'date-fns';

interface BulkActionsBarProps {
  selectedCount: number;
  selectedTaskIds: Set<string>;
  onClearSelection: () => void;
  onActionComplete: () => void;
  sellerId: string;
}

type BulkAction = 'complete' | 'reschedule' | 'priority' | 'followup';
type Priority = 'alta' | 'media' | 'baixa';

export function BulkActionsBar({
  selectedCount,
  selectedTaskIds,
  onClearSelection,
  onActionComplete,
  sellerId,
}: BulkActionsBarProps) {
  const [confirmModal, setConfirmModal] = useState<BulkAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [newPriority, setNewPriority] = useState<Priority>('media');

  const handleBulkComplete = async () => {
    setLoading(true);
    try {
      const taskIds = Array.from(selectedTaskIds);

      const { error: tasksError } = await supabase
        .from('tasks')
        .update({
          status: 'concluida',
          completed_at: new Date().toISOString()
        })
        .in('id', taskIds);

      if (tasksError) throw tasksError;

      console.log('[BulkAction] Completed tasks:', {
        action: 'bulk_complete',
        task_count: taskIds.length,
        performed_by: sellerId,
        task_ids: taskIds,
      });

      toast.success(`${taskIds.length} tarefas concluidas`);
      onClearSelection();
      onActionComplete();
      setConfirmModal(null);
    } catch (error) {
      console.error('Error completing tasks:', error);
      toast.error('Erro ao concluir tarefas');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReschedule = async () => {
    setLoading(true);
    try {
      const taskIds = Array.from(selectedTaskIds);

      const { error } = await supabase
        .from('tasks')
        .update({
          task_date: rescheduleDate,
          updated_at: new Date().toISOString(),
        })
        .in('id', taskIds);

      if (error) throw error;

      console.log('[BulkAction] Rescheduled tasks:', {
        action: 'bulk_reschedule',
        task_count: taskIds.length,
        performed_by: sellerId,
        task_ids: taskIds,
        new_date: rescheduleDate,
      });

      toast.success(`${taskIds.length} tarefas reagendadas para ${format(new Date(rescheduleDate), 'dd/MM/yyyy')}`);
      onClearSelection();
      onActionComplete();
      setConfirmModal(null);
    } catch (error) {
      console.error('Error rescheduling tasks:', error);
      toast.error('Erro ao reagendar tarefas');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPriority = async () => {
    setLoading(true);
    try {
      const taskIds = Array.from(selectedTaskIds);

      const { error } = await supabase
        .from('tasks')
        .update({
          priority: newPriority,
          updated_at: new Date().toISOString(),
        })
        .in('id', taskIds);

      if (error) throw error;

      console.log('[BulkAction] Changed priority:', {
        action: 'bulk_priority',
        task_count: taskIds.length,
        performed_by: sellerId,
        task_ids: taskIds,
        new_priority: newPriority,
      });

      toast.success(`Prioridade alterada para ${taskIds.length} tarefas`);
      onClearSelection();
      onActionComplete();
      setConfirmModal(null);
    } catch (error) {
      console.error('Error updating priority:', error);
      toast.error('Erro ao alterar prioridade');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkFollowup = async () => {
    setLoading(true);
    try {
      const taskIds = Array.from(selectedTaskIds);

      // Get original tasks
      const { data: originalTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('client_id, contact_type, notes')
        .in('id', taskIds);

      if (fetchError) throw fetchError;

      // Create followup tasks directly via insert
      const followupTasks = (originalTasks || []).map(task => ({
        client_id: task.client_id,
        contact_type: task.contact_type,
        task_date: rescheduleDate,
        notes: `Retorno: ${task.notes || 'Sem observacao'}`,
        priority: 'media' as const,
        contact_reason: 'RETORNO',
        created_by_seller_id: sellerId,
        status: 'pendente',
      }));

      if (followupTasks.length > 0) {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(followupTasks);
        if (insertError) throw insertError;
      }

      console.log('[BulkAction] Created followups:', {
        action: 'bulk_followup',
        task_count: taskIds.length,
        performed_by: sellerId,
        original_task_ids: taskIds,
        followup_date: rescheduleDate,
      });

      toast.success(`${followupTasks.length} retornos criados para ${format(new Date(rescheduleDate), 'dd/MM/yyyy')}`);
      onClearSelection();
      onActionComplete();
      setConfirmModal(null);
    } catch (error) {
      console.error('Error creating followups:', error);
      toast.error('Erro ao criar retornos');
    } finally {
      setLoading(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-card border border-border shadow-xl rounded-xl p-3 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 border-r border-border">
              <Badge variant="secondary" className="font-bold">
                {selectedCount}
              </Badge>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                selecionada{selectedCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={() => setConfirmModal('complete')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setConfirmModal('reschedule')}
              >
                <RotateCcw className="h-4 w-4" />
                Reagendar
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setConfirmModal('followup')}
              >
                <CalendarPlus className="h-4 w-4" />
                Criar Retorno
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setConfirmModal('priority')}
              >
                <Flag className="h-4 w-4" />
                Prioridade
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              className="ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirm Complete Modal */}
      <Dialog open={confirmModal === 'complete'} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar conclusao em massa
            </DialogTitle>
            <DialogDescription>
              Voce esta prestes a concluir {selectedCount} tarefa{selectedCount > 1 ? 's' : ''}.
              Esta acao sera registrada no historico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkComplete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={confirmModal === 'reschedule'} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar tarefas</DialogTitle>
            <DialogDescription>
              Selecione a nova data para {selectedCount} tarefa{selectedCount > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova data</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkReschedule} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Modal */}
      <Dialog open={confirmModal === 'priority'} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar prioridade</DialogTitle>
            <DialogDescription>
              Selecione a nova prioridade para {selectedCount} tarefa{selectedCount > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova prioridade</Label>
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkPriority} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Followup Modal */}
      <Dialog open={confirmModal === 'followup'} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar retornos</DialogTitle>
            <DialogDescription>
              Criar retornos para {selectedCount} tarefa{selectedCount > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data do retorno</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkFollowup} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Retornos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
