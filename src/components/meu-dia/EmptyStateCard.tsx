import { Button } from '@/components/ui/button';
import { CalendarPlus, Search, Calendar, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateCardProps {
  variant: 'overdue' | 'today' | 'upcoming' | 'all';
  onCreateTask?: () => void;
  onSearchClients?: () => void;
  onPlanWeek?: () => void;
}

export function EmptyStateCard({ variant, onCreateTask, onSearchClients, onPlanWeek }: EmptyStateCardProps) {
  const messages = {
    overdue: { title: "Nenhuma tarefa atrasada", subtitle: "Voce esta em dia." },
    today: { title: "Tarefas de hoje concluidas", subtitle: "Que tal planejar o proximo passo?" },
    upcoming: { title: "Nenhuma tarefa agendada", subtitle: "Planeje suas proximas acoes." },
    all: { title: "Dia livre", subtitle: "Todas as tarefas concluidas." },
  };

  const config = messages[variant];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="py-6 text-center">
        <CheckCircle2 className="h-6 w-6 mx-auto mb-3 text-status-success" />
        <h3 className="font-medium text-[14px] mb-1 text-foreground">{config.title}</h3>
        <p className="text-[13px] mb-4 text-muted-foreground">{config.subtitle}</p>

        <div className="flex flex-wrap justify-center gap-2">
          {onCreateTask && (
            <Button size="sm" variant="outline" onClick={onCreateTask} className="gap-1 text-[11px]">
              <CalendarPlus className="h-3 w-3" /> Criar retorno
            </Button>
          )}
          {onSearchClients && (
            <Button size="sm" variant="outline" onClick={onSearchClients} className="gap-1 text-[11px]">
              <Search className="h-3 w-3" /> Clientes sem contato 20+ dias
            </Button>
          )}
          {onPlanWeek && (
            <Button size="sm" variant="outline" onClick={onPlanWeek} className="gap-1 text-[11px]">
              <Calendar className="h-3 w-3" /> Planejar semana
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
