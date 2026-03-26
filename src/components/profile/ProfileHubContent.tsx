import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileData, ROLE_LABELS, DEPT_LABELS } from '@/hooks/useProfileData';
import { useCoinsAndMedals } from '@/hooks/useCoinsAndMedals';
import { ProfileStoriesBar } from './ProfileStoriesBar';
import { LevelExplanationBlock } from './LevelExplanationBlock';
import { MedalsDisplay } from '@/components/coins/MedalsDisplay';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle,
  AlertTriangle,
  Flame,
  Activity,
  Briefcase,
  Star,
  Coins,
  Award,
  Zap,
  TrendingUp,
  Clock,
  Eye,
  Trophy,
  Heart,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const ACTION_LABELS: Record<string, string> = {
  task_completed: 'Concluiu tarefa',
  task_created: 'Criou tarefa',
  task_bucket_moved: 'Moveu tarefa',
  pendency_resolved: 'Resolveu pendencia',
};

const LEVEL_NAMES: Record<number, { name: string; emoji: string }> = {
  1: { name: 'Iniciante', emoji: '🥚' },
  2: { name: 'Aprendiz', emoji: '🐣' },
  3: { name: 'Praticante', emoji: '🐥' },
  4: { name: 'Competente', emoji: '🦅' },
  5: { name: 'Especialista', emoji: '🏆' },
  6: { name: 'Mestre', emoji: '👑' },
};

function getLevelInfo(level: number) {
  return LEVEL_NAMES[level] || LEVEL_NAMES[1];
}

function getXpForNextLevel(level: number) {
  const thresholds = [0, 100, 300, 600, 1200, 2500, 5000];
  return thresholds[Math.min(level, thresholds.length - 1)] || 5000;
}

interface ProfileHubContentProps {
  sellerId?: string;
  isOwnProfile?: boolean;
  canSeeDetails?: boolean;
}

export function ProfileHubContent({ sellerId, isOwnProfile = true, canSeeDetails = true }: ProfileHubContentProps) {
  const { seller: currentSeller } = useAuth();
  const resolvedId = sellerId || currentSeller?.id;
  const { profile, kpis, stars, activities, loading } = useProfileData(resolvedId);
  const { balance, coins7d, coins30d, medals, loading: loadingCoins } = useCoinsAndMedals(resolvedId);

  const initials = useMemo(() => {
    if (!profile?.name) return '?';
    return profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }, [profile?.name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando perfil...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Perfil nao encontrado</p>
      </div>
    );
  }

  const levelInfo = getLevelInfo(profile.level);
  const nextLevelXp = getXpForNextLevel(profile.level + 1);
  const currentLevelXp = getXpForNextLevel(profile.level);
  const xpProgress = nextLevelXp > currentLevelXp
    ? Math.max(0, Math.min(100, Math.round(((profile.xp_total - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100)))
    : 100;

  const hasCoins = balance > 0 || coins7d > 0 || coins30d > 0;
  const hasMedals = medals.length > 0;
  const hasStars = stars && (stars.bronze_stars > 0 || stars.silver_stars > 0 || stars.gold_stars > 0);

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* ====== STORIES BAR ====== */}
      <div className="px-4 mb-3">
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 px-3 py-2">
          <ProfileStoriesBar />
        </div>
      </div>

      {/* ====== HEADER -- social profile style ====== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Cover gradient */}
        <div className="h-32 rounded-t-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 to-transparent" />
        </div>

        {/* Avatar + info overlapping */}
        <div className="px-6 -mt-14 relative z-10">
          <div className="flex items-end gap-5">
            <Avatar className="h-24 w-24 border-4 border-background shadow-xl ring-2 ring-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-extrabold tracking-tight truncate">{profile.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge className="text-xs font-medium gap-1">
                  <Briefcase className="h-3 w-3" />
                  {ROLE_LABELS[profile.role] || profile.role}
                </Badge>
                {profile.department && (
                  <Badge variant="outline" className="text-xs">
                    {DEPT_LABELS[profile.department] || profile.department}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">{profile.bio}</p>
          )}

          {/* Quick stats row */}
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/60">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-primary">{profile.level}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Nivel</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold">{(profile.xp_total - (profile.xp_spent || 0)).toLocaleString('pt-BR')}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">XP</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold">{profile.score_current}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Score</p>
            </div>
            {stars && stars.current_streak > 0 && (
              <>
                <Separator orientation="vertical" className="h-10" />
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-amber-500">{stars.current_streak}</p>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Streak</p>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ====== TABS ====== */}
      <div className="px-6 mt-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-11">
            <TabsTrigger value="overview" className="text-sm font-medium">
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Visao Geral
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-sm font-medium">
              <Trophy className="h-3.5 w-3.5 mr-1.5" /> XP & Ranking
            </TabsTrigger>
            <TabsTrigger value="reputation" className="text-sm font-medium">
              <Heart className="h-3.5 w-3.5 mr-1.5" /> Reconhecimentos
            </TabsTrigger>
          </TabsList>

          {/* -- TAB 1: VISAO GERAL -- */}
          <TabsContent value="overview" className="mt-5 space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.onTimePercent}%</p>
                      <p className="text-xs text-muted-foreground mt-1">No prazo ({kpis.completedCount} concluidas)</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-500/20 bg-red-500/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.overdueOpen}</p>
                      <p className="text-xs text-muted-foreground mt-1">Atrasadas abertas</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-500/20 bg-orange-500/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Flame className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.criticalOpen}</p>
                      <p className="text-xs text-muted-foreground mt-1">Criticas abertas</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.completedCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Concluidas (30d)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity log */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Atividade Recente
                </h3>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma atividade registrada</p>
                ) : (
                  <div className="space-y-1">
                    {activities.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-sm flex-1 truncate">
                          {ACTION_LABELS[a.action_type] || a.action_type}
                        </p>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {format(parseISO(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* -- TAB 2: XP & RANKING -- */}
          {(isOwnProfile || canSeeDetails) && (
            <TabsContent value="progress" className="mt-5 space-y-5">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                {/* Level progression */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl">{levelInfo.emoji}</span>
                      <div className="flex-1">
                        <p className="text-lg font-bold">{levelInfo.name}</p>
                        <p className="text-xs text-muted-foreground">Nivel {profile.level}</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-semibold gap-1">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        {(profile.xp_total - (profile.xp_spent || 0)).toLocaleString('pt-BR')} XP
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso para proximo nivel</span>
                        <span>{xpProgress}%</span>
                      </div>
                      <Progress value={xpProgress} className="h-2.5" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-[11px] text-muted-foreground cursor-help">
                              {profile.xp_total.toLocaleString('pt-BR')} / {nextLevelXp.toLocaleString('pt-BR')} XP
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-xs">
                              <p>+10 XP por tarefa no prazo</p>
                              <p>+20 XP por tarefa critica concluida</p>
                              <p>+5 XP por foco diario concluido</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>

                {/* Level Explanation Block */}
                <LevelExplanationBlock
                  currentLevel={profile.level}
                  xpTotal={profile.xp_total}
                  levelInfo={levelInfo}
                  nextLevelXp={nextLevelXp}
                  currentLevelXp={currentLevelXp}
                />

                {/* Score */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Score Atual</p>
                        <p className="text-3xl font-extrabold">{profile.score_current}<span className="text-lg text-muted-foreground font-normal">/100</span></p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stars */}
                {hasStars && stars && (
                  <Card>
                    <CardContent className="p-5">
                      <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" /> Estrelas Conquistadas
                      </h4>
                      <div className="flex items-center gap-6">
                        {stars.gold_stars > 0 && (
                          <div className="text-center">
                            <p className="text-3xl">🥇</p>
                            <p className="text-lg font-bold mt-1">{stars.gold_stars}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Ouro</p>
                          </div>
                        )}
                        {stars.silver_stars > 0 && (
                          <div className="text-center">
                            <p className="text-3xl">🥈</p>
                            <p className="text-lg font-bold mt-1">{stars.silver_stars}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Prata</p>
                          </div>
                        )}
                        {stars.bronze_stars > 0 && (
                          <div className="text-center">
                            <p className="text-3xl">🥉</p>
                            <p className="text-lg font-bold mt-1">{stars.bronze_stars}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Bronze</p>
                          </div>
                        )}
                        {stars.current_streak > 0 && (
                          <div className="text-center ml-auto">
                            <p className="text-3xl">🔥</p>
                            <p className="text-lg font-bold mt-1">{stars.current_streak}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Streak</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>
          )}

          {/* -- TAB 3: RECONHECIMENTOS -- */}
          <TabsContent value="reputation" className="mt-5 space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {/* H-Coins */}
              {loadingCoins ? (
                <div className="text-sm text-muted-foreground py-4">Carregando...</div>
              ) : hasCoins ? (
                <Card>
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" /> H-Coins
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                        <Coins className="h-7 w-7 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-3xl font-extrabold">{balance}</p>
                        <p className="text-xs text-muted-foreground">Saldo atual</p>
                      </div>
                      <div className="flex gap-5 text-center">
                        <div>
                          <p className="text-lg font-bold">{coins7d}</p>
                          <p className="text-[10px] text-muted-foreground">7 dias</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{coins30d}</p>
                          <p className="text-[10px] text-muted-foreground">30 dias</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-5 text-center">
                    <Coins className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">H-Coins nao ativado</p>
                  </CardContent>
                </Card>
              )}

              {/* Medals */}
              {hasMedals ? (
                <MedalsDisplay medals={medals} maxShow={12} />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-5 text-center">
                    <Award className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma medalha conquistada ainda</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
