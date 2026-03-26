import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, ChevronLeft, ChevronRight, Bird, TrendingUp,
  Sparkles, Calendar, Users, BarChart3, Calculator, Trophy, FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PerformanceTab } from '@/components/evolution/PerformanceTab';
import { ComissaoNivelTab } from '@/components/evolution/ComissaoNivelTab';
import { RegrasTab } from '@/components/evolution/RegrasTab';
import { useEvolutionData } from '@/hooks/useEvolutionData';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Seller {
  id: string;
  name: string;
  role: string;
}

const tabConfig = [
  { value: 'performance', label: 'Performance', icon: BarChart3 },
  { value: 'commission', label: 'Comissao & Nivel', icon: Calculator },
  { value: 'campaigns', label: 'Campanhas', icon: Trophy },
  { value: 'rules', label: 'Regras', icon: FileText },
];

export function EvolutionEmbed() {
  const { seller, role } = useAuth();
  const isAdmin = role === 'owner' || role === 'admin';
  const currentSellerId = seller?.id || null;
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('performance');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();
  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();

  const {
    dailyActivities,
    currentMonthSales,
    currentMonthOrderCount,
    currentMonthTasksCompleted,
    currentMonthTasksOpen,
    workDaysInMonth,
    workDaysPassed,
    previousMonthSales,
    loading,
  } = useEvolutionData(selectedSellerId, selectedMonth, selectedYear);

  const handlePreviousMonth = () => setSelectedDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => {
    const next = addMonths(selectedDate, 1);
    if (next <= new Date()) setSelectedDate(next);
  };

  useEffect(() => {
    const fetchSellers = async () => {
      const { data } = await supabase
        .from('sellers')
        .select('id, name, role')
        .or('status.eq.ATIVO,status.is.null')
        .order('name');

      if (data) {
        setSellers(data);
        if (!selectedSellerId) {
          if (isAdmin) {
            setSelectedSellerId(data[0]?.id || null);
          } else {
            setSelectedSellerId(currentSellerId);
          }
        }
      }
    };
    fetchSellers();
  }, [currentSellerId, isAdmin, selectedSellerId]);

  const selectedSeller = sellers.find(s => s.id === selectedSellerId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground">Carregando evolucao...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com gradiente violeta */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-fuchsia-500/5 border border-violet-500/20 p-6"
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-fuchsia-500/15 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute top-4 right-6"
        >
          <Sparkles className="h-6 w-6 text-violet-400/50" />
        </motion.div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25"
            >
              <Bird className="h-7 w-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Evolucao de Vendedor</h1>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                {selectedSeller ? (
                  <span>Acompanhamento de <span className="font-medium text-foreground">{selectedSeller.name}</span></span>
                ) : (
                  <span>Gerencie a evolucao e performance da equipe</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50">
            <Calendar className="h-4 w-4 text-violet-500" />
            <span className="capitalize font-medium">
              {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Seller bar + month navigation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border/50"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Working Days */}
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="h-3.5 w-3.5 text-emerald-500" />
            {workDaysPassed} dias uteis
          </Badge>

          {/* Seller Selector (Admin only) */}
          {isAdmin && sellers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedSellerId || ''} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-[200px] bg-muted/30 border-border/50 rounded-xl">
                  <SelectValue placeholder="Selecionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/50">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 min-w-[160px] justify-center">
              <Calendar className="h-4 w-4 text-violet-500" />
              <span className="font-medium capitalize text-sm">
                {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth} disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setSelectedDate(new Date())}>
              Mes Atual
            </Button>
          )}
        </div>
      </motion.div>

      {/* Tabs com icones */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabConfig.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'performance' && (
          <PerformanceTab
            currentMonthSales={currentMonthSales}
            currentMonthOrderCount={currentMonthOrderCount}
            currentMonthTasksCompleted={currentMonthTasksCompleted}
            currentMonthTasksOpen={currentMonthTasksOpen}
            workDaysInMonth={workDaysInMonth}
            workDaysPassed={workDaysPassed}
            dailyActivities={dailyActivities}
            previousMonthSales={previousMonthSales}
          />
        )}
        {activeTab === 'commission' && (
          <ComissaoNivelTab
            currentMonthSales={currentMonthSales}
            currentMonthOrderCount={currentMonthOrderCount}
          />
        )}
        {activeTab === 'campaigns' && (
          <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
            <Trophy className="h-8 w-8 mx-auto text-amber-500/50 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">Campanhas em breve</p>
            <p className="text-xs text-muted-foreground mt-1">Modulo de campanhas de incentivo sera adicionado aqui.</p>
          </div>
        )}
        {activeTab === 'rules' && <RegrasTab />}
      </div>
    </div>
  );
}
