import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, MessageCircle, ChevronDown, ChevronUp,
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

const PRIORITY_CONFIG = {
  alta: { label: 'Alta', className: 'hh-badge-danger' },
  media: { label: 'Media', className: 'hh-badge-warning' },
  baixa: { label: 'Baixa', className: 'hh-badge-neutral' },
};

const RANKING_LABELS: Record<string, { label: string }> = {
  top20: { label: 'Top 20' },
  top100: { label: 'Top 100' },
  top200: { label: 'Top 200' },
  top300: { label: 'Top 300' },
  eventual: { label: 'Eventual' },
};

export function TaskPrioritySection({
  title, subtitle, icon, tasks, variant, selectedTasks,
  onToggleTask, onComplete, onTaskClick, onDeleteTask, onRequestReschedule,
  onCreateFollowup, isAdmin = false, isOwner = false, emptyState,
}: TaskPrioritySectionProps) {
  // Auto-expand overdue and today sections when they have tasks
  const [expanded, setExpanded] = useState(variant === 'overdue' || variant === 'today');

  if (tasks.length === 0 && !emptyState) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl shadow-hh-sm overflow-hidden"
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
                tasks.length > 0 && variant === 'overdue' && "hh-badge-danger",
                tasks.length > 0 && variant === 'today' && "hh-badge-warning",
                (tasks.length === 0 || variant === 'upcoming') && "hh-badge-neutral",
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
                  const ranking = RANKING_LABELS[task.clientRankingTier || 'eventual'];
                  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.media;
                  const taskAge = task.createdAt ? differenceInDays(new Date(), parseISO(task.createdAt)) : 0;

                  const isCompletedAwaitingConfirmation = task.status === 'concluida' && !task.managerConfirmedAt;

                  return (
                    <div key={task.id}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
                        isCompletedAwaitingConfirmation
                          ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                          : isSelected ? "bg-primary/5 hover:bg-muted/50" : "hover:bg-muted/50"
                      )}
                      style={{ borderBottom: idx < tasks.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}
                      onClick={() => onTaskClick(task)}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleTask(task.id)}
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Contact type icon */}
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-muted">
                        {task.contactType === 'ligacao' ? (
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13px] truncate text-foreground">
                            {task.clientName || (task.notes ? task.notes.split('\n')[0].slice(0, 60) : 'Tarefa Operacional')}
                          </span>
                          <span className="text-[10px] shrink-0 text-muted-foreground/70">{ranking?.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>
                            {task.taskDate ? (() => { try { return format(parseISO(task.taskDate), "dd/MM", { locale: ptBR }); } catch { return task.taskDate; } })() : '\u2014'}
                            {task.taskTime && ` as ${task.taskTime.slice(0, 5)}`}
                          </span>
                          {variant === 'overdue' && <span className="font-medium text-destructive">Atrasada</span>}
                          {taskAge >= 8 && (
                            <span className={cn("font-medium", taskAge >= 15 ? "text-destructive" : "text-status-warning")}>
                              {taskAge}d
                            </span>
                          )}
                        </div>
                        {/* Notes */}
                        {task.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {task.notes}
                          </p>
                        )}
                      </div>

                      {/* Priority / Status badge */}
                      {isCompletedAwaitingConfirmation ? (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">Concluida</span>
                      ) : (
                        <span className={cn(priorityConfig.className, "shrink-0")}>{priorityConfig.label}</span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button size="sm" className="h-7 gap-1 text-[11px]"
                          onClick={(e) => { e.stopPropagation(); onComplete(task); }}>
                          <CheckCircle2 className="h-3 w-3" />
                          Concluir
                        </Button>

                        {variant === 'overdue' && !isAdmin && onRequestReschedule && (
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

                        {/* Owner-only delete */}
                        {isOwner && onDeleteTask && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                            title="Excluir tarefa"
                          >
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
