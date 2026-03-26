import { useState } from 'react';
import { Target, Plus, X, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TaskData } from '@/hooks/useTasksData';
import type { FocusItem } from '@/hooks/useDailyFocus';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  focusItems: FocusItem[];
  allTasks: TaskData[];
  suggestions: TaskData[];
  focusTaskIds: Set<string>;
  onAddFocus: (taskId: string) => void;
  onRemoveFocus: (taskId: string) => void;
  onTaskClick: (task: TaskData) => void;
}

export function DailyFocusBlock({
  focusItems, allTasks, suggestions, focusTaskIds,
  onAddFocus, onRemoveFocus, onTaskClick,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const focusTasks = focusItems
    .map((fi) => {
      const task = allTasks.find((t) => t.id === fi.taskId);
      return task ? { ...fi, task } : null;
    })
    .filter(Boolean) as (FocusItem & { task: TaskData })[];

  const completedCount = focusItems.filter((f) => f.completedAt).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 space-y-3 bg-card border border-border rounded-xl shadow-hh-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-medium text-[14px] text-foreground">
              Foco Obrigatorio de Hoje
            </h3>
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              {completedCount}/{focusItems.length || 3} concluidas
              {focusItems.length > 0 && (
                <span className="ml-2 text-primary">+5 XP por foco</span>
              )}
            </p>
          </div>
        </div>
        {focusItems.length < 3 && (
          <Button size="sm" variant="outline" className="gap-1 text-[11px]"
            onClick={() => setShowSuggestions(!showSuggestions)}>
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        )}
      </div>

      {focusTasks.length > 0 ? (
        <div className="space-y-2">
          {focusTasks.map(({ task, completedAt, taskId }) => (
            <div key={taskId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                completedAt ? "border-status-success/30 bg-status-success/5" : "border-border bg-card hover:border-border cursor-pointer"
              )}
              onClick={() => !completedAt && onTaskClick(task)}>
              {completedAt ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 shrink-0 border-primary" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("text-[13px] font-medium truncate", completedAt ? "line-through text-muted-foreground" : "text-foreground")}>
                  {task.clientName || task.notes?.substring(0, 30) || task.planningNotes?.substring(0, 30) || 'Tarefa Geral'}
                </p>
                {task.notes && <p className="text-[11px] truncate text-muted-foreground">{task.notes}</p>}
              </div>
              {!completedAt && (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); onRemoveFocus(taskId); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
              {completedAt && (
                <span className="hh-badge-success text-[10px]">+5 XP</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.length > 0 ? (
            <>
              <p className="text-[11px] flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Sugestao automatica — selecione ate 3 tarefas:
              </p>
              {suggestions.map((task) => (
                <div key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer transition-colors hover:border-border border-border/60 bg-card"
                  onClick={() => onAddFocus(task.id)}>
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate text-foreground">{task.clientName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {task.priority === 'alta' ? 'Alta' : task.priority === 'media' ? 'Media' : 'Baixa'}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                </div>
              ))}
            </>
          ) : (
            <p className="text-[11px] text-center py-2 text-muted-foreground">
              Nenhuma tarefa pendente para focar.
            </p>
          )}
        </div>
      )}

      <AnimatePresence>
        {showSuggestions && focusItems.length > 0 && focusItems.length < 3 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="text-[11px] mb-2 text-muted-foreground">Selecione mais tarefas:</p>
            {allTasks
              .filter((t) => t.status === 'pendente' && !focusTaskIds.has(t.id))
              .slice(0, 5)
              .map((task) => (
                <div key={task.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => { onAddFocus(task.id); setShowSuggestions(false); }}>
                  <Plus className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[13px] truncate text-foreground">{task.clientName}</span>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
