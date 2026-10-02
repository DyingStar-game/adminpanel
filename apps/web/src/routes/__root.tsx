import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { UuidSchema, type Item } from '@dyingstar-admin/schemas';
import { ItemActionsHost } from '@/components/organisms/ItemActionsHost';
import { TopBar } from '@/components/organisms/TopBar';
import { AppShell } from '@/components/templates/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGoToItem } from '@/hooks/useGoToItem';
import { useApplyTheme } from '@/hooks/useResolvedTheme';
import { ExplorerSearchSchema, searchForItem } from '@/lib/explorerSearch';
import { useExplorerTree, groupNodeId } from '@/stores/explorerTree';
import { useItemActions } from '@/stores/itemActions';

const ROOTS = { parent: '', scope: 'level', page: 1 } as const;

/** Item shown by the current route (`/items/:uuid`, `/orbit/:uuid`), if any. */
const itemOfPath = (pathname: string) => /^\/(?:items|orbit)\/([^/]+)/.exec(pathname)?.[1];

function RootLayout() {
  const theme = useApplyTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goToItem = useGoToItem();
  const expand = useExplorerTree((s) => s.expand);
  const location = useRouterState({ select: (s) => s.location });
  const createItem = useItemActions((s) => s.create);

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

  /** New items go into the level on screen: the listed level, or the item being viewed. */
  const create = () => {
    const viewed = itemOfPath(location.pathname);
    if (viewed) return createItem({ parentId: viewed });
    const explorer = ExplorerSearchSchema.safeParse(location.search);
    const level = explorer.success && explorer.data.scope === 'level' ? explorer.data : null;
    createItem({ parentId: level?.parent ?? '', objectType: level?.type });
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
        topBar={
          <TopBar
            onHome={() => void navigate({ to: '/explorer', search: ROOTS })}
            onSearch={(query) => void search(query)}
            onCreate={create}
          />
        }
      >
        <Outlet />
      </AppShell>
      <ItemActionsHost onCreated={openInExplorer} onDeleted={afterDelete} />
      <Toaster theme={theme} />
    </TooltipProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
