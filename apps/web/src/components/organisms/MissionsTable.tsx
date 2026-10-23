import { useTranslation } from 'react-i18next';
import type { MissionAsServed } from '@dyingstar-admin/contracts/mission';
import { DataTable } from '@/components/molecules/DataTable';
import { MissionReward } from '@/components/molecules/MissionReward';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

interface MissionsTableProps {
  missions: MissionAsServed[];
  /** A row opens its mission's page. */
  onOpen: (id: string) => void;
}

/** `mission`'s catalogue, a row per mission. */
export function MissionsTable({ missions, onOpen }: MissionsTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<MissionAsServed>
      label={t('missions.title')}
      rows={missions}
      rowKey={(m) => m.id}
      empty={t('moderation.none')}
      onPick={(m) => onOpen(m.id)}
      columns={[
        {
          key: 'title',
          header: t('missions.columns.title'),
          cell: (m) => (
            <span className="flex flex-wrap items-center gap-2">
              {m.title}
              {m.isEvent && <Badge variant="secondary">{t('missions.event')}</Badge>}
              {m.groupId && <Badge variant="outline">{t('missions.group')}</Badge>}
            </span>
          ),
        },
        {
          key: 'category',
          header: t('missions.columns.category'),
          // Older missions keep categories `mission` no longer offers: shown as stored if unknown.
          cell: (m) =>
            t(`missions.categories.${m.category}` as never, { defaultValue: m.category }),
        },
        {
          key: 'kind',
          header: t('missions.columns.kind'),
          cell: (m) => t(`missions.kinds.${m.kind}`),
        },
        {
          key: 'issuer',
          header: t('missions.columns.issuer'),
          cell: (m) => t(`missions.issuers.${m.issuerType}`),
        },
        {
          key: 'status',
          header: t('missions.columns.status'),
          cell: (m) => <Badge variant="outline">{t(`missions.status.${m.status}`)}</Badge>,
        },
        {
          key: 'reward',
          header: t('missions.columns.reward'),
          cell: (m) => <MissionReward rewards={m.rewards} compact />,
        },
        {
          key: 'places',
          header: t('missions.columns.places'),
          cell: (m) => m.maxAssignees,
          className: 'text-right tabular-nums',
        },
        {
          key: 'created',
          header: t('missions.columns.created'),
          cell: (m) => formatDateTime(m.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
      ]}
    />
  );
}
