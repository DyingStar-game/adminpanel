import { useTranslation } from 'react-i18next';
import type { LocalPrice, PriceIndex } from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { TrendChart } from '@/components/molecules/TrendChart';
import {
  useLocalPrices,
  usePriceHistories,
  usePriceIndices,
  useSimulationNames,
} from '@/hooks/useSimulation';
import { formatDateTime } from '@/lib/format';
import { formatPrice, formatQuantity, simulationErrorKey } from '@/lib/simulation';

interface SimulationPricesProps {
  /** Resource whose local prices are listed. */
  resource: string | undefined;
  onResourceChange: (id: string) => void;
}

/**
 * Prices of the federation (ADR 0025): its index per resource (unit price, supply against
 * demand, the last day as a trend line), then, for the resource picked, the buy and sell prices
 * of each village, the largest spread first (as `universesimulator` sorts them).
 */
export function SimulationPrices({ resource, onResourceChange }: SimulationPricesProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const indices = usePriceIndices();
  const names = useSimulationNames();
  const rows = indices.data?.items ?? [];
  const histories = usePriceHistories(rows.map((p) => p.resourceId));
  const local = useLocalPrices(resource);
  const resourceName = (id: string) => names.resources.get(id)?.name ?? id;
  const time = (ms: number) => formatDateTime(new Date(ms).toISOString(), locale);
  const number = 'text-right tabular-nums';

  if (indices.isError) return <ServiceNotice message={t(simulationErrorKey(indices.error))} />;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('simulation.prices.index')}</h2>
        <DataTable<PriceIndex>
          label={t('simulation.prices.index')}
          rows={rows}
          rowKey={(p) => p.resourceId}
          empty={indices.data ? t('simulation.none') : '…'}
          onPick={(p) => onResourceChange(p.resourceId)}
          picked={(p) => p.resourceId === resource}
          columns={[
            {
              key: 'resource',
              header: t('simulation.columns.resource'),
              cell: (p) => resourceName(p.resourceId),
            },
            {
              key: 'unitPrice',
              header: t('simulation.columns.unitPrice'),
              cell: (p) => formatPrice(p.unitPrice, locale),
              className: number,
            },
            {
              key: 'supplyDemand',
              header: t('simulation.columns.supplyDemand'),
              cell: (p) =>
                `${formatQuantity(p.supply, locale)} / ${formatQuantity(p.demand, locale)}${
                  p.demand > 0 ? ` (${formatPrice(p.supply / p.demand, locale)})` : ''
                }`,
              className: number,
            },
            {
              key: 'trend',
              header: t('simulation.columns.trend'),
              cell: (p) => {
                const history = histories[rows.indexOf(p)]?.data;
                return (
                  <TrendChart
                    size="compact"
                    fromZero={false}
                    label={t('simulation.prices.history', { resource: resourceName(p.resourceId) })}
                    points={(history?.points ?? []).map((h) => ({
                      t: Date.parse(h.computedAt),
                      v: h.unitPrice,
                    }))}
                    formatValue={(v) => formatPrice(v, locale)}
                    formatTime={time}
                    empty={history ? t('simulation.none') : '…'}
                  />
                );
              },
            },
          ]}
        />
      </section>
      <section className="flex flex-col gap-2">
        {resource ? (
          <>
            <h2 className="text-sm font-semibold">
              {t('simulation.prices.local', { resource: resourceName(resource) })}
            </h2>
            {local.isError && <ServiceNotice message={t(simulationErrorKey(local.error))} />}
            <DataTable<LocalPrice>
              label={t('simulation.prices.local', { resource: resourceName(resource) })}
              rows={local.data?.items ?? []}
              rowKey={(p) => p.villageId}
              empty={local.data ? t('simulation.prices.noLocal') : '…'}
              columns={[
                {
                  key: 'village',
                  header: t('simulation.columns.village'),
                  cell: (p) => names.villages.get(p.villageId) ?? p.villageId,
                },
                {
                  key: 'factor',
                  header: t('simulation.columns.factor'),
                  cell: (p) => formatPrice(p.localFactor, locale),
                  className: number,
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
                {
                  key: 'spread',
                  header: t('simulation.columns.spread'),
                  cell: (p) => formatPrice(p.sellPrice - p.buyPrice, locale),
                  className: number,
                },
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-fg-3">{t('simulation.prices.pick')}</p>
        )}
      </section>
    </div>
  );
}
