import { useTranslation } from 'react-i18next';
import type { ActivityEntry } from '@dyingstar-admin/contracts/social';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { usePlayerNames } from '@/hooks/useModeration';
import { formatDateTime, shortId } from '@/lib/format';
import { activityFamily, FAMILY_TONE } from '@/lib/socialActivity';

interface ActivityTableProps {
  entries: ActivityEntry[];
  onOpenPlayer: (id: string) => void;
  onOpenReport: (id: number) => void;
}

const asText = (value: unknown) => (typeof value === 'string' && value ? value : null);
/** Keys shown in words; any other key the game sends is shown raw. */
const SHOWN = new Set([
  'type',
  'expiresAt',
  'reportId',
  'sanctionId',
  'playerId',
  'by',
  'name',
  'rank',
  'office',
  'delta',
  'fields',
  'targetType',
  'targetId',
  'corporationId',
  'groupId',
  'entityId',
]);

/** A player's activity in `social`, readable: what happened, as a badge, and its details. */
export function ActivityTable({ entries, onOpenPlayer, onOpenReport }: ActivityTableProps) {
  const { t, i18n } = useTranslation();
  const names = usePlayerNames(
    entries.flatMap((e) => [asText(e.details?.playerId), asText(e.details?.by)]),
  );

  const player = (id: string) => (
    <Chip variant="link" title={id} onClick={() => onOpenPlayer(id)}>
      {names.get(id) ?? <MonoText>{shortId(id)}</MonoText>}
    </Chip>
  );

  const event = (entry: ActivityEntry) => {
    const family = activityFamily(entry.type);
    return family ? (
      <Badge variant="outline" className={FAMILY_TONE[family]}>
        {t(`moderation.activity.types.${entry.type}` as never)}
      </Badge>
    ) : (
      <Badge variant="outline" title={t('moderation.activity.fromGame')}>
        <MonoText>{entry.type}</MonoText>
      </Badge>
    );
  };

  const details = (entry: ActivityEntry) => {
    const d = entry.details ?? {};
    const type = asText(d.type);
    const playerId = asText(d.playerId) ?? (d.targetType === 'player' ? asText(d.targetId) : null);
    const by = asText(d.by);
    const name = asText(d.name);
    const rank = asText(d.rank);
    const office = asText(d.office);
    const expiresAt = asText(d.expiresAt);
    const reportId = typeof d.reportId === 'number' ? d.reportId : null;
    const delta = typeof d.delta === 'number' ? d.delta : null;
    const fields = Array.isArray(d.fields) ? (d.fields as unknown[]).map(String) : [];
    const rest = Object.entries(d).filter(([key]) => !SHOWN.has(key));
    const isSanction = entry.type.startsWith('sanction_');
    const parts = [
      isSanction && type && (
        <Badge
          key="type"
          variant={type === 'ban' || type === 'suspension' ? 'destructive' : 'outline'}
        >
          {t(`moderation.sanctionType.${type}` as never, { defaultValue: type })}
        </Badge>
      ),
      !isSanction && type && (
        <span key="kind">
          {t(`moderation.player.political.${type}` as never, { defaultValue: type })}
        </span>
      ),
      isSanction && type !== 'warning' && expiresAt !== null && expiresAt !== undefined && (
        <span key="expires" className="text-fg-2">
          {t('moderation.player.until', { date: formatDateTime(expiresAt, i18n.language) })}
        </span>
      ),
      name && <span key="name">{name}</span>,
      rank && <span key="rank">{t('moderation.activity.rank', { rank })}</span>,
      office && <span key="office">{t('moderation.activity.office', { office })}</span>,
      delta !== null && (
        <span key="delta" className="tabular-nums">
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ),
      fields.length > 0 && (
        <span key="fields" className="text-fg-2">
          {fields.join(', ')}
        </span>
      ),
      playerId && <span key="player">{player(playerId)}</span>,
      by && (
        <span key="by" className="flex items-center gap-1">
          {t('moderation.activity.by')} {player(by)}
        </span>
      ),
      reportId !== null && (
        <Chip key="report" variant="link" onClick={() => onOpenReport(reportId)}>
          {t('moderation.report.title', { id: reportId })}
        </Chip>
      ),
      ...rest.map(([key, value]) => (
        <MonoText key={key} tone="muted">
          {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
        </MonoText>
      )),
    ].filter(Boolean);
    return parts.length > 0 ? (
      <span className="flex flex-wrap items-center gap-2">{parts}</span>
    ) : (
      <span className="text-fg-3">—</span>
    );
  };

  return (
    <DataTable<ActivityEntry>
      label={t('moderation.player.activity')}
      rows={entries}
      rowKey={(entry) => entry.id}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (entry) => formatDateTime(entry.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        { key: 'event', header: t('moderation.columns.event'), cell: event },
        { key: 'details', header: t('moderation.columns.details'), cell: details },
      ]}
    />
  );
}
