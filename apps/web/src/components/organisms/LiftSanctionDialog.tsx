import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Sanction } from '@dyingstar-admin/contracts/social';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useRevokeSanction } from '@/hooks/useModerationActions';
import { ApiError } from '@/lib/api';

interface LiftSanctionDialogProps {
  sanction: Sanction;
  playerName: string;
  onClose: () => void;
}

/** Lifts a sanction in force, after confirmation (ADR 0024 step 3). */
export function LiftSanctionDialog({ sanction, playerName, onClose }: LiftSanctionDialogProps) {
  const { t } = useTranslation();
  const revoke = useRevokeSanction();
  const type = t(`moderation.sanctionType.${sanction.type}`);

  const confirm = async () => {
    try {
      await revoke.mutateAsync(sanction.id);
      toast.success(t('moderation.actions.lifted', { type, name: playerName }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
    }
    onClose();
  };

  return (
    <WriteConfirm
      open
      title={t('moderation.actions.liftTitle', { type, name: playerName })}
      description={<p>{sanction.reason}</p>}
      confirmLabel={t('moderation.actions.lift')}
      cancelLabel={t('confirm.cancel')}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
