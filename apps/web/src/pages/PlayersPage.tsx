import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlayerProfile, ProfileKind } from '@dyingstar-admin/contracts/social';
import { DataTable } from '@/components/molecules/DataTable';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { PageHeading } from '@/components/molecules/PageHeading';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { moderationErrorKey } from '@/components/organisms/moderationLabels';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSocialPlayers } from '@/hooks/useModeration';
import { formatDateTime } from '@/lib/format';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import type { PlayersSearch } from '@/lib/playersSearch';

const ALL = 'all';

interface PlayersPageProps {
  search: PlayersSearch;
  onSearchChange: (next: PlayersSearch) => void;
  onOpenPlayer: (id: string) => void;
}

/** Players and NPCs of `social`, searched by name, each opening its sheet (ADR 0024). */
export function PlayersPage({ search, onSearchChange, onOpenPlayer }: PlayersPageProps) {
  const { t, i18n } = useTranslation();
  // Typed text, sent once the user pauses.
  const [text, setText] = useState(search.q);
  // The URL changed elsewhere (back, a link): show its name (React's "adjust state" pattern).
  const [shown, setShown] = useState(search.q);
  if (search.q !== shown) {
    setShown(search.q);
    setText(search.q);
  }
  useEffect(() => {
    if (text === search.q) return;
    const timer = setTimeout(() => onSearchChange({ ...search, q: text, page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [text, search, onSearchChange]);
  const players = useSocialPlayers({ search: search.q, kind: search.kind }, search.page);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
      <PageHeading title={t('players.title')}>
        <p className="text-sm text-fg-3">{t('players.lead')}</p>
      </PageHeading>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label={t('players.search')}
          placeholder={t('players.search')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-72"
        />
        <OptionSelect<string>
          label={t('players.kind')}
          value={search.kind ?? ALL}
          options={[
            { value: ALL, label: t('players.allKinds') },
            { value: 'player', label: t('moderation.player.kind.player') },
            { value: 'npc', label: t('moderation.player.kind.npc') },
          ]}
          onChange={(v) =>
            onSearchChange({ ...search, kind: v === ALL ? undefined : (v as ProfileKind), page: 1 })
          }
          className="w-40"
        />
      </div>
      {players.isError ? (
        <ServiceNotice message={t(moderationErrorKey(players.error))} />
      ) : (
        <>
          <DataTable<PlayerProfile>
            label={t('players.title')}
            rows={players.data?.items ?? []}
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
          {players.data && (
            <Pagination
              page={search.page}
              pageSize={MODERATION_PAGE_SIZE}
              total={players.data.total}
              onPageChange={(page) => onSearchChange({ ...search, page })}
            />
          )}
        </>
      )}
    </div>
  );
}
