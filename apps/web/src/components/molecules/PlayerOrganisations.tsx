import { useTranslation } from 'react-i18next';
import type { CorporationRef, PoliticalEntityRef } from '@dyingstar-admin/contracts/social';
import { MonoText } from '@/components/atoms/MonoText';
import { Badge } from '@/components/ui/badge';

interface PlayerOrganisationsProps {
  /** Unknown while the public profile loads. */
  memberships: { corporations: CorporationRef[]; politics: PoliticalEntityRef[] } | null;
}

/** A player's corporations and political entities. */
export function PlayerOrganisations({ memberships }: PlayerOrganisationsProps) {
  const { t } = useTranslation();
  const count = memberships ? memberships.corporations.length + memberships.politics.length : 0;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('moderation.player.organisations')}</h2>
      {memberships && count > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {memberships.corporations.map((corporation) => (
            <li key={corporation.id} className="flex items-center gap-2">
              <Badge variant="outline">{t('moderation.player.corporation')}</Badge>
              {corporation.name}
              <MonoText tone="subtle">[{corporation.ticker}]</MonoText>
            </li>
          ))}
          {memberships.politics.map((entity) => (
            <li key={entity.id} className="flex items-center gap-2">
              <Badge variant="outline">{t(`moderation.player.political.${entity.type}`)}</Badge>
              {entity.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-3">{memberships ? t('moderation.none') : '…'}</p>
      )}
    </section>
  );
}
