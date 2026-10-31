import type { ReactNode } from 'react';
import { ArrowRightIcon } from 'lucide-react';
import type { Leg } from '@dyingstar-admin/contracts/universesimulator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { FactList } from './FactList';

const STATUS_VARIANT: Record<Leg['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  waiting: 'outline',
  pending: 'outline',
  held: 'secondary',
  published: 'default',
  completed: 'secondary',
  failed: 'destructive',
  cancelled: 'destructive',
};

interface LegTimelineProps {
  /** Legs of one order, in their hop order. */
  legs: Leg[];
  /** Name of a village; `null` is a mining leg's origin (the mineral source). */
  placeName: (id: string | null) => string;
  statusLabel: (status: Leg['status']) => string;
  /**
   * The facts of a leg as labelled pairs, formatted by the caller (quantity, distance, reward,
   * warehouses, the mission it was published as).
   */
  facts: (leg: Leg) => [label: string, value: ReactNode][];
}

/**
 * The hops of a supply order as a timeline (ADR 0025), each laid out as a mission's objective
 * (ADR 0026): its step, from one village to the next, its status, then its facts label by label.
 */
export function LegTimeline({ legs, placeName, statusLabel, facts }: LegTimelineProps) {
  return (
    <ol className="flex flex-col gap-0">
      {[...legs]
        .sort((a, b) => a.seq - b.seq)
        .map((leg, i, all) => (
          <li key={leg.id} className="relative flex gap-3 pb-4 last:pb-0">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                  leg.status === 'completed'
                    ? 'bg-success/20 text-success'
                    : leg.status === 'published' || leg.status === 'held'
                      ? 'bg-link-bg text-link'
                      : 'border text-fg-3',
                )}
              >
                {leg.seq}
              </span>
              {i < all.length - 1 && <span aria-hidden className="mt-1 w-px flex-1 bg-border" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  {placeName(leg.fromVillageId ?? null)}
                  <ArrowRightIcon aria-hidden size={12} className="text-fg-3" />
                  {placeName(leg.toVillageId)}
                </h4>
                <Badge variant={STATUS_VARIANT[leg.status]}>{statusLabel(leg.status)}</Badge>
              </div>
              <FactList facts={facts(leg)} columns={2} />
              {leg.lastError && <p className="text-xs text-destructive">{leg.lastError}</p>}
            </div>
          </li>
        ))}
    </ol>
  );
}
