import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { StatusResponse } from '@dyingstar/shared';
import { useServerStore } from '@/stores/serverStore';
import { useServerId } from '@/hooks/useApi';
import { useI18n } from '@/hooks/useI18n';

/** Lists configured game servers with player and active Horizon counts from the BFF. */
export function ServersPage() {
  const { t } = useI18n();
  const serverId = useServerId();
  const servers = useServerStore((s) => s.servers);

  const { data: status } = useQuery({
    queryKey: ['status', serverId],
    queryFn: () => apiFetch<StatusResponse>('/api/status', { serverId }),
    refetchInterval: 10000,
    enabled: Boolean(serverId),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ds-text">{t('servers.title')}</h1>

      <Card>
        <CardHeader>
          <h3 className="font-medium">{t('servers.overview')}</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('servers.server')}</TableHeader>
                <TableHeader>ID</TableHeader>
                <TableHeader>{t('servers.horizon')}</TableHeader>
                <TableHeader>{t('servers.players')}</TableHeader>
                <TableHeader>{t('servers.url')}</TableHeader>
              </TableRow>
            </TableHead>
            <tbody>
              {servers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-ds-text">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs text-ds-muted">{s.id}</TableCell>
                  <TableCell>{status?.activeHorizonByServer?.[s.name] ?? '—'}</TableCell>
                  <TableCell>{status?.playersByServer?.[s.name] ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-ds-muted truncate max-w-xs">
                    {s.url}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {status?.horizonInstances && status.horizonInstances.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">{t('servers.horizonInstances')}</h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {status.horizonInstances.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2 border-b border-ds-border"
                >
                  <span className="font-mono text-xs">{h.id}</span>
                  <Badge variant={h.status === 'running' ? 'success' : 'default'}>{h.status}</Badge>
                  {(h.host || h.port) && (
                    <span className="text-ds-muted text-xs">
                      {h.host}
                      {h.port != null ? `:${h.port}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
