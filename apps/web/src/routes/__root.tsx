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
import { useGoToItem } from '@/hooks/useGoToItem';
import { ExplorerSearchSchema, searchForItem } from '@/lib/explorerSearch';
import { useExplorerTree, groupNodeId } from '@/stores/explorerTree';

const ROOTS = { parent: '', scope: 'level', page: 1 } as const;

/** Item shown by the current route (`/items/:uuid`, `/orbit/:uuid`), if any. */
const itemOfPath = (pathname: string) => /^\/(?:items|orbit)\/([^/]+)/.exec(pathname)?.[1];

function RootLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goToItem = useGoToItem();
  const expand = useExplorerTree((s) => s.expand);
  const location = useRouterState({ select: (s) => s.location });

  // The API has no name search (ADR 0007): only full UUIDs can be opened.
  const search = async (query: string) => {
    if (!UuidSchema.safeParse(query).success) return void toast.error(t('search.uuidOnly'));
    const item = await goToItem(query);
    if (!item) return void toast.error(t('explorer.notFound', { uuid: query }));
    openInExplorer(item);
  };

  const openInExplorer = (item: Item) => {
    const parent = item.object_data.parent_id;
    if (parent) expand([parent, groupNodeId(parent, item.object_type)]);
    void navigate({ to: '/explorer', search: searchForItem(item) });
  };

  // Every view of lot 1 is part of the persistence explorer, except the import.
  const activeNav: NavId = location.pathname.startsWith('/import') ? 'import' : 'explorer';

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

  /** Leaves the views of a deleted item: to its parent's page, or the explorer level. */
  const afterDelete = (item: Item) => {
    const parent = item.object_data.parent_id || '';
    if (itemOfPath(location.pathname) === item.object_uuid) {
      void (parent
        ? navigate({ to: '/items/$uuid', params: { uuid: parent } })
        : navigate({ to: '/explorer', search: ROOTS }));
      return;
    }
    const explorer = ExplorerSearchSchema.safeParse(location.search);
    if (explorer.success && explorer.data.selected === item.object_uuid) {
      void navigate({ to: '/explorer', search: { ...explorer.data, selected: undefined } });
    }
  };

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <Sidebar
            active={activeNav}
            onNavigate={(id) =>
              id === 'import' ? openImport() : void navigate({ to: '/explorer', search: ROOTS })
            }
            onHome={() => void navigate({ to: '/explorer', search: ROOTS })}
            version={APP_VERSION}
          />
        }
        topBar={
          <TopBar
            crumbs={[t('nav.admin'), t(`nav.items.${activeNav}`)]}
            onSearch={(query) => void search(query)}
          />
        }
      >
        <Outlet />
      </AppShell>
      <ItemActionsHost onCreated={openInExplorer} onDeleted={afterDelete} />
      {/* Dark only, like the first panel. */}
      <Toaster theme="dark" />
    </TooltipProvider>
  );
}

/** Version shown in the sidebar (the app package's). */
const APP_VERSION = '0.1.0';

export const Route = createRootRoute({ component: RootLayout });
