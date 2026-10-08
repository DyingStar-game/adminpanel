import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import type { ReportView } from '@dyingstar-admin/contracts/social';
import {
  REPORT_LEVEL_PERMISSION,
  reportActions,
  type ReportAction,
} from '@dyingstar-admin/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { formatDateTime } from '@/lib/format';
import { nextEscalation } from '@/lib/reports';
import { EscalateReportDialog } from './EscalateReportDialog';
import { ReportStatusDialog } from './ReportStatusDialog';

interface ReportDetailProps {
  report: ReportView;
  /** A player's name as a link to their sheet (the system when no id). */
  player: (id: string | null, label: string | null) => ReactNode;
  onClose: () => void;
}

/**
 * One report: what was reported and by whom, its resolution, and the moderation actions while
 * it is open (ADR 0024 step 3): claim it, then confirm, dismiss or escalate it.
 */
export function ReportDetail({ report, player, onClose }: ReportDetailProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const [dialog, setDialog] = useState<ReportAction | null>(null);
  const title = t('moderation.report.title', { id: report.id });
  const next = nextEscalation(report.escalation);
  // Claimed first, then decided or escalated; handled at its escalation level or above
  // (ADR 0024 › Update 2026-10-08).
  const allowed = reportActions(report.status).filter(
    (action) => action !== 'escalate' || next !== null,
  );
  const atMyLevel = can(REPORT_LEVEL_PERMISSION[report.escalation]);
  const actions = atMyLevel ? allowed : [];
  const label: Record<ReportAction, string> = {
    reviewing: t('moderation.report.review'),
    resolved: t('moderation.report.uphold'),
    dismissed: t('moderation.report.dismiss'),
    escalate: t('moderation.report.escalate'),
  };

  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge variant="outline">{t(`moderation.reportStatus.${report.status}`)}</Badge>
        <span className="text-xs text-fg-3">{t(`moderation.escalation.${report.escalation}`)}</span>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('moderation.report.close')}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {t(`moderation.reason.${report.reason}`)} ·{' '}
        {formatDateTime(report.createdAt, i18n.language)} · {t('moderation.columns.target')}{' '}
        {player(report.targetPlayerId, report.targetName)}
        {t('moderation.columns.reporter')} {player(report.reporterId, report.reporterName)}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-fg-3">{t('moderation.report.message')}</span>
        <p className="text-sm whitespace-pre-wrap">
          {report.message ?? t('moderation.report.noMessage')}
        </p>
      </div>
      {(report.resolvedAt ?? report.resolutionNote) && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-fg-3">{t('moderation.report.resolution')}</span>
          <p className="text-sm">
            {report.resolvedAt && formatDateTime(report.resolvedAt, i18n.language)}
            {report.resolvedAt && report.resolutionNote && ' — '}
            {report.resolutionNote}
          </p>
        </div>
      )}
      {allowed.length > 0 && !atMyLevel && can('social.moderate') && (
        <p className="text-xs text-fg-3">
          {t('moderation.report.otherLevel', {
            level: t(`moderation.escalation.${report.escalation}`),
          })}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action} variant="outline" size="sm" onClick={() => setDialog(action)}>
              {label[action]}
            </Button>
          ))}
        </div>
      )}
      {dialog === 'escalate' && next && (
        <EscalateReportDialog report={report} to={next} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog !== 'escalate' && (
        <ReportStatusDialog report={report} status={dialog} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
