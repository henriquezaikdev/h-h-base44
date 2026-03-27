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
        <div className="animate-pulse text-gray-500">Carregando perfil...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">Perfil não encontrado</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Stories Bar */}
      <div className="px-4 mb-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2">
          <ProfileStoriesBar />
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="h-24 rounded-t-2xl bg-indigo-50 border-b border-indigo-100" />

        <div className="px-6 -mt-12 relative z-10">
          <div className="flex items-end gap-5">
            <Avatar className="h-24 w-24 border-4 border-white shadow-sm ring-2 ring-indigo-100">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-indigo-50 text-[#3B5BDB] text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-extrabold tracking-tight truncate text-gray-900">{profile.name}</h1>
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
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-[#3B5BDB]">{kpis.completedTasks}</p>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Concluídas</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-gray-900">{kpis.openTasks}</p>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Abertas</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-gray-900">{kpis.overdueTasks}</p>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Atrasadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-11">
            <TabsTrigger value="overview" className="text-sm font-medium">
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-sm font-medium">
              <Trophy className="h-3.5 w-3.5 mr-1.5" /> Métricas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VISÃO GERAL */}
          <TabsContent value="overview" className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-gray-100 bg-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-5 w-5 text-[#3B5BDB]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-gray-900">{kpis.completedTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">Tarefas concluídas</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-100 bg-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-gray-900">{kpis.overdueTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">Atrasadas abertas</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-100 bg-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-5 w-5 text-[#3B5BDB]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-gray-900">{kpis.openTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">Abertas</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-100 bg-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-gray-900">{kpis.totalTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">Total de tarefas</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: MÉTRICAS */}
          {(isOwnProfile || canSeeDetails) && (
            <TabsContent value="progress" className="mt-5 space-y-5">
              <Card className="border-gray-100">
                <CardContent className="p-5">
                  <h4 className="text-sm font-semibold mb-4 text-gray-900">Resumo de Desempenho</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Taxa de conclusão</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {kpis.totalTasks > 0 ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Tarefas abertas</span>
                      <span className="text-sm font-semibold text-gray-900">{kpis.openTasks}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Tarefas atrasadas</span>
                      <span className="text-sm font-semibold text-red-600">{kpis.overdueTasks}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">Gamificação (XP, Nível, Medalhas) será ativada em breve</p>
                <p className="text-xs text-gray-400 mt-1">Quando as tabelas de gamificação forem criadas, os dados aparecerão aqui.</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
