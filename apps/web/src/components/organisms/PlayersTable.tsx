import { useTranslation } from 'react-i18next';
import type { PlayerProfile } from '@dyingstar-admin/contracts/social';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

interface PlayersTableProps {
  players: PlayerProfile[];
  onOpenPlayer: (id: string) => void;
}

/** Players and NPCs found by name, each opening its moderation sheet. */
export function PlayersTable({ players, onOpenPlayer }: PlayersTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<PlayerProfile>
      label={t('players.title')}
      rows={players}
      rowKey={(p) => p.playerId}
      empty={t('players.none')}
      onPick={(p) => onOpenPlayer(p.playerId)}
      columns={[
        { key: 'name', header: t('players.columns.name'), cell: (p) => p.displayName },
        {
          key: 'kind',
          header: t('players.kind'),
          cell: (p) => (
            <Badge variant="outline">{t(`moderation.player.kind.${p.entityType}`)}</Badge>
          ),
        },
        {
          key: 'reputation',
          header: t('moderation.columns.reputation'),
          cell: (p) => p.reputation,
          className: 'text-right tabular-nums',
        },
        {
          key: 'playtime',
          header: t('moderation.player.playtime'),
          cell: (p) =>
            t('moderation.player.hours', { count: Math.round(p.playtimeSeconds / 3600) }),
          className: 'text-right tabular-nums',
        },
        {
          key: 'since',
          header: t('moderation.player.since'),
          cell: (p) => formatDateTime(p.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
      ]}
    />
  );
}
