import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { NpcSearchSchema } from '@/lib/npcSearch';
import { NpcPage } from '@/pages/NpcPage';

const ROSTER = { tab: 'roster', page: 1 } as const;

function NpcRoute() {
  const { npcId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <NpcPage
      // A new page per NPC: its tabs' state starts over.
      key={npcId}
      npcId={npcId}
      search={search}
      onSearchChange={(next) =>
        void navigate({ to: '/npcs/$npcId', params: { npcId }, search: next, replace: true })
      }
      // Back where the page was opened from (the roster with its filters, the events…).
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: '/npcs', search: ROSTER })
      }
      onDeleted={() => void navigate({ to: '/npcs', search: ROSTER })}
      onEditPattern={(pattern) =>
        void navigate({ to: '/npcs', search: { tab: 'routines', page: 1, pattern } })
      }
    />
  );
}

export const Route = createFileRoute('/npcs/$npcId')({
  validateSearch: NpcSearchSchema,
  component: NpcRoute,
});
