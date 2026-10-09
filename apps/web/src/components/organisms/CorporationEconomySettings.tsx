import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/atoms/Chip';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Button } from '@/components/ui/button';
import { useCorporationSettings } from '@/hooks/useEconomie';
import { usePoliticalEntity } from '@/hooks/useOrganisations';
import { formatBps } from '@/lib/economy';
import { shortId } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { CorporationSettingsDialog } from './CorporationSettingsDialog';

interface CorporationEconomySettingsProps {
  corporation: { id: string; name: string };
  /** Changing them (`economie:corporation:manage`, step O.2). */
  manages?: boolean;
  onOpenPoliticalEntity: (id: string) => void;
}

/**
 * A corporation's settings in `economie` (step O.2, as `svc-admin`): the internal tax on its
 * members' donations, whether they may donate, and its fiscal home, the political entity whose
 * corporate tax applies to its treasury (`economie`'s own, apart from `social`'s political home).
 */
export function CorporationEconomySettings({
  corporation,
  manages = false,
  onOpenPoliticalEntity,
}: CorporationEconomySettingsProps) {
  const { t, i18n } = useTranslation();
  const settings = useCorporationSettings(corporation.id);
  const s = settings.data;
  const home = usePoliticalEntity(s?.politicalEntityId ?? null);
  const [editing, setEditing] = useState(false);

  return (
    <section aria-label={t('economy.settings.title')} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('economy.settings.title')}</h2>
        {manages && s && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t('economy.settings.edit')}
          </Button>
        )}
      </div>
      {settings.isError ? (
        <ServiceNotice message={t(moderationErrorKey(settings.error))} />
      ) : !s ? (
        <p className="text-sm text-fg-3">…</p>
      ) : (
        <FactTiles
          facts={[
            {
              label: t('economy.settings.donationTax'),
              value: formatBps(s.taxRateBps, i18n.language),
            },
            {
              label: t('economy.settings.donations'),
              value: t(
                s.allowDonations ? 'economy.settings.donationsOn' : 'economy.settings.donationsOff',
              ),
            },
            {
              label: t('economy.settings.fiscalHome'),
              value: s.politicalEntityId ? (
                <Chip
                  variant="link"
                  title={s.politicalEntityId}
                  onClick={() => onOpenPoliticalEntity(s.politicalEntityId ?? '')}
                >
                  {home.data?.name ?? shortId(s.politicalEntityId)}
                </Chip>
              ) : (
                <span className="text-fg-3">{t('economy.settings.noFiscalHome')}</span>
              ),
            },
          ]}
        />
      )}
      {editing && s && (
        <CorporationSettingsDialog
          corporation={corporation}
          settings={s}
          homeName={home.data?.name}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
