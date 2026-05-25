import { useQuery, useMutation } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, Badge } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { ConnectivityResponse } from '@dyingstar/shared';
import { useServerStore } from '@/stores/serverStore';
import { useServerId } from '@/hooks/useApi';
import { toast } from '@/stores/toastStore';
import { useI18n } from '@/hooks/useI18n';

/** Settings: server list, connectivity checks, and cache clear. */
export function SettingsPage() {
  const { t } = useI18n();
  const servers = useServerStore((s) => s.servers);
  const serverId = useServerId();

  const { data: connectivity, refetch } = useQuery({
    queryKey: ['connectivity', serverId],
    queryFn: () => apiFetch<ConnectivityResponse>('/api/connectivity', { serverId }),
    enabled: Boolean(serverId),
  });

  const clearCache = useMutation({
    mutationFn: () => apiFetch('/api/cache/clear', { method: 'POST' }),
    onSuccess: () => toast.success(t('toast.cacheCleared')),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <h3 className="font-medium">{t('settings.configuredServers')}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {servers.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-lg bg-ds-surface-elevated border border-ds-border text-sm space-y-1"
            >
              <div className="font-medium text-ds-text">{s.name}</div>
              <div>
                <span className="text-ds-muted">ID:</span>{' '}
                <span className="font-mono">{s.id}</span>
              </div>
              <div>
                <span className="text-ds-muted">{t('servers.url')}:</span>{' '}
                <span className="font-mono text-xs">{s.url}</span>
              </div>
            </div>
          ))}
          <p className="text-xs text-ds-muted">{t('settings.internalUrlsHint')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-medium">{t('settings.connectivity')}</h3>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="mb-4">
            {t('settings.rerunTests')}
          </Button>
          <div className="flex flex-wrap gap-3">
            {connectivity && (
              <>
                <PingBadge label={t('settings.services.persistence')} result={connectivity.persistence} failedLabel={t('common.failed')} />
                <PingBadge label={t('settings.services.mesh')} result={connectivity.mesh} failedLabel={t('common.failed')} />
                <PingBadge label={t('settings.services.auth')} result={connectivity.auth} failedLabel={t('common.failed')} />
                <PingBadge label={t('settings.services.realtime')} result={connectivity.realtime} failedLabel={t('common.failed')} />
                <PingBadge label={t('settings.services.horizon')} result={connectivity.horizon} failedLabel={t('common.failed')} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Button variant="danger" onClick={() => clearCache.mutate()}>
            {t('settings.clearCache')}
          </Button>
          <p className="text-xs text-ds-muted mt-2">{t('settings.clearCacheHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Displays a service label with latency or failure badge. */
function PingBadge({
  label,
  result,
  failedLabel,
}: {
  label: string;
  result: { ok: boolean; latencyMs: number };
  failedLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ds-surface-elevated border border-ds-border">
      <span>{label}</span>
      <Badge variant={result.ok ? 'success' : 'danger'}>
        {result.ok ? `${result.latencyMs}ms` : failedLabel}
      </Badge>
    </div>
  );
}
