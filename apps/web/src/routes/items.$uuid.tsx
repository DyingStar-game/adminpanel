import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { searchForItem } from '@/lib/explorerSearch';
import { ObjectPage } from '@/pages/ObjectPage';

function ObjectRoute() {
  const { uuid } = Route.useParams();
  const navigate = useNavigate();
  return (
    <ObjectPage
      uuid={uuid}
      onNavigate={(target) =>
        void (target
          ? navigate({ to: '/items/$uuid', params: { uuid: target } })
          : navigate({ to: '/explorer', search: { parent: '', scope: 'level', page: 1 } }))
      }
      onOpenInExplorer={(item) => void navigate({ to: '/explorer', search: searchForItem(item) })}
    />
  );
}

export const Route = createFileRoute('/items/$uuid')({ component: ObjectRoute });
