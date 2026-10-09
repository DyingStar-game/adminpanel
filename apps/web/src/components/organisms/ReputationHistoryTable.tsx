import { useTranslation } from 'react-i18next';
import type { ReputationEvent } from '@dyingstar-admin/contracts/social';
import { DataTable } from '@/components/molecules/DataTable';
import { formatDateTime } from '@/lib/format';

/** A player's reputation changes: when, by how much, the balance after, why. */
export function ReputationHistoryTable({ events }: { events: ReputationEvent[] }) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<ReputationEvent>
      label={t('moderation.player.reputationEvents')}
      rows={events}
      rowKey={(e) => e.id}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (e) => formatDateTime(e.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        {
          key: 'delta',
          header: t('moderation.columns.delta'),
          cell: (e) => (e.delta > 0 ? `+${e.delta}` : String(e.delta)),
          className: 'tabular-nums',
        },
        {
          key: 'balance',
          header: t('moderation.columns.reputation'),
          cell: (e) => e.balance,
          className: 'tabular-nums',
        },
        { key: 'source', header: t('moderation.columns.source'), cell: (e) => e.source },
        { key: 'reason', header: t('moderation.columns.reason'), cell: (e) => e.reason },
      ]}
    />
  );
}
