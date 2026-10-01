import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { ExplorerSearchSchema } from '@/lib/explorerSearch';

function ExplorerRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/explorer' });
  return (
    <ExplorerPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next })}
      onOpen={(uuid) => void navigate({ to: '/items/$uuid', params: { uuid } })}
      onOrbit={(uuid) =>
        void navigate({ to: '/orbit/$uuid', params: { uuid }, search: { page: 1 } })
      }
    />
  );
}

export const Route = createFileRoute('/explorer')({
  validateSearch: ExplorerSearchSchema,
  component: ExplorerRoute,
});
