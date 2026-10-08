import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useDisbandCorporation, useDisbandPoliticalEntity } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';

interface DisbandOrganisationDialogProps {
  kind: 'corporation' | 'politics';
  organisation: { id: string; name: string };
  onClose: () => void;
  onDisbanded: () => void;
}

/** Disbands a corporation or a political entity for good, after confirmation (step N). */
export function DisbandOrganisationDialog({
  kind,
  organisation,
  onClose,
  onDisbanded,
}: DisbandOrganisationDialogProps) {
  const { t } = useTranslation();
  const corporation = useDisbandCorporation(organisation.id);
  const politics = useDisbandPoliticalEntity(organisation.id);
  const disband = kind === 'corporation' ? corporation : politics;

  const confirm = async () => {
    try {
      await disband.mutateAsync();
      toast.success(t('organisations.manage.disbanded', { name: organisation.name }));
      onDisbanded();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      onClose();
    }
  };

  return (
    <WriteConfirm
      open
      destructive
      title={t('organisations.manage.disbandTitle', { name: organisation.name })}
      description={<p>{t(`organisations.manage.disbandHint.${kind}`)}</p>}
      confirmLabel={t('organisations.manage.disband')}
      cancelLabel={t('confirm.cancel')}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
