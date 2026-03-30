import { useMemo, useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileData, ROLE_LABELS, DEPT_LABELS } from '@/hooks/useProfileData';
import { ProfileStoriesBar } from './ProfileStoriesBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  WarningCircle,
  Briefcase,
  Eye,
  Trophy,
  ChartBar,
  ListChecks,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ── Animated Tab System ─────────────────────────────────────────────────────

type ProfileTab = 'overview' | 'progress';

function AnimatedTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const activeBtn = activeTab === 'overview' ? overviewRef.current : progressRef.current;
    if (!container || !activeBtn) return;
    const cRect = container.getBoundingClientRect();
    const tRect = activeBtn.getBoundingClientRect();
    setIndicator({ left: tRect.left - cRect.left, width: tRect.width });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-1 p-1 rounded-xl bg-[#EDEAE4] w-full"
    >
      {indicator && (
        <div
          className="absolute h-[calc(100%-8px)] rounded-lg bg-white shadow-sm transition-all duration-250 ease-out"
          style={{ left: indicator.left, width: indicator.width, top: 4 }}
        />
      )}
      <button
        ref={overviewRef}
        onClick={() => onTabChange('overview')}
        className={cn(
          'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
          activeTab === 'overview' ? 'text-[#1A1916]' : 'text-[#5C5A54] hover:text-[#1A1916]'
        )}
      >
        <Eye size={18} weight="bold" />
        Visão Geral
      </button>
      <button
        ref={progressRef}
        onClick={() => onTabChange('progress')}
        className={cn(
          'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
          activeTab === 'progress' ? 'text-[#1A1916]' : 'text-[#5C5A54] hover:text-[#1A1916]'
        )}
      >
        <Trophy size={18} weight="bold" />
        Métricas
      </button>
    </div>
  );
}

// ── Stat Card with Hover ────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  value,
  valueColor,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  valueColor: string;
  label: string;
}) {
  return (
    <div className="group bg-white rounded-xl border-[0.5px] border-[#E8E5DF] p-4 flex items-center gap-4 transition-all duration-150 hover:border-[#C8C5BF] hover:scale-[1.01] cursor-default">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        {icon}
      </div>
      <div>
        <p className={cn('text-2xl font-bold leading-none', valueColor)}>{value}</p>
        <p className="text-xs text-[#5C5A54] mt-1">{label}</p>
      </div>
    </div>
  );
}

// ── Metric Row with Progress ────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  total,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
  suffix?: string;
}) {
  const percentage = total && total > 0 ? Math.round((value / total) * 100) : 0;
  const barWidth = total ? percentage : Math.min(value, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-[#5C5A54]">{label}</span>
        <span className="text-sm font-semibold text-[#1A1916]">
          {total ? `${percentage}%` : value}{suffix}
        </span>
      </div>
      <div className="h-[2px] w-full bg-[#EDEAE4] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.min(barWidth, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface ProfileHubContentProps {
  sellerId?: string;
  isOwnProfile?: boolean;
  canSeeDetails?: boolean;
}

export function ProfileHubContent({ sellerId, isOwnProfile = true, canSeeDetails = true }: ProfileHubContentProps) {
  const { seller: currentSeller } = useAuth();
  const resolvedId = sellerId || currentSeller?.id;
  const { profile, kpis, loading } = useProfileData(resolvedId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  const initials = useMemo(() => {
    if (!profile?.name) return '?';
    return profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }, [profile?.name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-[#1A9E78] border-t-transparent animate-spin" />
          <span className="text-sm text-[#5C5A54]">Carregando perfil...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[#5C5A54]">Perfil não encontrado</p>
      </div>
    );
  }

  const completionRate = kpis.totalTasks > 0
    ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Stories Bar */}
      <div className="px-4 mb-3">
        <div className="bg-white rounded-2xl border-[0.5px] border-[#E8E5DF] px-3 py-2">
          <ProfileStoriesBar />
        </div>
      </div>

      {/* Header / Capa */}
      <div>
        <div
          className="h-[120px] rounded-t-2xl"
          style={{
            background: 'linear-gradient(135deg, #0F0F0E 0%, #1A2A1F 100%)',
          }}
        />

        <div className="px-6 -mt-12 relative z-10">
          <div className="flex items-end gap-5">
            {/* Avatar com ring animado */}
            <div className="group relative">
              <Avatar className="h-24 w-24 border-[3px] border-white shadow-sm ring-2 ring-[#1A9E78] transition-all duration-300 group-hover:ring-[3px] group-hover:ring-[#2DD4A0]">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-[#0F0F0E] text-[#2DD4A0] text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full ring-2 ring-[#2DD4A0]/0 group-hover:ring-[#2DD4A0]/30 transition-all duration-500" />
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold tracking-tight truncate text-[#1A1916]">
                {profile.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {/* Badge role — pill seco, fundo escuro + texto verde-salva */}
                <Badge className="text-xs font-medium gap-1 bg-[#1A1916] text-[#2DD4A0] border-0 rounded-md px-2.5 py-0.5 hover:bg-[#2A2926] transition-colors duration-200">
                  <Briefcase size={12} weight="bold" />
                  {ROLE_LABELS[profile.role] || profile.role}
                </Badge>
                {/* Badge departamento — chip outline fino */}
                {profile.department && (
                  <Badge
                    variant="outline"
                    className="text-xs text-[#5C5A54] border-[#D4D1CB] rounded-md px-2.5 py-0.5"
                  >
                    {DEPT_LABELS[profile.department] || profile.department}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-5 pt-4 border-t border-[#E8E5DF]/60">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[28px] font-bold leading-none text-[#1A9E78]">
                  {kpis.completedTasks}
                </p>
                <p className="text-[9px] text-[#5C5A54] font-medium uppercase tracking-[0.1em] mt-1">
                  Concluídas
                </p>
              </div>
              <div className="text-center">
                <p className="text-[28px] font-bold leading-none text-[#1A1916]">
                  {kpis.openTasks}
                </p>
                <p className="text-[9px] text-[#5C5A54] font-medium uppercase tracking-[0.1em] mt-1">
                  Abertas
                </p>
              </div>
              <div className="text-center">
                <p className="text-[28px] font-bold leading-none text-[#C0392B]">
                  {kpis.overdueTasks}
                </p>
                <p className="text-[9px] text-[#5C5A54] font-medium uppercase tracking-[0.1em] mt-1">
                  Atrasadas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-8">
        <AnimatedTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatCard
              icon={<CheckCircle size={18} weight="bold" className="text-[#1A9E78]" />}
              iconBg="bg-[#1A9E78]/10"
              value={kpis.completedTasks}
              valueColor="text-[#1A1916]"
              label="Tarefas concluídas"
            />
            <StatCard
              icon={<WarningCircle size={18} weight="bold" className="text-[#C0392B]" />}
              iconBg="bg-[#C0392B]/10"
              value={kpis.overdueTasks}
              valueColor="text-[#1A1916]"
              label="Atrasadas abertas"
            />
            <StatCard
              icon={<ListChecks size={18} weight="bold" className="text-[#1A9E78]" />}
              iconBg="bg-[#1A9E78]/10"
              value={kpis.openTasks}
              valueColor="text-[#1A1916]"
              label="Abertas"
            />
            <StatCard
              icon={<Briefcase size={18} weight="bold" className="text-[#5C5A54]" />}
              iconBg="bg-[#5C5A54]/10"
              value={kpis.totalTasks}
              valueColor="text-[#1A1916]"
              label="Total de tarefas"
            />
          </div>
        )}

        {/* TAB 2: MÉTRICAS */}
        {activeTab === 'progress' && (isOwnProfile || canSeeDetails) && (
          <div className="mt-5 space-y-4">
            {/* Performance Cards */}
            <div className="bg-white rounded-xl border-[0.5px] border-[#E8E5DF] p-5 space-y-5">
              <div className="flex items-center gap-2">
                <ChartBar size={16} weight="bold" className="text-[#1A9E78]" />
                <h4 className="text-sm font-semibold text-[#1A1916]">Resumo de Desempenho</h4>
              </div>

              <MetricRow
                label="Taxa de conclusão"
                value={kpis.completedTasks}
                total={kpis.totalTasks}
                color="bg-[#1A9E78]"
              />
              <MetricRow
                label="Tarefas abertas"
                value={kpis.openTasks}
                total={kpis.totalTasks}
                color="bg-[#5C5A54]"
              />
              <MetricRow
                label="Tarefas atrasadas"
                value={kpis.overdueTasks}
                total={kpis.totalTasks}
                color="bg-[#C0392B]"
              />
            </div>

            {/* Completion Summary */}
            <div className="bg-white rounded-xl border-[0.5px] border-[#E8E5DF] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#5C5A54]">Eficiência geral</p>
                  <p className="text-3xl font-bold text-[#1A1916] mt-1">{completionRate}%</p>
                </div>
                <div className="h-16 w-16 rounded-full border-[3px] border-[#EDEAE4] flex items-center justify-center relative">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke="#1A9E78"
                      strokeWidth="3"
                      strokeDasharray={`${completionRate * 1.76} 176`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="text-xs font-bold text-[#1A9E78]">{completionRate}%</span>
                </div>
              </div>
              <Separator className="my-4 bg-[#E8E5DF]/60" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-[#1A9E78]">{kpis.completedTasks}</p>
                  <p className="text-[10px] text-[#5C5A54] uppercase tracking-wider">Feitas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#1A1916]">{kpis.openTasks}</p>
                  <p className="text-[10px] text-[#5C5A54] uppercase tracking-wider">Pendentes</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#C0392B]">{kpis.overdueTasks}</p>
                  <p className="text-[10px] text-[#5C5A54] uppercase tracking-wider">Atrasadas</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
