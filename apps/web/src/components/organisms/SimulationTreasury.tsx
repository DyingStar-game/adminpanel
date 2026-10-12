import { useTranslation } from 'react-i18next';
import type { MintEvent } from '@dyingstar-admin/contracts/universesimulator';
import { DataTable } from '@/components/molecules/DataTable';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { useMintEvents, useSimulationDashboard } from '@/hooks/useSimulation';
import { formatAmount } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { simulationErrorKey } from '@/lib/simulation';

/**
 * The federation's treasury as the simulation runs it (ADR 0025): its balance in `economie`
 * against its floor, what is escrowed for the missions on offer, and the money issued into it
 * (when an escrow was refused or the balance fell below the floor).
 */
export function SimulationTreasury() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const dashboard = useSimulationDashboard();
  const events = useMintEvents();
  const treasury = dashboard.data?.treasury;
  const currency = treasury?.currency ?? 'credits';
  const amount = (value: number) => formatAmount(value, currency, locale);
  const error = dashboard.error ?? events.error;

  if (error) return <ServiceNotice message={t(simulationErrorKey(error))} />;

  return (
    <div className="flex flex-col gap-6">
      {treasury && (
        <FactTiles
          facts={[
            {
              label: t('simulation.treasury.balance'),
              value:
                treasury.balance != null
                  ? amount(treasury.balance)
                  : t('simulation.treasury.unknown'),
              hint:
                treasury.balance != null
                  ? t('simulation.treasury.floor', { amount: amount(treasury.floor) })
                  : t('simulation.treasury.unknownHint'),
            },
            { label: t('simulation.treasury.minted24h'), value: amount(treasury.minted24h) },
            {
              label: t('simulation.treasury.escrowed'),
              value: amount(treasury.escrowed),
              hint: t('simulation.treasury.escrowedHint'),
            },
          ]}
        />
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('simulation.treasury.events')}</h2>
        <DataTable<MintEvent>
          label={t('simulation.treasury.events')}
          rows={events.data?.items ?? []}
          rowKey={(e) => e.id}
          empty={events.data ? t('simulation.treasury.none') : '…'}
          columns={[
            {
              key: 'date',
              header: t('simulation.columns.date'),
              cell: (e) => formatDateTime(e.createdAt, locale),
            },
            {
              key: 'amount',
              header: t('simulation.columns.amount'),
              cell: (e) => amount(e.amount),
              className: 'text-right tabular-nums',
            },
            { key: 'reason', header: t('simulation.columns.reason'), cell: (e) => e.reason },
          ]}
        />
      </section>
    </div>
  );
}
