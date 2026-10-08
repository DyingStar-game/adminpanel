import { useTranslation } from 'react-i18next';
import type { EconomyStats } from '@dyingstar-admin/contracts/economie';
import { Chip } from '@/components/atoms/Chip';
import { DataTable } from '@/components/molecules/DataTable';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { useCorporationNames, useEconomyStats } from '@/hooks/useEconomie';
import { usePlayerNames } from '@/hooks/useModeration';
import { formatAmount } from '@/lib/economy';
import { shortId } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';

type Holder = EconomyStats['richestPlayers'][number];
type Day = EconomyStats['series'][number];

interface EconomyDashboardProps {
  days: number;
  onOpenPlayer: (id: string) => void;
  onOpenCorporation: (id: string) => void;
}

/**
 * `economie`'s dashboard (its Admin API, `moderator`+): money supply, movements and taxes over
 * the period, the richest players, NPCs and corporations, and the days (ADR 0024 step O).
 */
export function EconomyDashboard({ days, onOpenPlayer, onOpenCorporation }: EconomyDashboardProps) {
  const { t, i18n } = useTranslation();
  const stats = useEconomyStats(days);
  const data = stats.data;
  const players = usePlayerNames([
    ...(data?.richestPlayers ?? []).map((h) => h.holderId),
    ...(data?.richestNpcs ?? []).map((h) => h.holderId),
  ]);
  const corporations = useCorporationNames(
    (data?.richestCorporations ?? []).map((h) => h.holderId),
  );
  const amount = (value: number, currency = 'credits') =>
    formatAmount(value, currency, i18n.language);

  if (stats.isError) return <ServiceNotice message={t(moderationErrorKey(stats.error))} />;
  if (!data) return <p className="text-sm text-fg-3">…</p>;

  const ranking = (
    label: string,
    rows: Holder[],
    names: Map<string, string>,
    open: (id: string) => void,
  ) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{label}</h2>
      <DataTable<Holder>
        label={label}
        rows={rows}
        rowKey={(h) => `${h.holderId}-${h.currency}`}
        empty={t('moderation.none')}
        columns={[
          {
            key: 'holder',
            header: t('players.columns.name'),
            cell: (h) => (
              <Chip variant="link" title={h.holderId} onClick={() => open(h.holderId)}>
                {h.displayName ?? names.get(h.holderId) ?? shortId(h.holderId)}
              </Chip>
            ),
          },
          {
            key: 'balance',
            header: t('economy.balance'),
            cell: (h) => amount(h.balance, h.currency),
            className: 'text-right tabular-nums',
          },
        ]}
      />
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <FactTiles
        facts={[
          ...data.moneySupply.map((m) => ({
            label: t('economy.moneySupply', { currency: m.currency }),
            value: amount(m.total, m.currency),
            hint: t('economy.accounts', { count: m.accounts }),
          })),
          {
            label: t('economy.volume', { count: days }),
            value: amount(data.transactions.period.volume),
            hint: t('economy.movements', { count: data.transactions.period.count }),
          },
          {
            label: t('economy.taxes', { count: days }),
            value: amount(data.transactions.period.tax),
          },
        ]}
      />
      <div className="grid gap-6 md:grid-cols-3">
        {ranking(t('economy.richestPlayers'), data.richestPlayers, players, onOpenPlayer)}
        {ranking(t('economy.richestNpcs'), data.richestNpcs, players, onOpenPlayer)}
        {ranking(
          t('economy.richestCorporations'),
          data.richestCorporations,
          corporations,
          onOpenCorporation,
        )}
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('economy.byDay')}</h2>
        <DataTable<Day>
          label={t('economy.byDay')}
          rows={[...data.series].reverse()}
          rowKey={(d) => d.date}
          empty={t('moderation.none')}
          columns={[
            { key: 'date', header: t('moderation.columns.date'), cell: (d) => d.date },
            {
              key: 'transactions',
              header: t('economy.movementsHeader'),
              cell: (d) => d.transactions,
              className: 'text-right tabular-nums',
            },
            {
              key: 'volume',
              header: t('economy.volumeHeader'),
              cell: (d) => amount(d.volume),
              className: 'text-right tabular-nums',
            },
            {
              key: 'tax',
              header: t('economy.tax'),
              cell: (d) => amount(d.tax),
              className: 'text-right tabular-nums',
            },
          ]}
        />
      </section>
    </div>
  );
}
