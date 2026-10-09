import { useTranslation } from 'react-i18next';
import type { ReportView } from '@dyingstar-admin/contracts/social';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

interface PlayerReportsTableProps {
  reports: ReportView[];
  onOpenReport: (id: number) => void;
}

/** Reports against a player, each opening in the moderation queue. */
export function PlayerReportsTable({ reports, onOpenReport }: PlayerReportsTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<ReportView>
      label={t('moderation.player.reports')}
      rows={reports}
      rowKey={(r) => r.id}
      empty={t('moderation.none')}
      onPick={(r) => onOpenReport(r.id)}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (r) => formatDateTime(r.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        {
          key: 'reason',
          header: t('moderation.columns.reason'),
          cell: (r) => t(`moderation.reason.${r.reason}`),
        },
        {
          key: 'reporter',
          header: t('moderation.columns.reporter'),
          cell: (r) => r.reporterName ?? t('moderation.system'),
        },
        {
          key: 'status',
          header: t('moderation.columns.status'),
          cell: (r) => <Badge variant="outline">{t(`moderation.reportStatus.${r.status}`)}</Badge>,
        },
      ]}
    />
  );
}
