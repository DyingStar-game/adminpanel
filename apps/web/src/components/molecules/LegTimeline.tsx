import { ArrowRightIcon } from 'lucide-react';
import type { Leg } from '@dyingstar-admin/contracts/universesimulator';
import { MonoText } from '@/components/atoms/MonoText';
import { Badge } from '@/components/ui/badge';

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
  /** Name of a warehouse (where the goods are held, where they are delivered). */
  warehouseName: (id: string) => string;
  statusLabel: (status: Leg['status']) => string;
  /** The facts of a leg, formatted by the caller (quantity, distance, reward). */
  facts: (leg: Leg) => string;
  missionLabel: string;
}

/**
 * The hops of a supply order as a timeline (ADR 0025): each leg from one village to the next
 * (the warehouses holding and receiving the goods under them, once chosen),
 * its status, its facts and the mission it was published as.
 */
export function LegTimeline({
  legs,
  placeName,
  warehouseName,
  statusLabel,
  facts,
  missionLabel,
}: LegTimelineProps) {
  return (
    <ol className="flex flex-col gap-0">
      {[...legs]
        .sort((a, b) => a.seq - b.seq)
        .map((leg, i, all) => (
          <li key={leg.id} className="relative flex gap-3 pb-3 last:pb-0">
            <span className="flex flex-col items-center">
              <span
                className={
                  leg.status === 'completed'
                    ? 'grid size-5 place-items-center rounded-full bg-success/20 text-2xs text-success'
                    : leg.status === 'published' || leg.status === 'held'
                      ? 'grid size-5 place-items-center rounded-full bg-link-bg text-2xs text-link'
                      : 'grid size-5 place-items-center rounded-full border text-2xs text-fg-3'
                }
              >
                {leg.seq}
              </span>
              {i < all.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{placeName(leg.fromVillageId ?? null)}</span>
                <ArrowRightIcon aria-hidden size={12} className="text-fg-3" />
                <span>{placeName(leg.toVillageId)}</span>
                <Badge variant={STATUS_VARIANT[leg.status]}>{statusLabel(leg.status)}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-fg-3">
                <span>{facts(leg)}</span>
                {(leg.fromWarehouseId || leg.toWarehouseId) && (
                  <span>
                    {[leg.fromWarehouseId, leg.toWarehouseId]
                      .map((id) => (id ? warehouseName(id) : '…'))
                      .join(' → ')}
                  </span>
                )}
                {leg.missionId && (
                  <span>
                    {missionLabel} <MonoText tone="muted">{leg.missionId}</MonoText>
                  </span>
                )}
              </div>
              {leg.lastError && <p className="text-xs text-destructive">{leg.lastError}</p>}
            </div>
          </li>
        ))}
    </ol>
  );
}
