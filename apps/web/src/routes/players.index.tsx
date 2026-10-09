import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PlayersSearchSchema } from '@/lib/playersSearch';
import { PlayersPage } from '@/pages/PlayersPage';

function PlayersRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/players/' });
  return (
    <PlayersPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
    />
  );
}

export const Route = createFileRoute('/players/')({
  validateSearch: PlayersSearchSchema,
  component: PlayersRoute,
});
