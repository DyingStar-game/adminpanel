import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ModerationSearchSchema } from '@/lib/moderationSearch';
import { ModerationPage } from '@/pages/ModerationPage';

function ModerationRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/moderation/' });
  return (
    <ModerationPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next })}
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
    />
  );
}

export const Route = createFileRoute('/moderation/')({
  validateSearch: ModerationSearchSchema,
  component: ModerationRoute,
});
