import { AlertTriangle, Clock, ArrowRight, Timer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CriticalTask } from '@/hooks/useCriticalBlocker';

interface Props {
  open: boolean;
  tasks: CriticalTask[];
  onOpenTask: (taskId: string) => void;
  onSnooze?: () => void;
}

export function CriticalBlockerModal({ open, tasks, onOpenTask, onSnooze }: Props) {
  // Show only the oldest task (most critical)
  const oldestTask = tasks.length > 0 ? tasks[0] : null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-lg">Tarefas Criticas Vencidas</DialogTitle>
              <DialogDescription>
                Resolva antes de continuar usando o sistema.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2 max-h-80 overflow-y-auto">
          {oldestTask && (() => {
            const daysOverdue = differenceInDays(new Date(), parseISO(oldestTask.taskDate));
            const tierLabel = oldestTask.clientRankingTier?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div
                key={oldestTask.id}
                className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{oldestTask.clientName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(parseISO(oldestTask.taskDate), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-destructive font-medium">
                      {daysOverdue}d atrasada
                    </span>
                    {tierLabel && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {tierLabel}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1 shrink-0"
                  onClick={() => onOpenTask(oldestTask.id)}
                >
                  Resolver
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })()}

          {tasks.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              + {tasks.length - 1} outra(s) tarefa(s) critica(s) pendente(s)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <p className="text-xs text-muted-foreground text-center">
            Criacao de tarefas, H-Coins e feed estao bloqueados ate resolver.
          </p>
          {onSnooze && (
            <Button
              variant="ghost"
              size="sm"
              className="mx-auto text-xs text-muted-foreground gap-1.5"
              onClick={onSnooze}
            >
              <Timer className="h-3.5 w-3.5" />
              Resolver depois (lembrar em 3h)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
