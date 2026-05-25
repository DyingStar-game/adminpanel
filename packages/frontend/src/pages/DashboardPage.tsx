import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, Spinner } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { ActivityLogEntry, StatusResponse } from '@dyingstar/shared';
import { useServerId } from '@/hooks/useApi';
import { useI18n } from '@/hooks/useI18n';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const MOCK_SPARKLINE = Array.from({ length: 12 }, (_, i) => ({
  time: `${i}h`,
  players: Math.floor(Math.random() * 15) + 3,
}));

/** Overview dashboard: Horizon mesh counts, players, items, and activity log. */
export function DashboardPage() {
  const { t } = useI18n();
  const serverId = useServerId();

  const { data: status, isLoading } = useQuery({
    queryKey: ['status', serverId],
    queryFn: () => apiFetch<StatusResponse>('/api/status', { serverId }),
    refetchInterval: 10000,
    enabled: Boolean(serverId),
  });

  const { data: activity } = useQuery({
    queryKey: ['activity-log'],
    queryFn: () => apiFetch<ActivityLogEntry[]>('/api/activity-log'),
    refetchInterval: 10000,
  });

  if (!serverId) {
    return <p className="text-ds-muted">{t('common.noServer')}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">{t('dashboard.title')}</h1>

      {!status?.resourcesDynamicReachable && status && (
        <p className="text-sm text-ds-warning">{t('dashboard.meshUnreachable')}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-ds-muted uppercase tracking-wider">
                  {t('dashboard.activeHorizon')}
                </p>
                <p className="text-3xl font-semibold text-ds-text mt-1">
                  {status?.activeHorizonCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-ds-muted uppercase tracking-wider">
                  {t('dashboard.connectedPlayers')}
                </p>
                <p className="text-3xl font-semibold text-ds-text mt-1">
                  {status?.connectedPlayers ?? 0}
                </p>
                {status?.playersByServer && (
                  <ul className="mt-2 text-xs text-ds-muted space-y-0.5">
                    {Object.entries(status.playersByServer).map(([name, count]) => (
                      <li key={name}>
                        {name}: {count}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-ds-muted uppercase tracking-wider">
                  {t('dashboard.itemsInDb')}
                </p>
                <p className="text-3xl font-semibold text-ds-text mt-1">{status?.itemsCount ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <h3 className="font-medium">{t('dashboard.playersChart')}</h3>
              </CardHeader>
              <CardContent>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={MOCK_SPARKLINE}>
                      <Line
                        type="monotone"
                        dataKey="players"
                        stroke="rgb(255,186,8)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-ds-muted mt-2">{t('dashboard.mockData')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-medium">{t('dashboard.recentActivity')}</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 max-h-40 overflow-y-auto text-sm">
                  {(activity ?? []).slice(0, 10).map((entry) => (
                    <li key={entry.id} className="flex justify-between border-b border-ds-border pb-2">
                      <span>{entry.action}</span>
                      <span className="text-ds-muted text-xs">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                  {!activity?.length && (
                    <li className="text-ds-muted text-sm">{t('dashboard.noActivity')}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
