import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useRemoveMember } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';

interface RemoveMemberDialogProps {
  corporation: { id: string; name: string };
  member: { playerId: string; displayName: string };
  onClose: () => void;
}

/** Removes a member from a corporation, after confirmation (step N). */
export function RemoveMemberDialog({ corporation, member, onClose }: RemoveMemberDialogProps) {
  const { t } = useTranslation();
  const remove = useRemoveMember(corporation.id);
  const names = { name: member.displayName, organisation: corporation.name };

  const confirm = async () => {
    try {
      await remove.mutateAsync(member.playerId);
      toast.success(t('organisations.manage.removed', names));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
    }
    onClose();
  };

  return (
    <WriteConfirm
      open
      destructive
      title={t('organisations.manage.removeTitle', names)}
      description={<p>{t('organisations.manage.removeHint')}</p>}
      confirmLabel={t('organisations.manage.remove')}
      cancelLabel={t('confirm.cancel')}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
