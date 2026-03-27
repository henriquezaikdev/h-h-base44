import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShoppingCart, CheckCircle, ListTodo, Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useEvolutionData } from '@/hooks/useEvolutionData';
import type { DailyActivity } from '@/hooks/useEvolutionData';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PerformanceTabProps {
  currentMonthSales:         number;
  currentMonthOrderCount:    number;
  currentMonthTasksCompleted: number;
  currentMonthTasksOpen:     number;
  workDaysInMonth:           number;
  workDaysPassed:            number;
  dailyActivities:           DailyActivity[];
  previousMonthSales:        number;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MetricCard({
  label, current, target, icon, iconBg,
}: {
  label:   string;
  current: number;
  target:  number;
  icon:    React.ReactNode;
  iconBg:  string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-xl font-bold text-gray-900">
            {current.toLocaleString('pt-BR')}
            <span className="text-sm text-gray-400 font-normal ml-1">/ {target.toLocaleString('pt-BR')}</span>
          </p>
        </div>
        <Badge
          variant={pct >= 100 ? 'default' : pct >= 70 ? 'secondary' : 'destructive'}
          className="text-xs shrink-0"
        >
          {pct}%
        </Badge>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function ContactCard({
  label, current, target, icon,
}: {
  label:   string;
  current: number;
  target:  number;
  icon:    React.ReactNode;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <p className="text-[13px] font-medium text-gray-700">{label}</p>
        </div>
        <span className="text-[12px] font-semibold text-gray-500">
          {current} / {target}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[#e5e7eb] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#3B5BDB] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">{pct}% da meta mensal</p>
    </div>
  );
}

// ── PerformanceTab ────────────────────────────────────────────────────────────

export function PerformanceTab({
  currentMonthSales,
  currentMonthOrderCount,
  currentMonthTasksCompleted,
  currentMonthTasksOpen,
  workDaysInMonth,
  workDaysPassed,
  dailyActivities,
  previousMonthSales,
}: PerformanceTabProps) {
  // Dados extras via hook interno (TanStack Query — sem duplicar request se já em cache)
  const { seller } = useAuth();
  const now = new Date();
  const {
    metaMensal,
    ligacoesMes,
    whatsappMes,
    metaLigacoes,
    metaWhatsapp,
    tbm,
  } = useEvolutionData(seller?.id ?? null, now.getMonth() + 1, now.getFullYear());

  // ── Gráfico ───────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return dailyActivities
      .filter(d => d.sales > 0 || d.tasksCompleted > 0)
      .map(d => ({
        date:    d.date.slice(5),
        Vendas:  Math.round(d.sales),
        Tarefas: d.tasksCompleted,
      }));
  }, [dailyActivities]);

  // ── Projeção ──────────────────────────────────────────────────────────────
  const projectedSales = workDaysPassed > 0
    ? Math.round((currentMonthSales / workDaysPassed) * workDaysInMonth)
    : 0;

  const salesGrowth = previousMonthSales > 0
    ? Math.round(((currentMonthSales - previousMonthSales) / previousMonthSales) * 100)
    : 0;

  const metaAtingida = currentMonthSales >= metaMensal;

  return (
    <div className="space-y-4">

      {/* ── Cards de métrica ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Vendas"
          current={currentMonthSales}
          target={metaMensal}
          icon={<ShoppingCart className="h-5 w-5 text-green-600" strokeWidth={1.5} />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label="Tarefas concluídas"
          current={currentMonthTasksCompleted}
          target={workDaysInMonth * 5}
          icon={<CheckCircle className="h-5 w-5 text-[#3B5BDB]" strokeWidth={1.5} />}
          iconBg="bg-indigo-50"
        />
        <MetricCard
          label="Pedidos"
          current={currentMonthOrderCount}
          target={50}
          icon={<ListTodo className="h-5 w-5 text-violet-600" strokeWidth={1.5} />}
          iconBg="bg-violet-50"
        />
      </div>

      {/* ── Projeção de vendas + TBM ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Projeção de vendas
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-gray-400 mb-1">Projeção para o fim do mês</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {projectedSales.toLocaleString('pt-BR')}
            </p>
            {salesGrowth !== 0 && (
              <p className={cn('text-[12px] mt-1', salesGrowth > 0 ? 'text-green-600' : 'text-red-600')}>
                {salesGrowth > 0 ? '+' : ''}{salesGrowth}% vs mês anterior
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1">Dias úteis</p>
            <p className="text-lg font-semibold text-gray-900">{workDaysPassed}<span className="text-gray-400 font-normal">/{workDaysInMonth}</span></p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1">Tarefas abertas</p>
            <p className="text-lg font-semibold text-gray-900">{currentMonthTasksOpen}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1">Meta diária restante</p>
            {metaAtingida ? (
              <p className="text-lg font-bold text-[#16a34a]">Meta atingida</p>
            ) : (
              <>
                <p className="text-lg font-bold text-gray-900">
                  R$ {tbm.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-gray-400">por dia útil para bater a meta</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Contatos do mês ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Contatos do mês
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ContactCard
            label="Ligações"
            current={ligacoesMes}
            target={metaLigacoes}
            icon={<Phone className="h-4 w-4 text-[#3B5BDB]" strokeWidth={1.5} />}
          />
          <ContactCard
            label="WhatsApp"
            current={whatsappMes}
            target={metaWhatsapp}
            icon={<MessageSquare className="h-4 w-4 text-[#3B5BDB]" strokeWidth={1.5} />}
          />
        </div>
      </div>

      {/* ── Gráfico de atividade ──────────────────────────────────────────── */}
      {dailyActivities.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Atividade do mês
          </p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="Vendas"  fill="#3B5BDB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tarefas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-400">Nenhuma atividade registrada neste período</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
