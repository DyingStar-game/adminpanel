import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'lucide-react';
import type { ActivityEntry, ReportView, ReputationEvent } from '@dyingstar-admin/contracts/social';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { PageHeading } from '@/components/molecules/PageHeading';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { moderationErrorKey } from '@/components/organisms/moderationLabels';
import { SanctionsTable } from '@/components/organisms/SanctionsTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlayerRecord } from '@/hooks/useModeration';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface PlayerRecordPageProps {
  playerId: string;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenReport: (id: number) => void;
}

/** A player's moderation sheet (ADR 0024, reading): profile, sanctions, reports, reputation. */
export function PlayerRecordPage({
  playerId,
  onBack,
  onOpenPlayer,
  onOpenReport,
}: PlayerRecordPageProps) {
  const { t, i18n } = useTranslation();
  const record = usePlayerRecord(playerId);
  const date = (iso: string) => formatDateTime(iso, i18n.language);

  const back = (
    <Button variant="outline" size="sm" onClick={onBack}>
      <ArrowLeftIcon />
      {t('moderation.player.back')}
    </Button>
  );
  if (record.isError) {
    const missing = record.error instanceof ApiError && record.error.status === 404;
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        {back}
        <ServiceNotice
          message={
            missing
              ? t('moderation.player.notFound', { id: playerId })
              : t(moderationErrorKey(record.error))
          }
        />
      </div>
    );
  }
  const player = record.data;
  if (!player) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
      <PageHeading title={player.displayName} actions={back}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
          <Badge variant="outline">{t(`moderation.player.kind.${player.entityType}`)}</Badge>
          <MonoText tone="subtle">{player.playerId}</MonoText>
          <CopyButton value={player.playerId} />
        </div>
      </PageHeading>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          [t('moderation.player.reputation'), String(player.reputation)],
          [
            t('moderation.player.playtime'),
            t('moderation.player.hours', { count: Math.round(player.playtimeSeconds / 3600) }),
          ],
          [t('moderation.player.since'), date(player.createdAt)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg border px-4 py-3">
            <dt className="text-xs text-fg-3">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.sanctions')}</h2>
        <SanctionsTable
          sanctions={player.sanctions}
          showPlayer={false}
          onOpenPlayer={onOpenPlayer}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.reports')}</h2>
        <DataTable<ReportView>
          label={t('moderation.player.reports')}
          rows={player.reports}
          rowKey={(r) => r.id}
          empty={t('moderation.none')}
          onPick={(r) => onOpenReport(r.id)}
          columns={[
            { key: 'date', header: t('moderation.columns.date'), cell: (r) => date(r.createdAt) },
            {
              key: 'reason',
              header: t('moderation.columns.reason'),
              cell: (r) => t(`moderation.reason.${r.reason}`),
            },
            {
              key: 'reporter',
              header: t('moderation.columns.reporter'),
              cell: (r) => r.reporterName ?? t('moderation.system'),
            },
            {
              key: 'status',
              header: t('moderation.columns.status'),
              cell: (r) => (
                <Badge variant="outline">{t(`moderation.reportStatus.${r.status}`)}</Badge>
              ),
            },
          ]}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.reputationEvents')}</h2>
        <DataTable<ReputationEvent>
          label={t('moderation.player.reputationEvents')}
          rows={player.reputationEvents}
          rowKey={(e) => e.id}
          empty={t('moderation.none')}
          columns={[
            { key: 'date', header: t('moderation.columns.date'), cell: (e) => date(e.createdAt) },
            {
              key: 'delta',
              header: t('moderation.columns.delta'),
              cell: (e) => (e.delta > 0 ? `+${e.delta}` : String(e.delta)),
              className: 'tabular-nums',
            },
            {
              key: 'balance',
              header: t('moderation.columns.reputation'),
              cell: (e) => e.balance,
              className: 'tabular-nums',
            },
            { key: 'source', header: t('moderation.columns.source'), cell: (e) => e.source },
            { key: 'reason', header: t('moderation.columns.reason'), cell: (e) => e.reason },
          ]}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.player.activity')}</h2>
        <DataTable<ActivityEntry>
          label={t('moderation.player.activity')}
          rows={player.activity}
          rowKey={(a) => a.id}
          empty={t('moderation.none')}
          columns={[
            { key: 'date', header: t('moderation.columns.date'), cell: (a) => date(a.createdAt) },
            {
              key: 'event',
              header: t('moderation.columns.event'),
              cell: (a) => <MonoText>{a.type}</MonoText>,
            },
          ]}
        />
      </section>
    </div>
  );
}
