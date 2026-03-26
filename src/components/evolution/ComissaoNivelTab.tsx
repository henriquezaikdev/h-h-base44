import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, Zap } from 'lucide-react';

const COMMISSION_TIERS = [
  { minMargin: 45, rate: 2.0, label: 'Premium (>=45%)', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  { minMargin: 35, rate: 1.3, label: 'Alta (35-44.99%)', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  { minMargin: 20, rate: 1.0, label: 'Media (20-34.99%)', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  { minMargin: 0.5, rate: 0.5, label: 'Baixa (0.5-19.99%)', color: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  { minMargin: 0, rate: 0, label: 'Sem comissao (<0.5%)', color: 'bg-red-500/10 text-red-700 border-red-500/30' },
];

const NIVEL_CONFIG: Record<string, { label: string; description: string; bonus: string }> = {
  ovo: { label: 'Ovo (Aprendiz)', description: 'Sem bonus de comissao', bonus: '0%' },
  pena: { label: 'Pena (Intermediario)', description: 'Bonus de +0.5% sobre comissao base', bonus: '+0.5%' },
  aguia: { label: 'Aguia (Consolidado)', description: 'Bonus de +1% sobre comissao base', bonus: '+1%' },
};

interface ComissaoNivelTabProps {
  currentMonthSales: number;
  currentMonthOrderCount: number;
}

export function ComissaoNivelTab({ currentMonthSales, currentMonthOrderCount }: ComissaoNivelTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Nivel explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Bonus de Comissao por Nivel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(NIVEL_CONFIG).map(([key, config]) => (
              <div key={key} className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                "border-border bg-card"
              )}>
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
                <span className="text-sm font-semibold">{config.bonus}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Sistema de niveis sera ativado quando as tabelas de gamificacao forem criadas.
          </p>
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
            {COMMISSION_TIERS.map((tier, i) => (
              <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border", tier.color)}>
                <div className="flex-1">
                  <p className="text-sm font-medium">{tier.label}</p>
                  <p className="text-xs text-muted-foreground">Comissao: {tier.rate}%</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Vendas este mes</p>
              <p className="text-sm font-semibold">R$ {currentMonthSales.toLocaleString('pt-BR')}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Pedidos este mes</p>
              <p className="text-sm font-semibold">{currentMonthOrderCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
