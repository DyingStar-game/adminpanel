import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from 'lucide-react';
import { EntityLink } from '@/components/molecules/EntityLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { usePanel } from '@/hooks/usePanel';
import { useSimulationNames, useSimulationOrders } from '@/hooks/useSimulation';
import { formatAmount } from '@/lib/economy';

interface MissionSimulationOriginProps {
  missionId: string;
  /** Opens the simulation's orders on the order's resource and destination. */
  onOpenOrders: (filters: { resource: string; village: string }) => void;
}

/**
 * Where a mission comes from when `universesimulator` published it (ADR 0026, its ADR 0025): the
 * supply order and the leg it carries (from one village to the next, its quantity and reward), a
 * way to the order in the Simulation section. Found among the latest 100 orders (its API filters
 * no order by mission); nothing is shown for another mission, or without `simulation.view`.
 */
export function MissionSimulationOrigin({ missionId, onOpenOrders }: MissionSimulationOriginProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const { services } = usePanel();
  const reads = services.includes('universesimulator') && can('simulation.view');
  const orders = useSimulationOrders({}, reads);
  const names = useSimulationNames();
  const found = (orders.data?.items ?? []).flatMap((order) =>
    (order.legs ?? []).filter((l) => l.missionId === missionId).map((leg) => ({ order, leg })),
  )[0];
  if (!reads || !found) return null;
  const { order, leg } = found;
  const village = (id: string | null | undefined) =>
    id ? (names.villages.get(id) ?? id) : t('simulation.map.mine');
  const resource = names.resources.get(order.resourceId)?.name ?? order.resourceId;

  return (
    <section
      aria-label={t('missions.simulation.title')}
      className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{t('missions.simulation.title')}</h2>
        <Badge variant="outline">{t(`simulation.orders.kinds.${order.kind}`)}</Badge>
        <Badge variant="outline">{t(`simulation.orders.statuses.${order.status}`)}</Badge>
        <Button
          variant="outline"
          size="xs"
          className="ml-auto"
          onClick={() =>
            onOpenOrders({ resource: order.resourceId, village: order.destinationVillageId })
          }
        >
          {t('missions.simulation.open')}
        </Button>
      </div>
      <p>
        {t('simulation.orders.heading', {
          quantity: order.quantity,
          resource,
          destination: village(order.destinationVillageId),
        })}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-2">
        {t('missions.simulation.leg', { seq: leg.seq, count: order.legs?.length ?? 1 })}
        <span>{village(leg.fromVillageId)}</span>
        <ArrowRightIcon aria-hidden size={12} className="text-fg-3" />
        <span>{village(leg.toVillageId)}</span>
        <span className="text-fg-3">
          {t('missions.simulation.carried', {
            quantity: leg.quantity,
            reward:
              leg.rewardAmount !== null && leg.rewardAmount !== undefined
                ? formatAmount(leg.rewardAmount, 'credits', i18n.language)
                : t('simulation.orders.noReward'),
          })}
        </span>
        <Badge variant="secondary">{t(`simulation.orders.legStatuses.${leg.status}`)}</Badge>
      </p>
      <span className="flex items-center gap-1.5 text-xs text-fg-3">
        {t('missions.simulation.order')}
        <EntityLink id={order.id} />
      </span>
    </section>
  );
}
