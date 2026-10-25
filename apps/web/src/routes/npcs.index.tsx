import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { NpcsSearchSchema } from '@/lib/npcSearch';
import { NpcsPage } from '@/pages/NpcsPage';

function NpcsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/npcs/' });
  return (
    <NpcsPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenNpc={(npcId) =>
        void navigate({ to: '/npcs/$npcId', params: { npcId }, search: { tab: 'overview' } })
      }
    />
  );
}

export const Route = createFileRoute('/npcs/')({
  validateSearch: NpcsSearchSchema,
  component: NpcsRoute,
});
