import { useTranslation } from 'react-i18next';
import type { CorporationSummary } from '@dyingstar-admin/contracts/social';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

interface CorporationsTableProps {
  corporations: CorporationSummary[];
  /** Accessible name; the corporations of the directory by default. */
  label?: string;
  onOpen: (id: string) => void;
}

/** Corporations (a directory, or a holding's subsidiaries), each opening its page. */
export function CorporationsTable({ corporations, label, onOpen }: CorporationsTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<CorporationSummary>
      label={label ?? t('organisations.tabs.corporations')}
      rows={corporations}
      rowKey={(c) => c.id}
      empty={t('moderation.none')}
      onPick={(c) => onOpen(c.id)}
      columns={[
        { key: 'name', header: t('organisations.columns.name'), cell: (c) => c.name },
        {
          key: 'ticker',
          header: t('organisations.columns.ticker'),
          cell: (c) => <MonoText>{c.ticker}</MonoText>,
        },
        {
          key: 'recruitment',
          header: t('organisations.columns.recruitment'),
          cell: (c) => (
            <Badge variant="outline">{t(`organisations.recruitment.${c.recruitment}`)}</Badge>
          ),
        },
        {
          key: 'members',
          header: t('organisations.columns.members'),
          cell: (c) => c.memberCount,
          className: 'text-right tabular-nums',
        },
        {
          key: 'since',
          header: t('organisations.columns.since'),
          cell: (c) => formatDateTime(c.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
      ]}
    />
  );
}
