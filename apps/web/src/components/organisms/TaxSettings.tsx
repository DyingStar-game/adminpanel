import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PoliticalEntityType } from '@dyingstar-admin/contracts/social';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Button } from '@/components/ui/button';
import { usePoliticalSettings } from '@/hooks/useEconomie';
import { formatAmount, formatBps } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { AssessTaxesDialog } from './AssessTaxesDialog';
import { PoliticalSettingsDialog } from './PoliticalSettingsDialog';

interface TaxSettingsProps {
  entity: { id: string; name: string; type: PoliticalEntityType };
  /** Changing the settings and running assessments (`economie:politics:manage`, step O.2). */
  manages?: boolean;
}

/** A political entity's tax rates and minting policy in `economie` (step O, as `svc-admin`). */
export function TaxSettings({ entity, manages = false }: TaxSettingsProps) {
  const { t, i18n } = useTranslation();
  const settings = usePoliticalSettings(entity.id);
  const [dialog, setDialog] = useState<'edit' | 'assess' | null>(null);
  const s = settings.data;

  return (
    <section aria-label={t('economy.taxSettings')} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('economy.taxSettings')}</h2>
        {manages && s && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>
              {t('economy.settings.edit')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog('assess')}>
              {t('economy.settings.assess')}
            </Button>
          </div>
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
              label: t('economy.corporateTax'),
              value: formatBps(s.corporateTaxBps, i18n.language),
            },
            { label: t('economy.incomeTax'), value: formatBps(s.incomeTaxBps, i18n.language) },
            {
              label: t('economy.minting'),
              value: s.allowMinting ? t('economy.allowed') : t('economy.notAllowed'),
              hint:
                s.allowMinting && s.mintCeiling > 0
                  ? t('economy.mintCeiling', {
                      amount: formatAmount(s.mintCeiling, 'credits', i18n.language),
                    })
                  : undefined,
            },
            {
              label: t('economy.lastAssessed'),
              value: s.lastAssessedAt
                ? formatDateTime(s.lastAssessedAt, i18n.language)
                : t('economy.never'),
            },
          ]}
        />
      )}
      {dialog === 'edit' && s && (
        <PoliticalSettingsDialog entity={entity} settings={s} onClose={() => setDialog(null)} />
      )}
      {dialog === 'assess' && s && (
        <AssessTaxesDialog entity={entity} settings={s} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
