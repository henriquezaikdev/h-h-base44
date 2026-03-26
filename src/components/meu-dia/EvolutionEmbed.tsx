import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PerformanceTab } from '@/components/evolution/PerformanceTab';
import { ComissaoNivelTab } from '@/components/evolution/ComissaoNivelTab';
import { RegrasTab } from '@/components/evolution/RegrasTab';
import { useEvolutionData } from '@/hooks/useEvolutionData';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Seller {
  id: string;
  name: string;
  role: string;
}

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
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground">Carregando evolucao...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Evolucao {selectedSeller ? `- ${selectedSeller.name}` : ''}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentMonthOrderCount} pedidos | R$ {currentMonthSales.toLocaleString('pt-BR')} em vendas
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month selector */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[120px] text-center capitalize">
              {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedDate(new Date())}>
              Mes Atual
            </Button>
          )}

          {/* Seller selector */}
          {isAdmin && sellers.length > 0 && (
            <Select value={selectedSellerId || ''} onValueChange={setSelectedSellerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-10">
          <TabsTrigger value="performance" className="text-sm">Performance</TabsTrigger>
          <TabsTrigger value="commission" className="text-sm">Comissao & Nivel</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-sm">Campanhas</TabsTrigger>
          <TabsTrigger value="rules" className="text-sm">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6">
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
        </TabsContent>

        <TabsContent value="commission" className="mt-6">
          <ComissaoNivelTab
            currentMonthSales={currentMonthSales}
            currentMonthOrderCount={currentMonthOrderCount}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground text-sm">Campanhas em breve</p>
            <p className="text-xs text-muted-foreground mt-1">Modulo de campanhas de incentivo sera adicionado aqui.</p>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RegrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
