import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { PlayerRecordPage } from '@/pages/PlayerRecordPage';

function PlayerRecordRoute() {
  const { playerId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <PlayerRecordPage
      playerId={playerId}
      // Back where the sheet was opened from (players, moderation…), else to the players.
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: '/players', search: { q: '', page: 1 } })
      }
      onOpenPlayer={(id) => void navigate({ to: '/players/$playerId', params: { playerId: id } })}
      onOpenItem={(uuid) => void navigate({ to: '/items/$uuid', params: { uuid } })}
      onOpenMap={(body, selected) =>
        void navigate({ to: '/map/$uuid', params: { uuid: body }, search: { selected } })
      }
      onOpenReport={(report) =>
        void navigate({ to: '/moderation', search: { tab: 'reports', report } })
      }
      onOpenCorporation={(corporationId) =>
        void navigate({
          to: '/organisations/corporations/$corporationId',
          params: { corporationId },
          search: { members: 1, children: 1 },
        })
      }
      onOpenPoliticalEntity={(entityId) =>
        void navigate({
          to: '/organisations/politics/$entityId',
          params: { entityId },
          search: { members: 1, children: 1 },
        })
      }
    />
  );
}

export const Route = createFileRoute('/players/$playerId')({
  component: PlayerRecordRoute,
});
