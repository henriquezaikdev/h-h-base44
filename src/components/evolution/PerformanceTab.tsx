import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShoppingCart, CheckCircle, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { DailyActivity } from '@/hooks/useEvolutionData';

interface PerformanceTabProps {
  currentMonthSales: number;
  currentMonthOrderCount: number;
  currentMonthTasksCompleted: number;
  currentMonthTasksOpen: number;
  workDaysInMonth: number;
  workDaysPassed: number;
  dailyActivities: DailyActivity[];
  previousMonthSales: number;
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
  currentMonthSales, currentMonthOrderCount, currentMonthTasksCompleted,
  currentMonthTasksOpen, workDaysInMonth, workDaysPassed,
  dailyActivities, previousMonthSales,
}: PerformanceTabProps) {
  // Chart data
  const chartData = useMemo(() => {
    return dailyActivities.slice(-20).map(d => ({
      date: d.date.slice(5),
      Tarefas: d.tasksCompleted,
    }));
  }, [dailyActivities]);

  // Sales projection
  const projectedSales = workDaysPassed > 0
    ? Math.round((currentMonthSales / workDaysPassed) * workDaysInMonth)
    : 0;

  const salesGrowth = previousMonthSales > 0
    ? Math.round(((currentMonthSales - previousMonthSales) / previousMonthSales) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricProgressCard
          label="Vendas"
          current={currentMonthSales}
          target={30000}
          icon={<ShoppingCart className="h-5 w-5 text-emerald-600" />}
          color="bg-emerald-500/10"
        />
        <MetricProgressCard
          label="Tarefas Concluidas"
          current={currentMonthTasksCompleted}
          target={workDaysInMonth * 5}
          icon={<CheckCircle className="h-5 w-5 text-blue-600" />}
          color="bg-blue-500/10"
        />
        <MetricProgressCard
          label="Pedidos"
          current={currentMonthOrderCount}
          target={50}
          icon={<ListTodo className="h-5 w-5 text-purple-600" />}
          color="bg-purple-500/10"
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
              {salesGrowth !== 0 && (
                <p className={cn("text-xs mt-1", salesGrowth > 0 ? "text-emerald-600" : "text-destructive")}>
                  {salesGrowth > 0 ? '+' : ''}{salesGrowth}% vs mes anterior
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Dias uteis passados</p>
              <p className="text-lg font-semibold">{workDaysPassed}/{workDaysInMonth}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tarefas abertas</p>
              <p className="text-lg font-semibold">{currentMonthTasksOpen}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Activities Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tarefas Concluidas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="Tarefas" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
