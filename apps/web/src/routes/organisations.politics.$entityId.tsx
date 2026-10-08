import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { OrganisationSearchSchema } from '@/lib/organisationsSearch';
import { PoliticalEntityPage } from '@/pages/PoliticalEntityPage';

function PoliticalEntityRoute() {
  const { entityId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <PoliticalEntityPage
      entityId={entityId}
      search={search}
      onSearchChange={(next) =>
        void navigate({
          to: '/organisations/politics/$entityId',
          params: { entityId },
          search: next,
          replace: true,
        })
      }
      // Back where the page was opened from (a player sheet, another organisation…).
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: '/organisations', search: { tab: 'politics', q: '', page: 1 } })
      }
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
      onOpenPoliticalEntity={(id) =>
        void navigate({
          to: '/organisations/politics/$entityId',
          params: { entityId: id },
          search: { members: 1, children: 1 },
        })
      }
    />
  );
}

export const Route = createFileRoute('/organisations/politics/$entityId')({
  validateSearch: OrganisationSearchSchema,
  component: PoliticalEntityRoute,
});
