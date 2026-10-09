import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { PoliticalSettings } from '@dyingstar-admin/contracts/economie';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useAssessTaxes } from '@/hooks/useEconomieActions';
import { ApiError } from '@/lib/api';
import { formatBps } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';

interface AssessTaxesDialogProps {
  entity: { id: string; name: string };
  settings: PoliticalSettings;
  onClose: () => void;
}

/**
 * Runs a tax assessment of a political entity in `economie` after confirmation (ADR 0024 step
 * O.2, through `svc-admin`): debts are booked on the treasury of each corporation attached to it
 * and on its members' income since the previous assessment. Each run books new debts, so the
 * confirmation says that running it twice taxes the same treasuries twice.
 */
export function AssessTaxesDialog({ entity, settings, onClose }: AssessTaxesDialogProps) {
  const { t, i18n } = useTranslation();
  const assess = useAssessTaxes(entity.id);

  const confirm = async () => {
    try {
      const result = await assess.mutateAsync();
      toast.success(
        result && result.booked > 0
          ? t('economy.settings.assessed', {
              count: result.booked,
              corporate: result.corporateDebts,
              income: result.incomeDebts,
            })
          : t('economy.settings.assessedNone'),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
    }
    onClose();
  };

  return (
    <WriteConfirm
      open
      destructive
      title={t('economy.settings.assessTitle', { name: entity.name })}
      description={
        <div className="flex flex-col gap-2">
          <p>
            {t('economy.settings.assessBases', {
              corporate: formatBps(settings.corporateTaxBps, i18n.language),
              income: formatBps(settings.incomeTaxBps, i18n.language),
            })}
          </p>
          <p>
            {settings.lastAssessedAt
              ? t('economy.settings.assessSince', {
                  date: formatDateTime(settings.lastAssessedAt, i18n.language),
                })
              : t('economy.settings.assessFirst')}
          </p>
          <p className="font-medium">{t('economy.settings.assessTwice')}</p>
        </div>
      }
      confirmLabel={t('economy.settings.assess')}
      cancelLabel={t('confirm.cancel')}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
