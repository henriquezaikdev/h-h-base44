import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bird, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
    level, errors, dailyActivities, salesByMargin,
    currentMonthSales, currentMonthCalls, currentMonthWhatsapp,
    workDaysInMonth, workDaysPassed, previousMonthMet: _previousMonthMet,
    loading, refetch: _refetch,
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
        .eq('role', 'vendedor')
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

  const alerts = useMemo(() => {
    if (!level) return [];
    const alertList: { id: string; type: string; title: string; description: string; action?: string }[] = [];
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const emptyDays = dailyActivities.filter(d => d.date <= todayStr && d.total === 0).length;
    if (emptyDays >= 3) {
      alertList.push({ id: 'critical-productivity', type: 'danger', title: 'Execucao Critica', description: `${emptyDays} dias sem atividade registrada`, action: 'Bloqueia qualquer beneficio' });
    } else if (emptyDays >= 1) {
      alertList.push({ id: 'empty-days-warning', type: 'warning', title: 'Dias Vazios', description: `${emptyDays} dia(s) sem atividade registrada`, action: 'Dias sem atividade contam como falha' });
    }
    if (errors.length === 3) {
      alertList.push({ id: 'error-warning', type: 'warning', title: 'Erro Proximo do Limite', description: '3 erros registrados. O proximo bloqueia a premiacao.' });
    }
    if (errors.length >= 4) {
      alertList.push({ id: 'error-blocked', type: 'danger', title: 'Premiacao Bloqueada', description: `${errors.length} erros este mes. Premiacao perdida.` });
    }
    const salesProgress = (currentMonthSales / (level.monthly_sales_target || 30000)) * 100;
    const expectedProgress = (workDaysPassed / workDaysInMonth) * 100;
    if (salesProgress < expectedProgress * 0.7 && workDaysPassed > 5) {
      alertList.push({ id: 'sales-behind', type: 'warning', title: 'Vendas Abaixo do Esperado', description: `${salesProgress.toFixed(0)}% da meta com ${expectedProgress.toFixed(0)}% do mes`, action: 'Risco de perder sequencia' });
    }
    return alertList;
  }, [level, errors, dailyActivities, currentMonthSales, workDaysPassed, workDaysInMonth]);

  const evolutionStatus = useMemo(() => {
    if (!level) return 'stable' as const;
    if (level.consecutive_months_met > 0) return 'rising' as const;
    if (level.consecutive_months_missed > 0) return 'falling' as const;
    return 'stable' as const;
  }, [level]);

  const monthsToPromotion = level ? Math.max(0, 2 - level.consecutive_months_met) : 2;
  const monthsToDemotion = level ? Math.max(0, 2 - level.consecutive_months_missed) : 2;

  if (loading && !level) {
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
      {/* Header with seller selector and month navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Evolucao {selectedSeller ? `- ${selectedSeller.name}` : ''}
          </h2>
          {level && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Nivel: {level.current_level.toUpperCase()} - Meta: R$ {(level.monthly_sales_target || 30000).toLocaleString('pt-BR')}
            </p>
          )}
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

      {!level ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-primary/5 rounded-2xl border border-dashed border-primary/20"
        >
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Bird className="h-10 w-10 text-primary/50" />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Vendedor nao configurado</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">Configure o nivel e metas deste vendedor em Configuracoes.</p>
        </motion.div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-10">
            <TabsTrigger value="performance" className="text-sm">Performance</TabsTrigger>
            <TabsTrigger value="commission" className="text-sm">Comissao & Nivel</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-sm">Campanhas</TabsTrigger>
            <TabsTrigger value="rules" className="text-sm">Regras</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6">
            <PerformanceTab
              level={level}
              currentMonthSales={currentMonthSales}
              currentMonthCalls={currentMonthCalls}
              currentMonthWhatsapp={currentMonthWhatsapp}
              workDaysInMonth={workDaysInMonth}
              workDaysPassed={workDaysPassed}
              dailyActivities={dailyActivities}
              alerts={alerts}
              evolutionStatus={evolutionStatus}
              monthsToPromotion={monthsToPromotion}
              monthsToDemotion={monthsToDemotion}
            />
          </TabsContent>

          <TabsContent value="commission" className="mt-6">
            <ComissaoNivelTab
              level={level}
              errors={errors}
              salesByMargin={salesByMargin}
              currentMonthSales={currentMonthSales}
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
      )}
    </div>
  );
}
