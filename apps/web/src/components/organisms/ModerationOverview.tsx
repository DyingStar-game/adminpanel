import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { FactTiles } from '@/components/molecules/FactTiles';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { useModerationLog, usePlayerNames, useSocialStats } from '@/hooks/useModeration';
import { shortId } from '@/lib/format';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { ModerationLogTable } from './ModerationLogTable';
import { moderationErrorKey } from '@/lib/moderationErrors';

/** Community figures and the moderation log (ADR 0024, reading). */
export function ModerationOverview({
  onOpenPlayer,
  onOpenReport,
}: {
  onOpenPlayer: (id: string) => void;
  onOpenReport: (id: number) => void;
}) {
  const { t } = useTranslation();
  const stats = useSocialStats();
  const [page, setPage] = useState(1);
  const log = useModerationLog(page);
  // Most reported players come by id only.
  const names = usePlayerNames(stats.data?.mostReported.map((r) => r.playerId) ?? []);

  if (stats.isError) return <ServiceNotice message={t(moderationErrorKey(stats.error))} />;
  const data = stats.data;
  const reports = data ? Object.values(data.reports).reduce((sum, n) => sum + (n ?? 0), 0) : 0;
  const player = (id: string | null) =>
    id ? (
      <Chip variant="link" title={id} onClick={() => onOpenPlayer(id)}>
        {names.get(id) ?? <MonoText>{shortId(id)}</MonoText>}
      </Chip>
    ) : (
      <span className="text-fg-3">{t('moderation.system')}</span>
    );

  return (
    <div className="flex flex-col gap-6">
      {data && (
        <FactTiles
          facts={[
            {
              label: t('moderation.stats.players'),
              value: data.players.total,
              hint: t('moderation.stats.online', { count: data.players.online }),
            },
            {
              label: t('moderation.stats.reports'),
              value: reports,
              hint: Object.entries(data.reports)
                .map(([status, n]) => `${t(`moderation.reportStatus.${status}` as never)} ${n}`)
                .join(' · '),
            },
            { label: t('moderation.stats.activeSanctions'), value: data.sanctions.active },
            { label: t('moderation.stats.activity'), value: data.activityLast24h },
          ]}
        />
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
        <h2 className="text-sm font-semibold">{t('moderation.log.title')}</h2>
        <ModerationLogTable
          entries={log.data?.items ?? []}
          onOpenPlayer={onOpenPlayer}
          onOpenReport={onOpenReport}
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
