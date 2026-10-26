import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { MissionPage } from '@/pages/MissionPage';

const FIRST = { members: 1, children: 1 };

function MissionRoute() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <MissionPage
      missionId={missionId}
      // Back where the page was opened from (the catalogue with its filters, another mission…).
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: '/missions', search: { page: 1 } })
      }
      onOpenMission={(id) =>
        void navigate({ to: '/missions/$missionId', params: { missionId: id } })
      }
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
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
      onOpenSimulationOrders={({ resource, village }) =>
        void navigate({ to: '/simulation', search: { tab: 'orders', resource, village } })
      }
    />
  );
}

export const Route = createFileRoute('/missions/$missionId')({ component: MissionRoute });
