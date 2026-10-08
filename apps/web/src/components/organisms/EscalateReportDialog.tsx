import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { EscalationLevel, ReportView } from '@dyingstar-admin/contracts/social';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useEscalateReport } from '@/hooks/useModerationActions';
import { ApiError } from '@/lib/api';

interface EscalateReportDialogProps {
  report: ReportView;
  /** The next level; the caller offers no escalation at the top one. */
  to: EscalationLevel;
  onClose: () => void;
}

/** Escalates an open report one level, after confirmation (ADR 0024 step 3). */
export function EscalateReportDialog({ report, to, onClose }: EscalateReportDialogProps) {
  const { t } = useTranslation();
  const escalate = useEscalateReport();
  const levels = {
    from: t(`moderation.escalation.${report.escalation}`),
    to: t(`moderation.escalation.${to}`),
  };

  const confirm = async () => {
    try {
      await escalate.mutateAsync(report.id);
      toast.success(t('moderation.report.escalated', { id: report.id, ...levels }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
    }
    onClose();
  };

  return (
    <WriteConfirm
      open
      title={t('moderation.report.escalateTitle', { id: report.id })}
      description={<p>{t('moderation.report.escalateHint', levels)}</p>}
      confirmLabel={t('moderation.report.escalate')}
      cancelLabel={t('confirm.cancel')}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
