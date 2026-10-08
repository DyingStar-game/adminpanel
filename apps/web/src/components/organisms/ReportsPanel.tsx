import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import type { EscalationLevel, ReportStatus, ReportView } from '@dyingstar-admin/contracts/social';
import { Chip } from '@/components/atoms/Chip';
import { DataTable } from '@/components/molecules/DataTable';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useReport, useReports } from '@/hooks/useModeration';
import { formatDateTime } from '@/lib/format';
import { MODERATION_PAGE_SIZE, type ModerationSearch } from '@/lib/moderationSearch';
import { moderationErrorKey } from './moderationLabels';

const STATUSES: ReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed'];
const LEVELS: EscalationLevel[] = ['moderator', 'admin', 'supervisor'];
const ALL = 'all';

interface ReportsPanelProps {
  search: ModerationSearch;
  onSearchChange: (next: ModerationSearch) => void;
  onOpenPlayer: (id: string) => void;
}

/** Report queue with its filters, and the opened report (ADR 0024, reading). */
export function ReportsPanel({ search, onSearchChange, onOpenPlayer }: ReportsPanelProps) {
  const { t, i18n } = useTranslation();
  const reports = useReports({ status: search.status, escalation: search.escalation }, search.page);
  const opened = useReport(search.report);

  const statusLabel = (s: ReportStatus) => t(`moderation.reportStatus.${s}`);
  const levelLabel = (l: EscalationLevel) => t(`moderation.escalation.${l}`);
  const reasonLabel = (r: ReportView['reason']) => t(`moderation.reason.${r}`);
  const name = (id: string | null, label: string | null) =>
    id ? (
      <Chip
        variant="link"
        title={id}
        onClick={(event) => {
          event.stopPropagation();
          onOpenPlayer(id);
        }}
      >
        {label ?? id.slice(0, 8)}
      </Chip>
    ) : (
      <span className="text-fg-3">{t('moderation.system')}</span>
    );

  if (reports.isError) return <ServiceNotice message={t(moderationErrorKey(reports.error))} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <OptionSelect<string>
          label={t('moderation.filters.status')}
          value={search.status ?? ALL}
          options={[
            {
              value: ALL,
              label: `${t('moderation.filters.status')} : ${t('moderation.filters.all')}`,
            },
            ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
          ]}
          onChange={(v) =>
            onSearchChange({
              ...search,
              status: v === ALL ? undefined : (v as ReportStatus),
              page: 1,
            })
          }
          className="w-44"
        />
        <OptionSelect<string>
          label={t('moderation.filters.escalation')}
          value={search.escalation ?? ALL}
          options={[
            {
              value: ALL,
              label: `${t('moderation.filters.escalation')} : ${t('moderation.filters.all')}`,
            },
            ...LEVELS.map((l) => ({ value: l, label: levelLabel(l) })),
          ]}
          onChange={(v) =>
            onSearchChange({
              ...search,
              escalation: v === ALL ? undefined : (v as EscalationLevel),
              page: 1,
            })
          }
          className="w-44"
        />
      </div>
      <DataTable<ReportView>
        label={t('moderation.tabs.reports')}
        rows={reports.data?.items ?? []}
        rowKey={(r) => r.id}
        empty={t('moderation.none')}
        onPick={(r) => onSearchChange({ ...search, report: r.id })}
        picked={(r) => r.id === search.report}
        columns={[
          {
            key: 'date',
            header: t('moderation.columns.date'),
            cell: (r) => formatDateTime(r.createdAt, i18n.language),
            className: 'whitespace-nowrap',
          },
          {
            key: 'reason',
            header: t('moderation.columns.reason'),
            cell: (r) => reasonLabel(r.reason),
          },
          {
            key: 'target',
            header: t('moderation.columns.target'),
            cell: (r) => name(r.targetPlayerId, r.targetName),
          },
          {
            key: 'reporter',
            header: t('moderation.columns.reporter'),
            cell: (r) => name(r.reporterId, r.reporterName),
          },
          {
            key: 'status',
            header: t('moderation.columns.status'),
            cell: (r) => <Badge variant="outline">{statusLabel(r.status)}</Badge>,
          },
          {
            key: 'escalation',
            header: t('moderation.columns.escalation'),
            cell: (r) => levelLabel(r.escalation),
          },
        ]}
      />
      {reports.data && (
        <Pagination
          page={search.page}
          pageSize={MODERATION_PAGE_SIZE}
          total={reports.data.total}
          onPageChange={(page) => onSearchChange({ ...search, page })}
        />
      )}
      {opened.data && (
        <section
          aria-label={t('moderation.report.title', { id: opened.data.id })}
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">
              {t('moderation.report.title', { id: opened.data.id })}
            </h2>
            <Badge variant="outline">{statusLabel(opened.data.status)}</Badge>
            <span className="text-xs text-fg-3">{levelLabel(opened.data.escalation)}</span>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('moderation.report.close')}
              onClick={() => onSearchChange({ ...search, report: undefined })}
            >
              <XIcon />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {reasonLabel(opened.data.reason)} ·{' '}
            {formatDateTime(opened.data.createdAt, i18n.language)} ·{' '}
            {t('moderation.columns.target')}{' '}
            {name(opened.data.targetPlayerId, opened.data.targetName)}
            {t('moderation.columns.reporter')}{' '}
            {name(opened.data.reporterId, opened.data.reporterName)}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-fg-3">{t('moderation.report.message')}</span>
            <p className="text-sm whitespace-pre-wrap">
              {opened.data.message ?? t('moderation.report.noMessage')}
            </p>
          </div>
          {opened.data.resolvedAt && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-fg-3">{t('moderation.report.resolution')}</span>
              <p className="text-sm">
                {formatDateTime(opened.data.resolvedAt, i18n.language)}
                {opened.data.resolutionNote && ` — ${opened.data.resolutionNote}`}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
