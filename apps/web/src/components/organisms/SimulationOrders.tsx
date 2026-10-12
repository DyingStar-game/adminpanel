import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Order, OrderStatus } from '@dyingstar-admin/contracts/universesimulator';
import { LegTimeline } from '@/components/molecules/LegTimeline';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  useSimulationNames,
  useSimulationOrders,
  useSimulationResources,
  type OrderFilters,
} from '@/hooks/useSimulation';
import { useCancelOrder } from '@/hooks/useSimulationActions';
import { ApiError } from '@/lib/api';
import { formatDistance } from '@/lib/bodyMap';
import { formatAmount } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { formatQuantity, simulationErrorKey } from '@/lib/simulation';

const ALL = 'all';
const STATUSES: OrderStatus[] = ['planned', 'in_progress', 'completed', 'failed', 'cancelled'];
const OPEN: OrderStatus[] = ['planned', 'in_progress'];

interface SimulationOrdersProps {
  filters: OrderFilters;
  onFiltersChange: (next: OrderFilters) => void;
}

/**
 * Supply orders (ADR 0025): each order with its hops as a timeline (status, quantity, distance,
 * reward, mission), filtered by status, resource and village (one the order goes through). An
 * open order can be cancelled by `simulation.manage`, after confirmation: its mission is
 * cancelled in the live game and its goods released.
 */
export function SimulationOrders({ filters, onFiltersChange }: SimulationOrdersProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const can = useCan();
  const orders = useSimulationOrders(filters);
  const resources = useSimulationResources();
  const names = useSimulationNames();
  const cancel = useCancelOrder();
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const resource = (id: string) => names.resources.get(id);
  const placeName = (id: string | null) =>
    id ? (names.villages.get(id) ?? id) : t('simulation.map.mine');
  const credits = (value: number) => formatAmount(value, 'credits', locale);

  const confirmCancel = async (order: Order) => {
    setCancelling(null);
    try {
      await cancel.mutateAsync(order.id);
      toast.success(t('simulation.orders.cancelled'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('simulation.unavailable'));
    }
  };

  const filter = (
    key: keyof OrderFilters,
    label: string,
    any: string,
    options: { value: string; label: string }[],
  ) => (
    <OptionSelect<string>
      label={label}
      value={filters[key] ?? ALL}
      options={[{ value: ALL, label: any }, ...options]}
      onChange={(v) =>
        onFiltersChange({ ...filters, [key]: v === ALL ? undefined : v } as OrderFilters)
      }
      className="w-48"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {filter(
          'status',
          t('simulation.orders.status'),
          t('simulation.orders.anyStatus'),
          STATUSES.map((s) => ({ value: s, label: t(`simulation.orders.statuses.${s}`) })),
        )}
        {filter(
          'resource',
          t('simulation.orders.resource'),
          t('simulation.orders.anyResource'),
          (resources.data?.items ?? []).map((r) => ({ value: r.id, label: r.name })),
        )}
        {filter(
          'village',
          t('simulation.orders.village'),
          t('simulation.orders.anyVillage'),
          [...names.villages].map(([id, name]) => ({ value: id, label: name })),
        )}
        {orders.data && (
          <span className="text-xs text-fg-3">
            {t('simulation.orders.total', { count: orders.data.total })}
          </span>
        )}
      </div>
      {orders.isError && <ServiceNotice message={t(simulationErrorKey(orders.error))} />}
      {orders.data?.items.length === 0 && (
        <p className="text-sm text-fg-3">{t('simulation.orders.none')}</p>
      )}
      <ul className="flex flex-col gap-3">
        {(orders.data?.items ?? []).map((order) => {
          const r = resource(order.resourceId);
          const heading = t('simulation.orders.heading', {
            quantity: formatQuantity(order.quantity, locale),
            resource: r?.name ?? order.resourceId,
            destination: placeName(order.destinationVillageId),
          });
          return (
            <li
              key={order.id}
              aria-label={heading}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">{heading}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
                    <Badge variant={OPEN.includes(order.status) ? 'default' : 'secondary'}>
                      {t(`simulation.orders.statuses.${order.status}`)}
                    </Badge>
                    <Badge variant="outline">{t(`simulation.orders.kinds.${order.kind}`)}</Badge>
                    <span>{t(`simulation.orders.triggers.${order.trigger}`)}</span>
                    <span>{formatDateTime(order.createdAt, locale)}</span>
                    {order.totalReward > 0 && (
                      <span>
                        {t('simulation.orders.reward', { amount: credits(order.totalReward) })}
                      </span>
                    )}
                  </div>
                  {order.lastError && <p className="text-xs text-destructive">{order.lastError}</p>}
                </div>
                {can('simulation.manage') && OPEN.includes(order.status) && (
                  <Button variant="destructive" size="sm" onClick={() => setCancelling(order)}>
                    {t('simulation.orders.cancel')}
                  </Button>
                )}
              </div>
              <LegTimeline
                legs={order.legs ?? []}
                placeName={placeName}
                warehouseName={(id) => names.warehouses.get(id) ?? id}
                statusLabel={(s) => t(`simulation.orders.legStatuses.${s}`)}
                missionLabel={t('simulation.orders.mission')}
                facts={(leg) =>
                  t('simulation.orders.facts', {
                    quantity: `${formatQuantity(leg.quantity, locale)} ${r?.unit ?? ''}`.trim(),
                    distance: formatDistance(leg.distanceM),
                    reward:
                      leg.rewardAmount != null
                        ? credits(leg.rewardAmount)
                        : t('simulation.orders.noReward'),
                  })
                }
              />
            </li>
          );
        })}
      </ul>
      {cancelling && (
        <WriteConfirm
          open
          destructive
          title={t('simulation.orders.cancelTitle')}
          description={<p>{t('simulation.orders.cancelText')}</p>}
          confirmLabel={t('simulation.orders.cancel')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmCancel(cancelling)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
