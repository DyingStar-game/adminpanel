import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { UuidSchema } from '@dyingstar-admin/schemas';
import { TopBar } from '@/components/organisms/TopBar';
import { AppShell } from '@/components/templates/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGoToItem } from '@/hooks/useGoToItem';
import { useApplyTheme } from '@/hooks/useResolvedTheme';
import { searchForItem } from '@/lib/explorerSearch';
import { useExplorerTree, groupNodeId } from '@/stores/explorerTree';

function RootLayout() {
  const theme = useApplyTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goToItem = useGoToItem();
  const expand = useExplorerTree((s) => s.expand);

  // The API has no name search (ADR 0007): only full UUIDs can be opened.
  const search = async (query: string) => {
    if (!UuidSchema.safeParse(query).success) return void toast.error(t('search.uuidOnly'));
    const item = await goToItem(query);
    if (!item) return void toast.error(t('explorer.notFound', { uuid: query }));
    const parent = item.object_data.parent_id;
    if (parent) expand([parent, groupNodeId(parent, item.object_type)]);
    void navigate({ to: '/explorer', search: searchForItem(item) });
  };

  return (
    <TooltipProvider>
      <AppShell
        topBar={
          <TopBar
            onSearch={(query) => void search(query)}
            // Creation arrives with write operations (lot 1, step 8).
            onCreate={() => toast(t('topBar.newItem'))}
          />
        }
      >
        <Outlet />
      </AppShell>
      <Toaster theme={theme} />
    </TooltipProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
