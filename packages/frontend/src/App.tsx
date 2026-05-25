import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/ToastContainer';
import { DashboardPage } from '@/pages/DashboardPage';
import { ServersPage } from '@/pages/ServersPage';
import { ItemsPage } from '@/pages/ItemsPage';
import { ImportPage } from '@/pages/ImportPage';
import { MissionsPage } from '@/pages/MissionsPage';
import { UsersPage } from '@/pages/UsersPage';
import { BansPage } from '@/pages/BansPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000 },
  },
});

/** Root application shell: React Query, routing, layout, and global toasts. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="servers" element={<ServersPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="missions" element={<MissionsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="bans" element={<BansPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
