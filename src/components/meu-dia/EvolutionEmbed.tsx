import { useState, useEffect } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, TrendingUp,
  Calendar, Users, BarChart3, Calculator, Trophy, FileText
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#3B5BDB]" />
          <p className="text-sm text-gray-500">Carregando evolução...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-[#3B5BDB]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Evolução de Vendedor</h1>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-[#3B5BDB]" strokeWidth={1.5} />
                {selectedSeller ? (
                  <span>Acompanhamento de <span className="font-medium text-gray-700">{selectedSeller.name}</span></span>
                ) : (
                  <span>Gerencie a evolução e performance da equipe</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            <Calendar className="h-4 w-4 text-[#3B5BDB]" strokeWidth={1.5} />
            <span className="capitalize font-medium">
              {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Seller bar + month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Working Days */}
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 rounded-xl text-xs border-gray-200 text-gray-500">
            <Calendar className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            {workDaysPassed} dias úteis
          </Badge>

          {/* Seller Selector (Admin only) */}
          {isAdmin && sellers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <Select value={selectedSellerId || ''} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-[200px] bg-gray-50 border-gray-200 rounded-xl">
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
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <div className="flex items-center gap-2 px-3 min-w-[160px] justify-center">
              <Calendar className="h-4 w-4 text-[#3B5BDB]" strokeWidth={1.5} />
              <span className="font-medium capitalize text-sm text-gray-700">
                {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth} disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs border-gray-200 text-gray-600" onClick={() => setSelectedDate(new Date())}>
              Mês Atual
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
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
                  ? "bg-[#3B5BDB] text-white shadow-sm"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
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
          <div className="bg-white border border-gray-100 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
            <Trophy className="h-8 w-8 text-gray-300" strokeWidth={1} />
            <div>
              <p className="text-sm font-medium text-gray-700">Módulo em desenvolvimento</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Em breve você poderá criar campanhas de bonificação para sua equipe.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled className="border-gray-200 text-gray-400">
              Criar Campanha
            </Button>
          </div>
        )}
        {activeTab === 'rules' && <RegrasTab />}
      </div>
    </div>
  );
}
