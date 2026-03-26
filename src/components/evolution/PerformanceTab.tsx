import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Phone, MessageCircle, ShoppingCart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { SellerLevel, DailyActivity } from '@/hooks/useEvolutionData';

interface PerformanceTabProps {
  level: SellerLevel;
  currentMonthSales: number;
  currentMonthCalls: number;
  currentMonthWhatsapp: number;
  workDaysInMonth: number;
  workDaysPassed: number;
  dailyActivities: DailyActivity[];
  alerts: Array<{ id: string; type: string; title: string; description: string; action?: string }>;
  evolutionStatus: 'rising' | 'stable' | 'falling';
  monthsToPromotion: number;
  monthsToDemotion: number;
}

function MetricProgressCard({
  label, current, target, icon, color,
}: {
  label: string;
  current: number;
  target: number;
  icon: React.ReactNode;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            <p className="text-xl font-bold">{current.toLocaleString('pt-BR')} <span className="text-sm text-muted-foreground font-normal">/ {target.toLocaleString('pt-BR')}</span></p>
          </div>
          <Badge variant={pct >= 100 ? 'default' : pct >= 70 ? 'secondary' : 'destructive'} className="text-xs">
            {pct}%
          </Badge>
        </div>
        <Progress value={pct} className="h-2" />
      </CardContent>
    </Card>
  );
}

export function PerformanceTab({
  level, currentMonthSales, currentMonthCalls, currentMonthWhatsapp,
  workDaysInMonth, workDaysPassed, dailyActivities, alerts,
  evolutionStatus, monthsToPromotion, monthsToDemotion,
}: PerformanceTabProps) {
  const salesTarget = level.monthly_sales_target || 30000;
  const callsTarget = (level.daily_calls_target || 8) * workDaysInMonth;
  const whatsappTarget = workDaysInMonth * 5; // Default 5/day

  // Chart data for daily activities
  const chartData = useMemo(() => {
    return dailyActivities.slice(-20).map(d => ({
      date: d.date.slice(5), // MM-DD
      Ligacoes: d.calls,
      WhatsApp: d.whatsapp,
      Total: d.total,
    }));
  }, [dailyActivities]);

  // Sales projection
  const projectedSales = workDaysPassed > 0
    ? Math.round((currentMonthSales / workDaysPassed) * workDaysInMonth)
    : 0;

  const StatusIcon = evolutionStatus === 'rising' ? TrendingUp : evolutionStatus === 'falling' ? TrendingDown : Minus;
  const statusColor = evolutionStatus === 'rising' ? 'text-emerald-600' : evolutionStatus === 'falling' ? 'text-red-600' : 'text-muted-foreground';
  const statusLabel = evolutionStatus === 'rising' ? 'Em ascensao' : evolutionStatus === 'falling' ? 'Em queda' : 'Estavel';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border",
                alert.type === 'danger' ? 'bg-destructive/5 border-destructive/20' : 'bg-amber-500/5 border-amber-500/20'
              )}
            >
              <AlertTriangle className={cn("h-5 w-5 mt-0.5 shrink-0", alert.type === 'danger' ? 'text-destructive' : 'text-amber-600')} />
              <div>
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
                {alert.action && <p className="text-xs text-muted-foreground mt-1 italic">{alert.action}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evolution Status */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center",
              evolutionStatus === 'rising' ? 'bg-emerald-500/10' : evolutionStatus === 'falling' ? 'bg-red-500/10' : 'bg-muted'
            )}>
              <StatusIcon className={cn("h-7 w-7", statusColor)} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Status de Evolucao</p>
              <p className={cn("text-lg font-bold", statusColor)}>{statusLabel}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {monthsToPromotion <= 0 ? (
                  <Badge className="bg-emerald-600">Pronto para subir!</Badge>
                ) : (
                  <p>{monthsToPromotion} mes(es) para subir</p>
                )}
              </div>
              {monthsToDemotion <= 1 && (
                <p className="text-xs text-destructive mt-1">Risco de rebaixamento</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricProgressCard
          label="Vendas"
          current={currentMonthSales}
          target={salesTarget}
          icon={<ShoppingCart className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-500/10"
        />
        <MetricProgressCard
          label="Ligacoes"
          current={currentMonthCalls}
          target={callsTarget}
          icon={<Phone className="h-5 w-5 text-blue-600" />}
          color="bg-blue-500/10"
        />
        <MetricProgressCard
          label="WhatsApp"
          current={currentMonthWhatsapp}
          target={whatsappTarget}
          icon={<MessageCircle className="h-5 w-5 text-green-600" />}
          color="bg-green-500/10"
        />
      </div>

      {/* Sales Projection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Projecao de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Projecao para final do mes</p>
              <p className="text-2xl font-bold">
                R$ {projectedSales.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Dias uteis passados</p>
              <p className="text-lg font-semibold">{workDaysPassed}/{workDaysInMonth}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Activities Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atividades Diarias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Ligacoes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="WhatsApp" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cumulative Progress Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progresso Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
