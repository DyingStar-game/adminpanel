import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { ExplorerSearchSchema } from '@/lib/explorerSearch';

function ExplorerRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/explorer' });
  return (
    <ExplorerPage search={search} onSearchChange={(next) => void navigate({ search: next })} />
  );
}

export const Route = createFileRoute('/explorer')({
  validateSearch: ExplorerSearchSchema,
  component: ExplorerRoute,
});
