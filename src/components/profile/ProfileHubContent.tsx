import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileData, ROLE_LABELS, DEPT_LABELS } from '@/hooks/useProfileData';
import { ProfileStoriesBar } from './ProfileStoriesBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  AlertTriangle,
  Briefcase,
  Eye,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfileHubContentProps {
  sellerId?: string;
  isOwnProfile?: boolean;
  canSeeDetails?: boolean;
}

export function ProfileHubContent({ sellerId, isOwnProfile = true, canSeeDetails = true }: ProfileHubContentProps) {
  const { seller: currentSeller } = useAuth();
  const resolvedId = sellerId || currentSeller?.id;
  const { profile, kpis, loading } = useProfileData(resolvedId);

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

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Stories Bar */}
      <div className="px-4 mb-3">
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 px-3 py-2">
          <ProfileStoriesBar />
        </div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="h-32 rounded-t-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 to-transparent" />
        </div>

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

          {/* Quick stats */}
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/60">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-primary">{kpis.completedTasks}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Concluidas</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold">{kpis.openTasks}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Abertas</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold">{kpis.overdueTasks}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Atrasadas</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="px-6 mt-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-11">
            <TabsTrigger value="overview" className="text-sm font-medium">
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Visao Geral
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-sm font-medium">
              <Trophy className="h-3.5 w-3.5 mr-1.5" /> Metricas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VISAO GERAL */}
          <TabsContent value="overview" className="mt-5 space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.completedTasks}</p>
                      <p className="text-xs text-muted-foreground mt-1">Tarefas concluidas</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-500/20 bg-red-500/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.overdueTasks}</p>
                      <p className="text-xs text-muted-foreground mt-1">Atrasadas abertas</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/[0.03]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.openTasks}</p>
                      <p className="text-xs text-muted-foreground mt-1">Abertas</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">{kpis.totalTasks}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total de tarefas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 2: METRICAS */}
          {(isOwnProfile || canSeeDetails) && (
            <TabsContent value="progress" className="mt-5 space-y-5">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold mb-4">Resumo de Desempenho</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Taxa de conclusao</span>
                        <span className="text-sm font-semibold">
                          {kpis.totalTasks > 0 ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tarefas abertas</span>
                        <span className="text-sm font-semibold">{kpis.openTasks}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tarefas atrasadas</span>
                        <span className="text-sm font-semibold text-destructive">{kpis.overdueTasks}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">Gamificacao (XP, Nivel, Medalhas) sera ativada em breve</p>
                  <p className="text-xs text-muted-foreground mt-1">Quando as tabelas de gamificacao forem criadas, os dados aparecerao aqui.</p>
                </div>
              </motion.div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
