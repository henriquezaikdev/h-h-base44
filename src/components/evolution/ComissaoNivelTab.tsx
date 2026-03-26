import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import type { SellerLevel, SellerError, SalesBreakdown } from '@/hooks/useEvolutionData';

const NIVEL_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  ovo: { emoji: '🥚', label: 'Ovo', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  pena: { emoji: '🪶', label: 'Pena', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  aguia: { emoji: '🦅', label: 'Aguia', color: 'bg-amber-100 text-amber-700 border-amber-300' },
};

const COMMISSION_TIERS = [
  { minMargin: 45, maxMargin: Infinity, rate: 2.0, label: 'Premium (>=45%)', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  { minMargin: 35, maxMargin: 44.99, rate: 1.3, label: 'Alta (35-44.99%)', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  { minMargin: 20, maxMargin: 34.99, rate: 1.0, label: 'Media (20-34.99%)', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  { minMargin: 0.5, maxMargin: 19.99, rate: 0.5, label: 'Baixa (0.5-19.99%)', color: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  { minMargin: 0, maxMargin: 0.49, rate: 0, label: 'Sem comissao (<0.5%)', color: 'bg-red-500/10 text-red-700 border-red-500/30' },
];

interface ComissaoNivelTabProps {
  level: SellerLevel;
  errors: SellerError[];
  salesByMargin: SalesBreakdown[];
  currentMonthSales: number;
}

export function ComissaoNivelTab({ level, errors, salesByMargin, currentMonthSales }: ComissaoNivelTabProps) {
  const nivelConfig = NIVEL_CONFIG[level.current_level] || NIVEL_CONFIG.ovo;
  const salesTarget = level.monthly_sales_target || 30000;
  const salesPct = salesTarget > 0 ? Math.min(100, Math.round((currentMonthSales / salesTarget) * 100)) : 0;

  const isBlocked = errors.length >= 4;

  // Calculate total commission estimate
  const totalCommission = salesByMargin.reduce((sum, s) => {
    const marginPct = s.margin * 100;
    const tier = COMMISSION_TIERS.find(t => marginPct >= t.minMargin);
    const rate = tier?.rate || 0;
    return sum + (s.revenue * rate / 100);
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Current Level Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center border-2", nivelConfig.color)}>
              <span className="text-4xl">{nivelConfig.emoji}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Nivel Atual</p>
              <p className="text-2xl font-bold">{nivelConfig.label}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-600">{level.consecutive_months_met}</p>
                  <p className="text-[10px] text-muted-foreground">Meses batendo meta</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-red-600">{level.consecutive_months_missed}</p>
                  <p className="text-[10px] text-muted-foreground">Meses sem bater</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress to next level */}
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta de vendas do mes</span>
              <span>{salesPct}%</span>
            </div>
            <Progress value={salesPct} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              R$ {currentMonthSales.toLocaleString('pt-BR')} / R$ {salesTarget.toLocaleString('pt-BR')}
            </p>
          </div>

          {/* Level progression info */}
          <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Proxima etapa:</span>
            </div>
            {level.current_level === 'ovo' && (
              <p className="text-xs text-muted-foreground mt-1">
                Bata a meta de vendas + 80% da meta de contatos por 2 meses consecutivos para subir para Pena.
              </p>
            )}
            {level.current_level === 'pena' && (
              <p className="text-xs text-muted-foreground mt-1">
                Bata a meta de vendas + 80% da meta de contatos por 2 meses consecutivos para subir para Aguia.
              </p>
            )}
            {level.current_level === 'aguia' && (
              <p className="text-xs text-muted-foreground mt-1">
                Voce esta no nivel maximo! Continue batendo metas para manter o nivel.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      <Card className={isBlocked ? 'border-destructive/30' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {isBlocked ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            )}
            Erros Operacionais
            <Badge variant={isBlocked ? 'destructive' : errors.length >= 3 ? 'secondary' : 'outline'} className="ml-auto">
              {errors.length}/3
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isBlocked && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-3">
              <p className="text-xs font-semibold text-destructive">Premiacao Bloqueada</p>
              <p className="text-xs text-destructive/80">4+ erros operacionais. Premiacao do mes perdida.</p>
            </div>
          )}
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Nenhum erro registrado este mes.</p>
          ) : (
            <div className="space-y-2">
              {errors.map(err => (
                <div key={err.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{err.error_type}</p>
                    {err.description && <p className="text-[10px] text-muted-foreground truncate">{err.description}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{err.error_date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Tiers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Tabela de Comissao por Margem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COMMISSION_TIERS.map((tier, i) => {
              const tierSales = salesByMargin.find(s => {
                const pct = s.margin * 100;
                return pct >= tier.minMargin;
              });
              return (
                <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border", tier.color)}>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{tier.label}</p>
                    <p className="text-xs text-muted-foreground">Comissao: {tier.rate}%</p>
                  </div>
                  {tierSales && (
                    <div className="text-right">
                      <p className="text-sm font-semibold">R$ {tierSales.revenue.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Comissao: R$ {(tierSales.revenue * tier.rate / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total estimate */}
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Comissao Estimada Total</p>
            <p className={cn("text-xl font-bold", isBlocked ? 'text-destructive line-through' : 'text-emerald-600')}>
              R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {isBlocked && (
            <p className="text-xs text-destructive mt-1 text-right">Bloqueada por erros operacionais</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
