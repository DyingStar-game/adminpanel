import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { OrganisationSearchSchema } from '@/lib/organisationsSearch';
import { CorporationPage } from '@/pages/CorporationPage';

const FIRST = { members: 1, children: 1 };

function CorporationRoute() {
  const { corporationId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <CorporationPage
      corporationId={corporationId}
      search={search}
      onSearchChange={(next) =>
        void navigate({
          to: '/organisations/corporations/$corporationId',
          params: { corporationId },
          search: next,
          replace: true,
        })
      }
      onDisbanded={() =>
        void navigate({ to: '/organisations', search: { tab: 'corporations', q: '', page: 1 } })
      }
      // Back where the page was opened from (a player sheet, another organisation…).
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: '/organisations', search: { tab: 'corporations', q: '', page: 1 } })
      }
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
      onOpenCorporation={(id) =>
        void navigate({
          to: '/organisations/corporations/$corporationId',
          params: { corporationId: id },
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

export const Route = createFileRoute('/organisations/corporations/$corporationId')({
  validateSearch: OrganisationSearchSchema,
  component: CorporationRoute,
});
