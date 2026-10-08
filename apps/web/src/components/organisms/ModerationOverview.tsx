import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModerationLogEntry } from '@dyingstar-admin/contracts/social';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { useModerationLog, useSocialStats } from '@/hooks/useModeration';
import { formatDateTime, shortId } from '@/lib/format';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { moderationErrorKey } from './moderationLabels';

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border px-4 py-3">
      <span className="text-xs text-fg-3">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-fg-3">{hint}</span>}
    </div>
  );
}

/** Community figures and the moderation log (ADR 0024, reading). */
export function ModerationOverview({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const stats = useSocialStats();
  const [page, setPage] = useState(1);
  const log = useModerationLog(page);

  if (stats.isError) return <ServiceNotice message={t(moderationErrorKey(stats.error))} />;
  const data = stats.data;
  const reports = data ? Object.values(data.reports).reduce((sum, n) => sum + (n ?? 0), 0) : 0;
  const player = (id: string | null) =>
    id ? (
      <Chip variant="link" title={id} onClick={() => onOpenPlayer(id)}>
        <MonoText>{shortId(id)}</MonoText>
      </Chip>
    ) : (
      <span className="text-fg-3">{t('moderation.system')}</span>
    );

  return (
    <div className="flex flex-col gap-6">
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label={t('moderation.stats.players')}
            value={data.players.total}
            hint={t('moderation.stats.online', { count: data.players.online })}
          />
          <Tile
            label={t('moderation.stats.reports')}
            value={reports}
            hint={Object.entries(data.reports)
              .map(([status, n]) => `${t(`moderation.reportStatus.${status}` as never)} ${n}`)
              .join(' · ')}
          />
          <Tile label={t('moderation.stats.activeSanctions')} value={data.sanctions.active} />
          <Tile label={t('moderation.stats.activity')} value={data.activityLast24h} />
        </div>
      )}
      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t('moderation.mostReported')}</h2>
            <DataTable
              label={t('moderation.mostReported')}
              rows={data.mostReported}
              rowKey={(row) => row.playerId}
              empty={t('moderation.none')}
              columns={[
                {
                  key: 'player',
                  header: t('moderation.columns.player'),
                  cell: (r) => player(r.playerId),
                },
                {
                  key: 'reports',
                  header: t('moderation.columns.reports'),
                  cell: (r) => r.reports,
                  className: 'text-right tabular-nums',
                },
              ]}
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t('moderation.lowestReputation')}</h2>
            <DataTable
              label={t('moderation.lowestReputation')}
              rows={data.lowestReputation}
              rowKey={(row) => row.playerId}
              empty={t('moderation.none')}
              onPick={(row) => onOpenPlayer(row.playerId)}
              columns={[
                {
                  key: 'player',
                  header: t('moderation.columns.player'),
                  cell: (r) => r.displayName,
                },
                {
                  key: 'reputation',
                  header: t('moderation.columns.reputation'),
                  cell: (r) => r.reputation,
                  className: 'text-right tabular-nums',
                },
              ]}
            />
          </section>
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('moderation.log')}</h2>
        <DataTable<ModerationLogEntry>
          label={t('moderation.log')}
          rows={log.data?.items ?? []}
          rowKey={(row) => row.id}
          empty={t('moderation.none')}
          columns={[
            {
              key: 'date',
              header: t('moderation.columns.date'),
              cell: (r) => formatDateTime(r.createdAt, i18n.language),
              className: 'whitespace-nowrap',
            },
            { key: 'actor', header: t('moderation.columns.actor'), cell: (r) => player(r.actorId) },
            {
              key: 'action',
              header: t('moderation.columns.action'),
              cell: (r) => <MonoText>{r.action}</MonoText>,
            },
            {
              key: 'target',
              header: t('moderation.columns.target'),
              cell: (r) => (r.targetPlayerId ? player(r.targetPlayerId) : '—'),
            },
            {
              key: 'details',
              header: t('moderation.columns.details'),
              cell: (r) =>
                r.details ? <MonoText tone="muted">{JSON.stringify(r.details)}</MonoText> : '—',
            },
          ]}
        />
        {log.data && (
          <Pagination
            page={page}
            pageSize={MODERATION_PAGE_SIZE}
            total={log.data.total}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
