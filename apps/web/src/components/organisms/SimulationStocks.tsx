import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VillageStock, VillageSummary } from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { StockHealthBadge } from '@/components/molecules/StockHealthBadge';
import { TrendChart } from '@/components/molecules/TrendChart';
import { useCan } from '@/hooks/useCan';
import {
  useSimulationEntities,
  useSimulationResources,
  useVillage,
  useVillageHistory,
  useVillages,
} from '@/hooks/useSimulation';
import { formatDateTime } from '@/lib/format';
import {
  entityScope,
  formatAutonomy,
  formatQuantity,
  formatRate,
  simulationErrorKey,
  stockHealth,
} from '@/lib/simulation';
import { VillagePolicyActions } from './VillagePolicyActions';
import { VillageWarehouses } from './VillageWarehouses';

const ALL = 'all';

interface SimulationStocksProps {
  /** Entity whose villages are listed (a commune, or one above it); all by default. */
  entity: string | undefined;
  /** Village picked: its stocks, its warehouses and its history are shown. */
  village: string | undefined;
  /** Resource of the table's stock columns and of the history; the first one by default. */
  resource: string | undefined;
  onEntityChange: (id: string | undefined) => void;
  onVillageChange: (id: string) => void;
  onResourceChange: (id: string) => void;
}

/**
 * The stocks of the villages (ADR 0025; villages are the simulation's nodes, the service's ADR
 * 0013): one row per village (type, population, warehouses) with its stock of a resource (all
 * its warehouses summed) against its threshold and target, its net flow, autonomy and health. A
 * picked village shows all its stocks, each of its warehouses with its own stocks and
 * capacities (the main one marked), and its last 24 hours of the resource against its threshold
 * and target.
 */
export function SimulationStocks({
  entity,
  village,
  resource,
  onEntityChange,
  onVillageChange,
  onResourceChange,
}: SimulationStocksProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const can = useCan();
  const villages = useVillages();
  const entities = useSimulationEntities();
  const resources = useSimulationResources();
  const catalogue = resources.data?.items ?? [];
  const shown = resource ?? catalogue[0]?.id;
  const shownResource = catalogue.find((r) => r.id === shown);
  const scope = useMemo(
    () => (entity ? entityScope(entities.data?.items ?? [], entity) : null),
    [entities.data, entity],
  );
  const rows = (villages.data?.items ?? []).filter((v) => !scope || scope.has(v.politicalEntityId));
  const picked = (villages.data?.items ?? []).find((v) => v.id === village);
  const detail = useVillage(picked?.id);
  const history = useVillageHistory(picked?.id, shown);
  const stockOf = (v: VillageSummary) => v.stocks.find((s) => s.resourceId === shown);
  const quantity = (value: number | null | undefined) =>
    value != null ? formatQuantity(value, locale) : t('simulation.none');
  const unitOf = (id: string) => catalogue.find((r) => r.id === id)?.unit ?? '';
  const nameOf = (id: string) => catalogue.find((r) => r.id === id)?.name ?? id;
  const number = 'text-right tabular-nums';

  if (villages.error) return <ServiceNotice message={t(simulationErrorKey(villages.error))} />;

  const historyTitle =
    picked &&
    t('simulation.stocks.history', {
      resource: shownResource?.name ?? shown,
      village: picked.name,
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <OptionSelect<string>
          label={t('simulation.stocks.entity')}
          value={entity ?? ALL}
          options={[
            { value: ALL, label: t('simulation.stocks.allEntities') },
            ...(entities.data?.items ?? []).map((e) => ({ value: e.id, label: e.name })),
          ]}
          onChange={(v) => onEntityChange(v === ALL ? undefined : v)}
          className="w-56"
        />
        <OptionSelect<string>
          label={t('simulation.stocks.resource')}
          value={shown}
          options={catalogue.map((r) => ({ value: r.id, label: r.name }))}
          onChange={onResourceChange}
          className="w-44"
        />
      </div>
      <DataTable<VillageSummary>
        label={t('simulation.stocks.villages')}
        rows={rows}
        rowKey={(v) => v.id}
        empty={villages.data ? t('simulation.none') : '…'}
        onPick={(v) => onVillageChange(v.id)}
        picked={(v) => v.id === village}
        columns={[
          { key: 'village', header: t('simulation.columns.village'), cell: (v) => v.name },
          {
            key: 'type',
            header: t('simulation.columns.type'),
            cell: (v) => v.villageType ?? t('simulation.none'),
          },
          {
            key: 'population',
            header: t('simulation.columns.population'),
            cell: (v) => formatQuantity(v.population, locale),
            className: number,
          },
          {
            key: 'warehouses',
            header: t('simulation.columns.warehouses'),
            cell: (v) => v.warehouseCount,
            className: number,
          },
          {
            key: 'stock',
            header: t('simulation.columns.available'),
            cell: (v) =>
              stockOf(v)
                ? `${formatQuantity(stockOf(v)?.available ?? 0, locale)} ${shownResource?.unit ?? ''}`
                : t('simulation.none'),
            className: number,
          },
          {
            key: 'threshold',
            header: t('simulation.columns.threshold'),
            cell: (v) => quantity(stockOf(v)?.minThreshold),
            className: number,
          },
          {
            key: 'target',
            header: t('simulation.columns.target'),
            cell: (v) => quantity(stockOf(v)?.targetLevel),
            className: number,
          },
          {
            key: 'netFlow',
            header: t('simulation.columns.netFlow'),
            cell: (v) => formatRate(stockOf(v)?.netFlowPerHour ?? 0, locale),
            className: number,
          },
          {
            key: 'autonomy',
            header: t('simulation.columns.autonomy'),
            cell: (v) => {
              const hours = stockOf(v)?.autonomyHours;
              return hours != null ? formatAutonomy(hours, locale) : t('simulation.none');
            },
            className: number,
          },
          {
            key: 'health',
            header: t('simulation.columns.health'),
            cell: (v) => (
              <StockHealthBadge
                health={stockHealth(stockOf(v))}
                label={t(`simulation.health.${stockHealth(stockOf(v))}`)}
              />
            ),
          },
        ]}
      />
      {picked ? (
        <section aria-label={picked.name} className="flex flex-col gap-4 rounded-lg border p-4">
          <h2 className="text-base font-semibold">{picked.name}</h2>
          <DataTable<VillageStock>
            label={t('simulation.panel.stocks')}
            rows={detail.data?.stocks ?? []}
            rowKey={(s) => s.resourceId}
            empty={detail.data ? t('simulation.none') : '…'}
            onPick={(s) => onResourceChange(s.resourceId)}
            picked={(s) => s.resourceId === shown}
            columns={[
              {
                key: 'resource',
                header: t('simulation.columns.resource'),
                cell: (s) => nameOf(s.resourceId),
              },
              {
                key: 'quantity',
                header: t('simulation.columns.quantity'),
                cell: (s) => `${formatQuantity(s.quantity, locale)} ${unitOf(s.resourceId)}`,
                className: number,
              },
              {
                key: 'held',
                header: t('simulation.columns.held'),
                cell: (s) => formatQuantity(s.held, locale),
                className: number,
              },
              {
                key: 'threshold',
                header: t('simulation.columns.threshold'),
                cell: (s) => quantity(s.minThreshold),
                className: number,
              },
              {
                key: 'target',
                header: t('simulation.columns.target'),
                cell: (s) => quantity(s.targetLevel),
                className: number,
              },
              {
                key: 'netFlow',
                header: t('simulation.columns.netFlow'),
                cell: (s) => formatRate(s.netFlowPerHour, locale),
                className: number,
              },
              {
                key: 'health',
                header: t('simulation.columns.health'),
                cell: (s) => (
                  <StockHealthBadge
                    health={stockHealth(s)}
                    label={t(`simulation.health.${stockHealth(s)}`)}
                  />
                ),
              },
            ]}
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{historyTitle}</h3>
              {/* Its threshold, for `simulation.manage` (ADR 0025 › Configuration). */}
              {can('simulation.manage') && shownResource && (
                <VillagePolicyActions
                  village={{ id: picked.id, name: picked.name }}
                  resource={{
                    id: shownResource.id,
                    name: shownResource.name,
                    unit: shownResource.unit,
                  }}
                />
              )}
            </div>
            <TrendChart
              label={historyTitle ?? ''}
              points={(history.data?.points ?? []).map((p) => ({
                t: Date.parse(p.tickAt),
                v: p.quantity,
              }))}
              references={[
                ...(history.data?.minThreshold != null
                  ? [
                      {
                        value: history.data.minThreshold,
                        label: t('simulation.columns.threshold'),
                        tone: 'warning' as const,
                      },
                    ]
                  : []),
                ...(history.data?.targetLevel != null
                  ? [
                      {
                        value: history.data.targetLevel,
                        label: t('simulation.columns.target'),
                        tone: 'good' as const,
                      },
                    ]
                  : []),
              ]}
              formatValue={(v) => `${formatQuantity(v, locale)} ${shownResource?.unit ?? ''}`}
              formatTime={(ms) => formatDateTime(new Date(ms).toISOString(), locale)}
              empty={history.isPending ? '…' : t('simulation.stocks.noHistory')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('simulation.panel.warehouses')}</h3>
            <VillageWarehouses village={{ id: picked.id, name: picked.name }} />
          </div>
        </section>
      ) : (
        <p className="text-sm text-fg-3">{t('simulation.stocks.pick')}</p>
      )}
    </div>
  );
}
