import { useTranslation } from 'react-i18next';
import { FactTiles } from '@/components/molecules/FactTiles';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { usePoliticalSettings } from '@/hooks/useEconomie';
import { formatAmount, formatBps } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { moderationErrorKey } from '@/lib/moderationErrors';

/** A political entity's tax rates and minting policy in `economie` (step O, as `svc-admin`). */
export function TaxSettings({ entityId }: { entityId: string }) {
  const { t, i18n } = useTranslation();
  const settings = usePoliticalSettings(entityId);
  const s = settings.data;

  return (
    <section aria-label={t('economy.taxSettings')} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('economy.taxSettings')}</h2>
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
    </section>
  );
}
