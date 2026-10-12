import { HEALTH_COLORS, type StockHealth } from '@/lib/simulation';

/** A stock's health (ADR 0025): its status colour as a dot, always with its name. */
export function StockHealthBadge({ health, label }: { health: StockHealth; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-2" data-health={health}>
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: HEALTH_COLORS[health] }}
      />
      {label}
    </span>
  );
}
