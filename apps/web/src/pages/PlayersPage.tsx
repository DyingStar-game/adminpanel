import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileKind } from '@dyingstar-admin/contracts/social';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { PlayersTable } from '@/components/organisms/PlayersTable';
import { ServicePageLayout } from '@/components/templates/ServicePageLayout';
import { Input } from '@/components/ui/input';
import { useSocialPlayers } from '@/hooks/useModeration';
import { moderationErrorKey } from '@/lib/moderationErrors';
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
  const { t } = useTranslation();
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
    <ServicePageLayout
      title={t('players.title')}
      meta={<p className="text-sm text-fg-3">{t('players.lead')}</p>}
    >
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
          <PlayersTable players={players.data?.items ?? []} onOpenPlayer={onOpenPlayer} />
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
    </ServicePageLayout>
  );
}
