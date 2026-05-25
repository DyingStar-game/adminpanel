import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ServerPublic } from '@dyingstar/shared';
import { useServerStore } from '@/stores/serverStore';
import { useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import type { MessageKey } from '@/hooks/useI18n';

const routeKeys: Record<string, MessageKey> = {
  '/': 'nav.dashboard',
  '/servers': 'nav.serversPlayers',
  '/items': 'nav.items',
  '/import': 'nav.import',
  '/missions': 'nav.missions',
  '/users': 'nav.users',
  '/bans': 'nav.bans',
  '/settings': 'nav.settings',
};

/** Shell layout: sidebar, header breadcrumbs, and nested route outlet. */
export function AppLayout() {
  const location = useLocation();
  const setServers = useServerStore((s) => s.setServers);
  const { t } = useI18n();

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiFetch<ServerPublic[]>('/api/servers'),
  });

  useEffect(() => {
    if (servers?.length) setServers(servers);
  }, [servers, setServers]);

  const labelKey = routeKeys[location.pathname] ?? 'nav.dashboard';

  return (
    <div className="min-h-screen bg-ds-bg">
      <Sidebar />
      <div className="ml-64 min-h-screen flex flex-col">
        <Header breadcrumbs={[{ label: t('common.admin') }, { label: t(labelKey) }]} />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
