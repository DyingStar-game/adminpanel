import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PlayerRecordPage } from '@/pages/PlayerRecordPage';

function PlayerRecordRoute() {
  const { playerId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <PlayerRecordPage
      playerId={playerId}
      onBack={() => void navigate({ to: '/moderation', search: { tab: 'overview' } })}
      onOpenPlayer={(id) =>
        void navigate({ to: '/moderation/players/$playerId', params: { playerId: id } })
      }
      onOpenReport={(report) =>
        void navigate({ to: '/moderation', search: { tab: 'reports', report } })
      }
    />
  );
}

export const Route = createFileRoute('/moderation/players/$playerId')({
  component: PlayerRecordRoute,
});
