import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PlaceNamesSearchSchema } from '@/lib/placeNamesSearch';
import { PlaceNamesPage } from '@/pages/PlaceNamesPage';

function PlaceNamesRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/exploration/names' });
  return (
    <PlaceNamesPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
      onOpenItem={(uuid) => void navigate({ to: '/items/$uuid', params: { uuid } })}
    />
  );
}

export const Route = createFileRoute('/exploration/names')({
  validateSearch: PlaceNamesSearchSchema,
  component: PlaceNamesRoute,
});
