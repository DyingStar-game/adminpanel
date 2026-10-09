import { useTranslation } from 'react-i18next';
import type { PoliticalEntitySummary } from '@dyingstar-admin/contracts/social';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

interface PoliticalEntitiesTableProps {
  entities: PoliticalEntitySummary[];
  /** Accessible name; the political entities of the directory by default. */
  label?: string;
  onOpen: (id: string) => void;
}

/** Political entities (a directory, or an entity's children), each opening its page. */
export function PoliticalEntitiesTable({ entities, label, onOpen }: PoliticalEntitiesTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<PoliticalEntitySummary>
      label={label ?? t('organisations.tabs.politics')}
      rows={entities}
      rowKey={(e) => e.id}
      empty={t('moderation.none')}
      onPick={(e) => onOpen(e.id)}
      columns={[
        { key: 'name', header: t('organisations.columns.name'), cell: (e) => e.name },
        {
          key: 'type',
          header: t('organisations.columns.level'),
          cell: (e) => (
            <Badge variant="outline">{t(`moderation.player.political.${e.type}`)}</Badge>
          ),
        },
        {
          key: 'members',
          header: t('organisations.columns.members'),
          cell: (e) => e.memberCount,
          className: 'text-right tabular-nums',
        },
        {
          key: 'since',
          header: t('organisations.columns.since'),
          cell: (e) => formatDateTime(e.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
      ]}
    />
  );
}
