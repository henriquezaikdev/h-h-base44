import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronDown, ChevronUp,
  CheckCircle2, RotateCcw, CalendarPlus, Eye, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { TaskData } from '@/hooks/useTasksData';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskPrioritySectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  tasks: TaskData[];
  variant: 'overdue' | 'today' | 'upcoming';
  selectedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
  onComplete: (task: TaskData) => void;
  onTaskClick: (task: TaskData) => void;
  onDeleteTask?: (task: TaskData) => void;
  onRequestReschedule?: (task: TaskData) => void;
  onCreateFollowup?: (task: TaskData) => void;
  isAdmin?: boolean;
  isOwner?: boolean;
  emptyState?: React.ReactNode;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgente: { label: 'Urgente', className: 'hh-badge-danger' },
  alta: { label: 'Alta', className: 'hh-badge-danger' },
  normal: { label: 'Normal', className: 'hh-badge-warning' },
  baixa: { label: 'Baixa', className: 'hh-badge-neutral' },
};

export function TaskPrioritySection({
  title, subtitle, icon, tasks, variant, selectedTasks,
  onToggleTask, onComplete, onTaskClick, onDeleteTask, onRequestReschedule,
  onCreateFollowup, isOwner = false, emptyState,
}: TaskPrioritySectionProps) {
  const [expanded, setExpanded] = useState(variant === 'overdue' || variant === 'today');

  if (tasks.length === 0 && !emptyState) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                {title}
              </span>
              <span className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded",
                tasks.length > 0 && variant === 'overdue' && "bg-destructive/10 text-destructive",
                tasks.length > 0 && variant === 'today' && "bg-amber-500/10 text-amber-600",
                (tasks.length === 0 || variant === 'upcoming') && "bg-muted text-muted-foreground",
              )}>
                {tasks.length}
              </span>
            </div>
            {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {tasks.length === 0 && emptyState ? (
              <div className="p-5">{emptyState}</div>
            ) : (
              <div>
                {tasks.map((task, idx) => {
                  const isSelected = selectedTasks.has(task.id);
                  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
                  const taskAge = task.createdAt ? differenceInDays(new Date(), parseISO(task.createdAt)) : 0;

                  return (
                    <div key={task.id}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
                        isSelected ? "bg-primary/5 hover:bg-muted/50" : "hover:bg-muted/50"
                      )}
                      style={{ borderBottom: idx < tasks.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}
                      onClick={() => onTaskClick(task)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleTask(task.id)}
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13px] truncate text-foreground">
                            {task.title || task.clientName || 'Tarefa Operacional'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>
                            {task.dueDate ? (() => { try { return format(parseISO(task.dueDate), "dd/MM", { locale: ptBR }); } catch { return task.dueDate; } })() : '\u2014'}
                          </span>
                          {variant === 'overdue' && <span className="font-medium text-destructive">Atrasada</span>}
                          {taskAge >= 8 && (
                            <span className={cn("font-medium", taskAge >= 15 ? "text-destructive" : "text-amber-500")}>
                              {taskAge}d
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <span className={cn(priorityConfig.className, "shrink-0")}>{priorityConfig.label}</span>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); onTaskClick(task); }} title="Ver detalhes">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" className="h-7 gap-1 text-[11px]"
                          onClick={(e) => { e.stopPropagation(); onComplete(task); }}>
                          <CheckCircle2 className="h-3 w-3" />
                          Concluir
                        </Button>
                        {variant === 'overdue' && onRequestReschedule && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); onRequestReschedule(task); }}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                        {variant === 'today' && onCreateFollowup && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); onCreateFollowup(task); }}>
                            <CalendarPlus className="h-3 w-3" />
                          </Button>
                        )}
                        {isOwner && onDeleteTask && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }} title="Excluir tarefa">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
