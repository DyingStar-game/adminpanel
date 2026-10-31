import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Order, OrderStatus } from '@dyingstar-admin/contracts/universesimulator';
import { EntityLink } from '@/components/molecules/EntityLink';
import { FactList } from '@/components/molecules/FactList';
import { IdLabel } from '@/components/molecules/IdLabel';
import { LegTimeline } from '@/components/molecules/LegTimeline';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { LegMission } from './LegMission';
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
import { usePanel } from '@/hooks/usePanel';

const ALL = 'all';
const STATUSES: OrderStatus[] = ['planned', 'in_progress', 'completed', 'failed', 'cancelled'];
const OPEN: OrderStatus[] = ['planned', 'in_progress'];

interface SimulationOrdersProps {
  filters: OrderFilters;
  onFiltersChange: (next: OrderFilters) => void;
  /** Opens a leg's mission; shown as a link only for who reads `mission` (ADR 0026). */
  onOpenMission?: ((missionId: string) => void) | undefined;
}

/**
 * Supply orders (ADR 0025): each order, its facts, and its hops as a timeline laid out as a
 * mission's objectives (status, quantity, distance, reward, warehouses, mission), filtered by status, resource and village (one the order goes through). An
 * open order can be cancelled by `simulation.manage`, after confirmation: its mission is
 * cancelled in the live game and its goods released.
 */
export function SimulationOrders({
  filters,
  onFiltersChange,
  onOpenMission,
}: SimulationOrdersProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const can = useCan();
  const { services } = usePanel();
  const opensMissions = services.includes('mission') && can('mission.read');
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
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{heading}</h3>
                  <Badge variant={OPEN.includes(order.status) ? 'default' : 'secondary'}>
                    {t(`simulation.orders.statuses.${order.status}`)}
                  </Badge>
                  <Badge variant="outline">{t(`simulation.orders.kinds.${order.kind}`)}</Badge>
                </div>
                {can('simulation.manage') && OPEN.includes(order.status) && (
                  <Button variant="destructive" size="sm" onClick={() => setCancelling(order)}>
                    {t('simulation.orders.cancel')}
                  </Button>
                )}
              </div>
              <FactList
                columns={2}
                facts={[
                  [
                    t('simulation.orders.trigger'),
                    t(`simulation.orders.triggers.${order.trigger}`),
                  ],
                  [t('simulation.orders.created'), formatDateTime(order.createdAt, locale)],
                  ...(order.totalReward > 0
                    ? [
                        [t('simulation.orders.totalReward'), credits(order.totalReward)] as [
                          string,
                          ReactNode,
                        ],
                      ]
                    : []),
                  [t('simulation.orders.order'), <IdLabel key="id" id={order.id} />],
                ]}
              />
              {order.lastError && <p className="text-xs text-destructive">{order.lastError}</p>}
              <LegTimeline
                legs={order.legs ?? []}
                placeName={placeName}
                statusLabel={(s) => t(`simulation.orders.legStatuses.${s}`)}
                facts={(leg) => {
                  const facts: [string, ReactNode][] = [
                    [
                      t('simulation.orders.quantity'),
                      `${formatQuantity(leg.quantity, locale)} ${r?.unit ?? ''}`.trim(),
                    ],
                    [t('simulation.orders.distance'), formatDistance(leg.distanceM)],
                    [
                      t('simulation.orders.legReward'),
                      leg.rewardAmount != null ? (
                        credits(leg.rewardAmount)
                      ) : (
                        <span className="text-fg-3">{t('simulation.orders.rewardNotSet')}</span>
                      ),
                    ],
                  ];
                  if (leg.fromWarehouseId || leg.toWarehouseId) {
                    facts.push([
                      t('simulation.orders.warehouses'),
                      [leg.fromWarehouseId, leg.toWarehouseId]
                        .map((id) => (id ? (names.warehouses.get(id) ?? id) : '…'))
                        .join(' → '),
                    ]);
                  }
                  if (leg.missionId) {
                    // The missions on offer by their title and status; the others by their id.
                    facts.push([
                      t('simulation.orders.mission'),
                      opensMissions && leg.status === 'published' ? (
                        <LegMission missionId={leg.missionId} onOpenMission={onOpenMission} />
                      ) : (
                        <EntityLink
                          id={leg.missionId}
                          onOpen={opensMissions ? onOpenMission : undefined}
                        />
                      ),
                    ]);
                  }
                  return facts;
                }}
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
