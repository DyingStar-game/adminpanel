import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { MapSearchSchema } from '@/lib/mapSearch';
import { MapPage } from '@/pages/MapPage';

function MapRoute() {
  const { uuid } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <MapPage
      uuid={uuid}
      search={search}
      onSearchChange={(next) =>
        void navigate({ to: '/map/$uuid', params: { uuid }, search: next, replace: true })
      }
      onOpenPage={(target) => void navigate({ to: '/items/$uuid', params: { uuid: target } })}
      // The body's own level: what it holds.
      onOpenInExplorer={(target) =>
        void navigate({ to: '/explorer', search: { parent: target, scope: 'level', page: 1 } })
      }
      onOpenOrbit={(target) =>
        void navigate({ to: '/orbit/$uuid', params: { uuid: target }, search: { page: 1 } })
      }
    />
  );
}

export const Route = createFileRoute('/map/$uuid')({
  validateSearch: MapSearchSchema,
  component: MapRoute,
});
