import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DeleteTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  isCompleted: boolean;
  onDeleted?: () => void;
}

export function DeleteTaskModal({
  open, onOpenChange, taskId, isCompleted, onDeleted,
}: DeleteTaskModalProps) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Tarefa removida');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['actionCenter'] });
      onDeleted?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao remover tarefa';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Remover Tarefa</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {isCompleted
              ? 'Esta tarefa ja foi concluida. Deseja remove-la do historico?'
              : 'Tem certeza que deseja remover esta tarefa? Esta acao nao pode ser desfeita.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1 gap-2">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
