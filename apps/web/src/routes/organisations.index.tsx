import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { OrganisationsSearchSchema } from '@/lib/organisationsSearch';
import { OrganisationsPage } from '@/pages/OrganisationsPage';

const FIRST = { members: 1, children: 1 };

function OrganisationsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/organisations/' });
  return (
    <OrganisationsPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenCorporation={(corporationId) =>
        void navigate({
          to: '/organisations/corporations/$corporationId',
          params: { corporationId },
          search: FIRST,
        })
      }
      onOpenPoliticalEntity={(entityId) =>
        void navigate({
          to: '/organisations/politics/$entityId',
          params: { entityId },
          search: FIRST,
        })
      }
    />
  );
}

export const Route = createFileRoute('/organisations/')({
  validateSearch: OrganisationsSearchSchema,
  component: OrganisationsRoute,
});
