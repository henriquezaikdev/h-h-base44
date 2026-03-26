import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookOpen, TrendingUp, TrendingDown, AlertTriangle, Coins, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export function RegrasTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl"
    >
      {/* How to Level Up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" /> Como Subir de Nivel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🥚</span>
              <div>
                <p className="text-sm font-semibold">Ovo &rarr; Pena</p>
                <p className="text-xs text-muted-foreground">
                  Atingir meta de vendas + 80% da meta de contatos por 2 meses consecutivos.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪶</span>
              <div>
                <p className="text-sm font-semibold">Pena &rarr; Aguia</p>
                <p className="text-xs text-muted-foreground">
                  Atingir meta de vendas + 80% da meta de contatos por 2 meses consecutivos.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs font-semibold text-emerald-700">Criterios para Promocao:</p>
            <ul className="text-xs text-muted-foreground mt-1.5 space-y-1 list-disc list-inside">
              <li>Vendas: atingir 100% da meta mensal de vendas</li>
              <li>Contatos: atingir pelo menos 80% da meta de ligacoes + WhatsApp</li>
              <li>Consistencia: manter por 2 meses seguidos</li>
              <li>O nivel e sincronizado automaticamente via trigger</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* How to Level Down */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" /> Como Descer de Nivel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Falhar em atingir as metas por 2 meses consecutivos resulta em rebaixamento.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🦅</span>
              <div>
                <p className="text-sm font-semibold">Aguia &rarr; Pena</p>
                <p className="text-xs text-muted-foreground">2 meses consecutivos sem bater meta</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪶</span>
              <div>
                <p className="text-sm font-semibold">Pena &rarr; Ovo</p>
                <p className="text-xs text-muted-foreground">2 meses consecutivos sem bater meta</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Erros Operacionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Erros operacionais sao registrados pela gestao e impactam diretamente na premiacao.
          </p>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Limite: 3 por mes</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Com ate 3 erros no mes, voce mantem sua premiacao normalmente.
            </p>
            <p className="text-xs text-destructive font-semibold">
              A partir de 4 erros, a premiacao do mes e completamente bloqueada.
            </p>
          </div>

          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tipos de erro:</p>
            <div className="grid grid-cols-2 gap-2">
              {['Produto Errado', 'Falta de Retorno', 'Pedido Errado', 'Informacao Errada'].map(tipo => (
                <div key={tipo} className="p-2 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-xs">{tipo}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" /> Modelo de Comissao
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A comissao e calculada sobre o valor de cada venda, de acordo com a margem real do pedido.
          </p>

          <div className="space-y-1.5">
            {[
              { range: '>= 45%', rate: '2.0%', color: 'bg-emerald-500/10 border-emerald-500/30' },
              { range: '35 - 44.99%', rate: '1.3%', color: 'bg-blue-500/10 border-blue-500/30' },
              { range: '20 - 34.99%', rate: '1.0%', color: 'bg-amber-500/10 border-amber-500/30' },
              { range: '0.5 - 19.99%', rate: '0.5%', color: 'bg-orange-500/10 border-orange-500/30' },
              { range: '< 0.5%', rate: '0%', color: 'bg-red-500/10 border-red-500/30' },
            ].map((tier) => (
              <div key={tier.range} className={`flex items-center justify-between p-3 rounded-lg border ${tier.color}`}>
                <span className="text-sm">Margem {tier.range}</span>
                <Badge variant="outline" className="font-mono text-sm">{tier.rate}</Badge>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs font-semibold mb-1">Bonus por Nivel:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Ovo: sem bonus adicional</li>
              <li>Pena: +0.1% sobre todas as faixas</li>
              <li>Aguia: +0.2% sobre todas as faixas</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Stars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" /> Sistema de Estrelas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estrelas sao conquistadas por consistencia no cumprimento de metas diarias.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-700/5 border border-amber-700/20">
              <span className="text-2xl">🥉</span>
              <div>
                <p className="text-sm font-semibold">Bronze</p>
                <p className="text-xs text-muted-foreground">3 dias consecutivos batendo meta</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-400/5 border border-slate-400/20">
              <span className="text-2xl">🥈</span>
              <div>
                <p className="text-sm font-semibold">Prata</p>
                <p className="text-xs text-muted-foreground">5 estrelas bronze = 1 estrela prata</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <span className="text-2xl">🥇</span>
              <div>
                <p className="text-sm font-semibold">Ouro</p>
                <p className="text-xs text-muted-foreground">5 estrelas prata = 1 estrela ouro</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs font-semibold mb-1">Criterio diario:</p>
            <p className="text-xs text-muted-foreground">
              Ligacoes + WhatsApp atingidos + zero erros no dia. Vendas sao bonus, nao obrigatorias para a estrela.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* General Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Regras Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>- Metas diarias sao calculadas a partir da configuracao de dias uteis do mes.</p>
            <p>- Meta do dia = Meta do mes / dias uteis (arredondado para cima).</p>
            <p>- Contatos = Interacoes (ligacoes/whatsapp) + Tarefas concluidas.</p>
            <p>- O nivel e sincronizado automaticamente via trigger no banco de dados.</p>
            <p>- Dias sem nenhuma atividade contam como falha na execucao.</p>
            <p>- 3+ dias sem atividade = execucao critica (bloqueia beneficios).</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
