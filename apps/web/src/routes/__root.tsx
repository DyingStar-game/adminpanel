import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { UuidSchema, type Item } from '@dyingstar-admin/schemas';
import { ItemActionsHost } from '@/components/organisms/ItemActionsHost';
import { TopBar } from '@/components/organisms/TopBar';
import { AppShell } from '@/components/templates/AppShell';
import { Sidebar, type NavId } from '@/components/organisms/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { UserMenu } from '@/components/molecules/UserMenu';
import { useCan } from '@/hooks/useCan';
import { useGoToItem } from '@/hooks/useGoToItem';
import { signOut, useSession } from '@/hooks/useSession';
import { ExplorerSearchSchema, searchForItem } from '@/lib/explorerSearch';
import { MapSearchSchema } from '@/lib/mapSearch';
import { OrbitSearchSchema } from '@/lib/orbitSearch';
import { useExplorerTree, groupNodeId } from '@/stores/explorerTree';

const ROOTS = { parent: '', scope: 'level', page: 1 } as const;

/** Canvas on screen (`/map/:uuid`, `/orbit/:uuid`) and its body / centre. */
const canvasOfPath = (pathname: string) => {
  const match = /^\/(map|orbit)\/([^/]+)/.exec(pathname);
  return match ? { view: match[1] as 'map' | 'orbit', uuid: match[2] ?? '' } : null;
};

/** Item shown by the current route (`/items/:uuid`, `/orbit/:uuid`), if any. */
const itemOfPath = (pathname: string) => /^\/(?:items|orbit)\/([^/]+)/.exec(pathname)?.[1];

function RootLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goToItem = useGoToItem();
  const expand = useExplorerTree((s) => s.expand);
  const location = useRouterState({ select: (s) => s.location });
  const { me } = useSession();
  const can = useCan();

  // The API has no name search (ADR 0007): only full UUIDs can be opened.
  const search = async (query: string) => {
    if (!UuidSchema.safeParse(query).success)
      return void toast.error(t('search.uuidOnly', { query }));
    const item = await goToItem(query);
    if (!item) return void toast.error(t('explorer.notFound', { uuid: query }));
    openInExplorer(item);
  };

  const openInExplorer = (item: Item) => {
    const parent = item.object_data.parent_id;
    if (parent) expand([parent, groupNodeId(parent, item.object_type)]);
    void navigate({ to: '/explorer', search: searchForItem(item) });
  };

  // Section of the page on screen; every other view belongs to the persistence explorer.
  const activeNav: NavId = location.pathname.startsWith('/import')
    ? 'import'
    : location.pathname.startsWith('/moderation')
      ? 'moderation'
      : 'explorer';
  // Pages of a service the account may not open say so instead of failing call by call.
  const allowed = activeNav === 'moderation' ? can('social.moderate') : can('persistence.read');
  const deniedKey = activeNav === 'moderation' ? 'moderation.forbidden' : 'session.noReadRight';

  /** Level on screen: the item being viewed, or the listed explorer level. */
  const levelOnScreen = () => {
    const viewed = itemOfPath(location.pathname);
    if (viewed) return { parentId: viewed, objectType: undefined };
    const explorer = ExplorerSearchSchema.safeParse(location.search);
    const level = explorer.success && explorer.data.scope === 'level' ? explorer.data : null;
    return level ? { parentId: level.parent, objectType: level.type } : null;
  };

  /** The import gives the level on screen to items without a parent (ADR 0019). */
  const openImport = () => {
    const level = levelOnScreen();
    void navigate({ to: '/import', search: level ? { parent: level.parentId } : {} });
  };

  /**
   * Leaves the views of a deleted item: to its parent's page, or the explorer level. On the map
   * and the orbit view, the page stays (refreshed) and only the selection is cleared.
   */
  const afterDelete = (item: Item) => {
    const parent = item.object_data.parent_id || '';
    if (itemOfPath(location.pathname) === item.object_uuid) {
      void (parent
        ? navigate({ to: '/items/$uuid', params: { uuid: parent } })
        : navigate({ to: '/explorer', search: ROOTS }));
      return;
    }
    const canvas = canvasOfPath(location.pathname);
    if (canvas) {
      const map = MapSearchSchema.safeParse(location.search);
      if (canvas.view === 'map' && map.success && map.data.selected === item.object_uuid) {
        void navigate({ to: '/map/$uuid', params: { uuid: canvas.uuid }, search: {} });
      }
      const orbit = OrbitSearchSchema.safeParse(location.search);
      if (canvas.view === 'orbit' && orbit.success && orbit.data.selected === item.object_uuid) {
        void navigate({
          to: '/orbit/$uuid',
          params: { uuid: canvas.uuid },
          search: { ...orbit.data, selected: undefined },
        });
      }
      return;
    }
    const explorer = ExplorerSearchSchema.safeParse(location.search);
    if (explorer.success && explorer.data.selected === item.object_uuid) {
      void navigate({ to: '/explorer', search: { ...explorer.data, selected: undefined } });
    }
  };

  /**
   * After a creation (or a duplication): on the map, stay and select the new item; on the orbit
   * view, select it if it is a child of the centre; elsewhere, show it in the explorer.
   */
  const afterCreate = (item: Item) => {
    const canvas = canvasOfPath(location.pathname);
    if (canvas?.view === 'map') {
      void navigate({
        to: '/map/$uuid',
        params: { uuid: canvas.uuid },
        search: { selected: item.object_uuid },
      });
      return;
    }
    if (canvas?.view === 'orbit' && item.object_data.parent_id === canvas.uuid) {
      const orbit = OrbitSearchSchema.parse(location.search);
      void navigate({
        to: '/orbit/$uuid',
        params: { uuid: canvas.uuid },
        search: {
          ...orbit,
          open: orbit.open.includes(item.object_type)
            ? orbit.open
            : [...orbit.open, item.object_type],
          selected: item.object_uuid,
        },
      });
      return;
    }
    openInExplorer(item);
  };

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <Sidebar
            active={activeNav}
            onNavigate={(id) =>
              id === 'import'
                ? openImport()
                : id === 'moderation'
                  ? void navigate({ to: '/moderation', search: { tab: 'overview' } })
                  : void navigate({ to: '/explorer', search: ROOTS })
            }
            onHome={() => void navigate({ to: '/' })}
            version={APP_VERSION}
          />
        }
        topBar={
          <TopBar
            crumbs={[t('nav.admin'), t(`nav.items.${activeNav}`)]}
            onSearch={(query) => void search(query)}
            account={
              me?.user && (
                <UserMenu
                  username={me.user.username}
                  name={me.user.name}
                  roles={me.roles}
                  onSignOut={() => void signOut()}
                  labels={{
                    account: t('session.account'),
                    signedInAs: t('session.signedInAs'),
                    roles: t('session.roles'),
                    noRoles: t('session.noRoles'),
                    signOut: t('session.signOut'),
                  }}
                />
              )
            }
          />
        }
      >
        {allowed ? <Outlet /> : <ServiceNotice message={t(deniedKey)} />}
      </AppShell>
      <ItemActionsHost onCreated={afterCreate} onDeleted={afterDelete} />
      {/* Dark only, like the first panel. */}
      <Toaster theme="dark" />
    </TooltipProvider>
  );
}

/** Version shown in the sidebar (the app package's). */
const APP_VERSION = '0.1.0';

export const Route = createRootRoute({ component: RootLayout });
