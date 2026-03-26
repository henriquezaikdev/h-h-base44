import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Medal {
  id: string;
  code: string;
  name: string;
  tier: 'BRONZE' | 'PRATA' | 'OURO';
  description: string;
}

interface UserMedal {
  id: string;
  medal_id: string;
  earned_at: string;
  context_json: unknown;
  medal: Medal;
}

const TIER_CONFIG = {
  BRONZE: { color: 'bg-amber-700/10 text-amber-700 border-amber-700/30', emoji: '🥉' },
  PRATA: { color: 'bg-slate-400/10 text-slate-500 border-slate-400/30', emoji: '🥈' },
  OURO: { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', emoji: '🥇' },
};

interface MedalsDisplayProps {
  medals: UserMedal[];
  compact?: boolean;
  maxShow?: number;
}

export function MedalsDisplay({ medals, compact, maxShow = 6 }: MedalsDisplayProps) {
  const displayMedals = medals.slice(0, maxShow);

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Award className="h-3 w-3" /> Medalhas Recentes
        </p>
        <div className="flex flex-wrap gap-1.5">
          {displayMedals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma medalha ainda</p>
          ) : (
            displayMedals.map(um => {
              const tier = TIER_CONFIG[um.medal.tier];
              return (
                <Badge
                  key={um.id}
                  variant="outline"
                  className={`text-[10px] ${tier.color}`}
                  title={um.medal.description}
                >
                  {tier.emoji} {um.medal.name}
                </Badge>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          Medalhas Conquistadas
          <Badge variant="secondary" className="ml-auto">{medals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {medals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma medalha conquistada ainda. Continue com bom desempenho!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {displayMedals.map(um => {
              const tier = TIER_CONFIG[um.medal.tier];
              return (
                <div
                  key={um.id}
                  className={`p-3 rounded-lg border ${tier.color} flex items-start gap-3`}
                >
                  <span className="text-2xl">{tier.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{um.medal.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{um.medal.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {format(parseISO(um.earned_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
