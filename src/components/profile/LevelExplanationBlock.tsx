import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { HelpCircle, ChevronDown, ChevronUp, Zap, Target, Award, Star, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Iniciante', emoji: '🥚', xpMin: 0, xpMax: 99 },
  { level: 2, name: 'Aprendiz', emoji: '🐣', xpMin: 100, xpMax: 299 },
  { level: 3, name: 'Praticante', emoji: '🐥', xpMin: 300, xpMax: 599 },
  { level: 4, name: 'Competente', emoji: '🦅', xpMin: 600, xpMax: 1199 },
  { level: 5, name: 'Especialista', emoji: '🏆', xpMin: 1200, xpMax: 2499 },
  { level: 6, name: 'Mestre', emoji: '👑', xpMin: 2500, xpMax: 4999 },
];

const XP_RULES: { action: string; xp: string; icon: LucideIcon }[] = [
  { action: 'Tarefa concluida no prazo', xp: '+10', icon: Target },
  { action: 'Tarefa concluida com atraso', xp: '+3', icon: Target },
  { action: 'Cotacao aprovada', xp: '+40', icon: TrendingUp },
  { action: 'Ordem de compra criada', xp: '+15', icon: TrendingUp },
  { action: 'Acao no feed de compras', xp: '+5', icon: TrendingUp },
  { action: 'Medalha de Bronze', xp: '+30', icon: Award },
  { action: 'Medalha de Prata', xp: '+90', icon: Award },
  { action: 'Medalha de Ouro', xp: '+250', icon: Award },
  { action: 'H-Coin recebida', xp: '+3 cada', icon: Star },
  { action: 'Meta de categoria atingida', xp: '+100', icon: Star },
  { action: 'Perfil completo', xp: '+5', icon: Zap },
  { action: 'Foto de entrega (entregador)', xp: '+5', icon: Zap },
];

interface Props {
  currentLevel: number;
  xpTotal: number;
  levelInfo: { name: string; emoji: string };
  nextLevelXp: number;
  currentLevelXp: number;
}

export function LevelExplanationBlock({ currentLevel, xpTotal, levelInfo, nextLevelXp }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const xpRemaining = Math.max(0, nextLevelXp - xpTotal);
  const isMaxLevel = currentLevel >= 6;

  return (
    <>
      {/* Compact explanation block */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Como funciona seu nivel</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setShowHelp(true)}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Quick summary - always visible */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-background/80 border border-border/40 p-2.5 text-center">
              <p className="text-lg font-bold">{levelInfo.emoji} {currentLevel}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Nivel atual</p>
            </div>
            <div className="rounded-xl bg-background/80 border border-border/40 p-2.5 text-center">
              <p className="text-lg font-bold">{xpTotal.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">XP total</p>
            </div>
            <div className="rounded-xl bg-background/80 border border-border/40 p-2.5 text-center">
              <p className="text-lg font-bold text-primary">
                {isMaxLevel ? '✓' : xpRemaining.toLocaleString('pt-BR')}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {isMaxLevel ? 'Nivel max.' : 'XP restante'}
              </p>
            </div>
          </div>

          {/* Expanded content */}
          {expanded && (
            <div className="mt-4 space-y-3">
              {/* Level roadmap */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mapa de niveis</p>
              <div className="space-y-1.5">
                {LEVEL_THRESHOLDS.map((lt) => {
                  const isCurrent = lt.level === currentLevel;
                  const isPast = lt.level < currentLevel;
                  return (
                    <div
                      key={lt.level}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isCurrent
                          ? 'bg-primary/10 border border-primary/20'
                          : isPast
                            ? 'opacity-50'
                            : 'opacity-70'
                      }`}
                    >
                      <span className="text-base w-6 text-center">{lt.emoji}</span>
                      <span className={`flex-1 ${isCurrent ? 'font-semibold' : ''}`}>
                        Nivel {lt.level} -- {lt.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {lt.xpMin.toLocaleString('pt-BR')} - {lt.xpMax.toLocaleString('pt-BR')} XP
                      </Badge>
                      {isCurrent && (
                        <Badge className="text-[10px]">Voce</Badge>
                      )}
                      {isPast && (
                        <span className="text-[10px] text-emerald-600 font-medium">ok</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Top XP actions */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Como ganhar XP</p>
              <div className="grid grid-cols-1 gap-1">
                {XP_RULES.slice(0, 6).map((rule, i) => {
                  const Icon = rule.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm hover:bg-muted/40 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs">{rule.action}</span>
                      <span className="text-xs font-semibold text-emerald-600">{rule.xp}</span>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowHelp(true)}>
                Ver todas as regras de XP
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Help Modal */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Entender Niveis & XP
          </DialogTitle>

          <div className="space-y-5 mt-2">
            <div>
              <h4 className="text-sm font-semibold mb-1.5">O que e XP?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                XP (Pontos de Experiencia) e a moeda de evolucao do sistema. Voce acumula XP ao concluir tarefas,
                fechar cotacoes, receber reconhecimentos e atingir metas. Quanto mais XP, maior seu nivel.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-1.5">Como funciona o nivel?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seu nivel e calculado automaticamente com base no XP acumulado. Ao atingir a faixa de XP
                necessaria, voce sobe de nivel. A barra de progresso mostra quanto falta para o proximo.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Faixas de Nivel</h4>
              <div className="space-y-1">
                {LEVEL_THRESHOLDS.map((lt) => (
                  <div
                    key={lt.level}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                      lt.level === currentLevel ? 'bg-primary/10 font-semibold' : ''
                    }`}
                  >
                    <span>{lt.emoji}</span>
                    <span className="flex-1">{lt.name}</span>
                    <span className="font-mono text-muted-foreground">{lt.xpMin} - {lt.xpMax}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Todas as Regras de XP</h4>
              <div className="space-y-1">
                {XP_RULES.map((rule, i) => {
                  const Icon = rule.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-muted/40 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">{rule.action}</span>
                      <span className="font-semibold text-emerald-600">{rule.xp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
