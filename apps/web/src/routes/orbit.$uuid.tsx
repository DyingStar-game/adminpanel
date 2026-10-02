import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { searchForItem } from '@/lib/explorerSearch';
import { OrbitSearchSchema } from '@/lib/orbitSearch';
import { OrbitPage } from '@/pages/OrbitPage';

function OrbitRoute() {
  const { uuid } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <OrbitPage
      uuid={uuid}
      search={search}
      onSearchChange={(next) =>
        void navigate({ to: '/orbit/$uuid', params: { uuid }, search: next })
      }
      onRecenter={(target, selected) =>
        void navigate({
          to: '/orbit/$uuid',
          params: { uuid: target },
          search: { selected },
        })
      }
      onOpenPage={(target) => void navigate({ to: '/items/$uuid', params: { uuid: target } })}
      onOpenInExplorer={(item) => void navigate({ to: '/explorer', search: searchForItem(item) })}
      onOpenMap={(target) => void navigate({ to: '/map/$uuid', params: { uuid: target } })}
    />
  );
}

export const Route = createFileRoute('/orbit/$uuid')({
  validateSearch: OrbitSearchSchema,
  component: OrbitRoute,
});
