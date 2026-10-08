import { useTranslation } from 'react-i18next';
import type { PlayerProfile } from '@dyingstar-admin/contracts/social';
import { formatDateTime } from '@/lib/format';

/** What a player says of themselves: faction, role, biography, RP sheet. */
export function PlayerIdentity({ player }: { player: PlayerProfile }) {
  const { t, i18n } = useTranslation();
  const facts = [
    [t('moderation.player.faction'), player.faction],
    [t('moderation.player.role'), player.role],
    [t('moderation.player.rp.characterName'), player.rpSheet?.characterName],
    [t('moderation.player.rp.alignment'), player.rpSheet?.alignment],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  const story = player.rpSheet?.story;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('moderation.player.identity')}</h2>
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fg-3">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {player.biography && <p className="text-sm whitespace-pre-wrap">{player.biography}</p>}
      {story && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-fg-3">{t('moderation.player.rp.story')}</span>
          <p className="text-sm whitespace-pre-wrap">{story}</p>
        </div>
      )}
      {facts.length === 0 && !player.biography && !story && (
        <p className="text-sm text-fg-3">{t('moderation.none')}</p>
      )}
      <p className="text-xs text-fg-3">
        {t('moderation.player.updated', { date: formatDateTime(player.updatedAt, i18n.language) })}
      </p>
    </section>
  );
}
