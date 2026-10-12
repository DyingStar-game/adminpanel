import { XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ActiveLeg,
  Flow,
  LocalPrice,
  VillageStock,
} from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { StockHealthBadge } from '@/components/molecules/StockHealthBadge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useSimulationNames, useVillage } from '@/hooks/useSimulation';
import {
  formatAutonomy,
  formatPrice,
  formatQuantity,
  formatRate,
  simulationErrorKey,
  stockHealth,
} from '@/lib/simulation';
import { VillageConfig } from './VillageConfig';
import { VillageWarehouses } from './VillageWarehouses';

interface VillagePanelProps {
  villageId: string;
  onClose: () => void;
}

/**
 * A village of the network (ADR 0025; the simulation's nodes, the service's ADR 0013), from
 * `GET /api/simulation/villages/:id`: its stocks (all its warehouses summed) with their health,
 * its warehouses with their own stocks and capacities, its production and consumption per hour,
 * the goods on their way to it and its local prices. `simulation.manage` also edits its
 * thresholds, flows, capacities and main warehouse.
 */
export function VillagePanel({ villageId, onClose }: VillagePanelProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language;
  const detail = useVillage(villageId);
  const names = useSimulationNames();
  const resourceName = (id: string) => names.resources.get(id)?.name ?? id;
  const unit = (id: string) => names.resources.get(id)?.unit ?? '';
  const placeName = (id: string | null | undefined) =>
    id ? (names.villages.get(id) ?? id) : t('simulation.map.mine');
  const data = detail.data;
  const village = data && { id: data.village.id, name: data.village.name };
  const number = 'text-right tabular-nums';
  const heading = (text: string) => <h3 className="text-xs font-semibold text-fg-2">{text}</h3>;

  return (
    <aside
      aria-label={data?.village.name ?? villageId}
      className="flex w-120 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-background p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{data?.village.name ?? '…'}</h2>
          {data && (
            <p className="text-xs text-fg-3">
              {t('simulation.panel.facts', {
                type: data.village.villageType ?? t('simulation.none'),
                population: formatQuantity(data.village.population, locale),
                commune:
                  names.entities.get(data.village.politicalEntityId) ??
                  data.village.politicalEntityId,
              })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('simulation.panel.close')}
          title={t('simulation.panel.close')}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      {detail.isError && <ServiceNotice message={t(simulationErrorKey(detail.error))} />}
      {data && village && (
        <>
          <section className="flex flex-col gap-2">
            {heading(t('simulation.panel.stocks'))}
            <DataTable<VillageStock>
              label={t('simulation.panel.stocks')}
              rows={data.stocks}
              rowKey={(s) => s.resourceId}
              empty={t('simulation.none')}
              columns={[
                {
                  key: 'resource',
                  header: t('simulation.columns.resource'),
                  cell: (s) => (
                    <span className="flex flex-col gap-0.5">
                      {resourceName(s.resourceId)}
                      <StockHealthBadge
                        health={stockHealth(s)}
                        label={t(`simulation.health.${stockHealth(s)}`)}
                      />
                    </span>
                  ),
                },
                {
                  key: 'available',
                  header: t('simulation.columns.available'),
                  cell: (s) => `${formatQuantity(s.available, locale)} ${unit(s.resourceId)}`,
                  className: number,
                },
                {
                  key: 'threshold',
                  header: t('simulation.columns.threshold'),
                  cell: (s) =>
                    s.minThreshold != null
                      ? formatQuantity(s.minThreshold, locale)
                      : t('simulation.none'),
                  className: number,
                },
                {
                  key: 'autonomy',
                  header: t('simulation.columns.autonomy'),
                  cell: (s) =>
                    s.autonomyHours != null
                      ? formatAutonomy(s.autonomyHours, locale)
                      : t('simulation.none'),
                  className: number,
                },
              ]}
            />
          </section>
          <section className="flex flex-col gap-2">
            {heading(t('simulation.panel.warehouses'))}
            <VillageWarehouses village={village} />
          </section>
          {can('simulation.manage') ? (
            <VillageConfig village={village} />
          ) : (
            <section className="flex flex-col gap-2">
              {heading(t('simulation.panel.flows'))}
              <DataTable<Flow>
                label={t('simulation.panel.flows')}
                rows={data.flows}
                rowKey={(f) => f.id}
                empty={t('simulation.panel.noFlow')}
                columns={[
                  {
                    key: 'resource',
                    header: t('simulation.columns.resource'),
                    cell: (f) => resourceName(f.resourceId),
                  },
                  {
                    key: 'source',
                    header: t('simulation.columns.source'),
                    cell: (f) => f.label ?? t(`simulation.panel.sources.${f.source}`),
                  },
                  {
                    key: 'rate',
                    header: t('simulation.columns.rate'),
                    cell: (f) => formatRate(f.ratePerHour, locale),
                    className: number,
                  },
                ]}
              />
            </section>
          )}
          <section className="flex flex-col gap-2">
            {heading(t('simulation.panel.incoming'))}
            <DataTable<ActiveLeg>
              label={t('simulation.panel.incoming')}
              rows={data.incoming}
              rowKey={(l) => l.legId}
              empty={t('simulation.panel.noIncoming')}
              columns={[
                {
                  key: 'from',
                  header: t('simulation.columns.village'),
                  cell: (l) => placeName(l.fromVillageId),
                },
                {
                  key: 'quantity',
                  header: t('simulation.columns.quantity'),
                  cell: (l) =>
                    `${formatQuantity(l.quantity, locale)} ${resourceName(l.resourceId)}`,
                },
                {
                  key: 'status',
                  header: t('simulation.orders.status'),
                  cell: (l) => t(`simulation.orders.legStatuses.${l.status}`),
                },
              ]}
            />
          </section>
          <section className="flex flex-col gap-2">
            {heading(t('simulation.panel.prices'))}
            <DataTable<LocalPrice>
              label={t('simulation.panel.prices')}
              rows={data.localPrices}
              rowKey={(p) => p.resourceId}
              empty={t('simulation.panel.noPrice')}
              columns={[
                {
                  key: 'resource',
                  header: t('simulation.columns.resource'),
                  cell: (p) => resourceName(p.resourceId),
                },
                {
                  key: 'buy',
                  header: t('simulation.columns.buy'),
                  cell: (p) => formatPrice(p.buyPrice, locale),
                  className: number,
                },
                {
                  key: 'sell',
                  header: t('simulation.columns.sell'),
                  cell: (p) => formatPrice(p.sellPrice, locale),
                  className: number,
                },
              ]}
            />
          </section>
        </>
      )}
    </aside>
  );
}
