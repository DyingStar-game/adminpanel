import { Outlet, createRootRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { TopBar } from '@/components/organisms/TopBar';
import { AppShell } from '@/components/templates/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useApplyTheme } from '@/hooks/useResolvedTheme';

function RootLayout() {
  const theme = useApplyTheme();
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <AppShell
        topBar={
          <TopBar
            // Navigation to items arrives with the explorer (lot 1, step 4).
            onSearch={(query) => toast(query)}
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
