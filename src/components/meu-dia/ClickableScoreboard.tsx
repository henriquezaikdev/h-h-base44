import { Card, CardContent } from '@/components/ui/card';
import { Phone, MessageCircle, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SellerMetricsCalculated {
  salesMonth?: number;
  ordersMonth?: number;
  tasksCompletedMonth?: number;
  tasksOpenCount?: number;
  actualCallsToday?: number;
  actualWhatsappToday?: number;
  actualContactsToday?: number;
  actualSalesToday?: number;
  metaCallsToday?: number;
  metaWhatsappToday?: number;
  metaContactsToday?: number;
  remainingCallsMonth?: number;
  remainingWhatsappMonth?: number;
  remainingContactsMonth?: number;
  remainingSalesMonth?: number;
  neededCallsPerDayFromNow?: number;
  neededWhatsappPerDayFromNow?: number;
  neededContactsPerDayFromNow?: number;
  neededSalesPerDayFromNow?: number;
  workingDays?: number;
  elapsedWorkdays?: number;
  remainingWorkdays?: number;
}

interface ClickableScoreboardProps {
  metrics: SellerMetricsCalculated;
  isConfigured: boolean;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  onCallsCardClick?: () => void;
  onWhatsappCardClick?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

function getProgressColor(percent: number) {
  if (percent >= 80) return 'bg-[hsl(var(--status-success))]';
  if (percent >= 50) return 'bg-[hsl(var(--status-warning))]';
  return 'bg-[hsl(var(--status-danger))]';
}

export function ClickableScoreboard({
  metrics,
  isConfigured,
  activeFilter,
  onFilterChange,
  onCallsCardClick,
  onWhatsappCardClick,
}: ClickableScoreboardProps) {
  if (!isConfigured) {
    return (
      <Card className="bg-[hsl(var(--status-warning)/0.08)] border-[hsl(var(--status-warning)/0.3)]">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-status-warning" />
          <div>
            <p className="text-sm font-medium">Dias uteis nao configurados</p>
            <p className="text-xs text-muted-foreground">
              Configure os dias uteis do mes para exibir as metas corretamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    actualCallsToday = 0,
    actualWhatsappToday = 0,
    actualContactsToday = 0,
    actualSalesToday = 0,
    metaCallsToday = 0,
    metaWhatsappToday = 0,
    metaContactsToday = 0,
    remainingCallsMonth = 0,
    remainingWhatsappMonth = 0,
    neededCallsPerDayFromNow = 0,
    neededWhatsappPerDayFromNow = 0,
    neededSalesPerDayFromNow = 0,
    remainingSalesMonth = 0,
    remainingWorkdays = 1,
  } = metrics;

  const callsPercent = metaCallsToday > 0 ? Math.min(100, (actualCallsToday / metaCallsToday) * 100) : 0;
  const whatsappPercent = metaWhatsappToday > 0 ? Math.min(100, (actualWhatsappToday / metaWhatsappToday) * 100) : 0;
  const contactsPercent = metaContactsToday > 0 ? Math.min(100, (actualContactsToday / metaContactsToday) * 100) : 0;

  const callsComplete = actualCallsToday >= metaCallsToday;
  const whatsappComplete = actualWhatsappToday >= metaWhatsappToday;
  const contactsComplete = actualContactsToday >= metaContactsToday;

  const handleCardClick = (filter: string, callback?: () => void) => {
    if (callback) {
      callback();
    } else {
      onFilterChange(activeFilter === filter ? null : filter);
    }
  };

  const renderMetricCard = (
    label: string,
    actual: number,
    meta: number,
    percent: number,
    isComplete: boolean,
    remaining: string,
    filterKey: string,
    icon: React.ReactNode,
    onClick?: () => void,
    tooltip?: React.ReactNode,
  ) => {
    const card = (
      <Card
        className={cn(
          "transition-all cursor-pointer hover:shadow-hh-md bg-card border-border",
          activeFilter === filterKey && "ring-2 ring-primary",
          isComplete && "border-[hsl(var(--status-success)/0.3)]"
        )}
        onClick={() => handleCardClick(filterKey, onClick)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-md",
                isComplete ? 'bg-[hsl(var(--status-success)/0.1)]' : 'bg-primary/10'
              )}>
                {icon}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
            </div>
            {activeFilter === filterKey && (
              <span className="hh-badge-accent">Filtrado</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={cn(
                "text-[22px] font-semibold leading-none",
                isComplete ? 'text-status-success' : 'text-foreground'
              )}>
                {actual}
              </span>
              <span className="text-[13px] text-muted-foreground">/ {meta}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", getProgressColor(percent))}
                style={{ width: `${percent}%` }}
              />
            </div>
            {isComplete ? (
              <p className="text-[12px] text-status-success font-medium">Meta do dia atingida</p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {remaining}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }
    return card;
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">META DO DIA</span>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <motion.div variants={itemVariants}>
            {renderMetricCard(
              'Contatos', actualContactsToday, metaContactsToday, contactsPercent, contactsComplete,
              `Faltam ${metaContactsToday - actualContactsToday} hoje`, 'contatos',
              <Users className={cn("h-4 w-4", contactsComplete ? 'text-status-success' : 'text-primary')} />,
            )}
          </motion.div>

          <motion.div variants={itemVariants}>
            {renderMetricCard(
              'Ligacoes', actualCallsToday, metaCallsToday, callsPercent, callsComplete,
              `Faltam ${remainingCallsMonth} no mes`, 'ligacao',
              <Phone className={cn("h-4 w-4", callsComplete ? 'text-status-success' : 'text-primary')} />,
              onCallsCardClick,
              <div className="space-y-1">
                <p className="font-medium">Meta por nivel: {metaCallsToday}/dia</p>
                <p>Necessario p/ bater mes: {neededCallsPerDayFromNow}/dia</p>
                <p className="text-xs text-muted-foreground">{remainingWorkdays} dias uteis restantes</p>
              </div>,
            )}
          </motion.div>

          <motion.div variants={itemVariants}>
            {renderMetricCard(
              'WhatsApp', actualWhatsappToday, metaWhatsappToday, whatsappPercent, whatsappComplete,
              `Faltam ${remainingWhatsappMonth} no mes`, 'whatsapp',
              <MessageCircle className={cn("h-4 w-4", whatsappComplete ? 'text-status-success' : 'text-primary')} />,
              onWhatsappCardClick,
              <div className="space-y-1">
                <p className="font-medium">Meta por nivel: {metaWhatsappToday}/dia</p>
                <p>Necessario p/ bater mes: {neededWhatsappPerDayFromNow}/dia</p>
                <p className="text-xs text-muted-foreground">{remainingWorkdays} dias uteis restantes</p>
              </div>,
            )}
          </motion.div>

          <motion.div variants={itemVariants}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="transition-all cursor-help bg-card border-border hover:shadow-hh-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-md bg-[hsl(var(--status-success)/0.1)]">
                        <DollarSign className="h-4 w-4 text-status-success" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Vendas Hoje</span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[22px] font-semibold leading-none text-foreground">
                        {formatCurrency(actualSalesToday)}
                      </span>
                      <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>Necessario: {formatCurrency(neededSalesPerDayFromNow)}/dia</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        Faltam {formatCurrency(remainingSalesMonth)} no mes
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Meta diaria necessaria: {formatCurrency(neededSalesPerDayFromNow)}</p>
                  <p>Faltam {formatCurrency(remainingSalesMonth)} para bater a meta</p>
                  <p className="text-xs text-muted-foreground">{remainingWorkdays} dias uteis restantes</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
