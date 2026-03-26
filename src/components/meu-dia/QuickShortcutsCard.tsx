import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface QuickShortcutsCardProps {
  overdueCount: number;
  todayCount: number;
  upcomingCount: number;
  onScrollToOverdue?: () => void;
  onScrollToToday?: () => void;
  onScrollToUpcoming?: () => void;
}

export function QuickShortcutsCard({
  overdueCount, todayCount, upcomingCount,
  onScrollToOverdue, onScrollToToday, onScrollToUpcoming,
}: QuickShortcutsCardProps) {
  const navigate = useNavigate();

  const cards = useMemo(() => [
    { id: "overdue", label: "ATRASADAS", count: overdueCount, colorClass: overdueCount > 0 ? 'text-destructive' : 'text-foreground', onClick: onScrollToOverdue },
    { id: "today", label: "HOJE", count: todayCount, colorClass: todayCount > 0 ? 'text-status-warning' : 'text-foreground', onClick: onScrollToToday },
    { id: "upcoming", label: "PROXIMOS DIAS", count: upcomingCount, colorClass: 'text-foreground', onClick: onScrollToUpcoming },
    { id: "top20", label: "TOP 20 CLIENTES", count: undefined, colorClass: '', onClick: () => navigate("/clients?ranking=top20") },
  ], [overdueCount, todayCount, upcomingCount, navigate, onScrollToOverdue, onScrollToToday, onScrollToUpcoming]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <button key={card.id} onClick={card.onClick}
          className="h-[72px] flex flex-col justify-between p-4 rounded-xl transition-all text-left bg-card border border-border shadow-hh-sm hover:shadow-hh-md hover:border-border/80">
          <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
            {card.label}
          </span>
          {card.count !== undefined ? (
            <span className={`text-[22px] font-semibold leading-none ${card.colorClass}`}>
              {card.count}
            </span>
          ) : (
            <span className="text-[13px] font-medium text-primary">Ver &rarr;</span>
          )}
        </button>
      ))}
    </div>
  );
}
