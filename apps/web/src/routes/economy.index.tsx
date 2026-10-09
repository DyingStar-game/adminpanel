import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { EconomySearchSchema } from '@/lib/economySearch';
import { EconomyPage } from '@/pages/EconomyPage';

function EconomyRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/economy/' });
  return (
    <EconomyPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenPlayer={(playerId) => void navigate({ to: '/players/$playerId', params: { playerId } })}
      onOpenCorporation={(corporationId) =>
        void navigate({
          to: '/organisations/corporations/$corporationId',
          params: { corporationId },
          search: { members: 1, children: 1 },
        })
      }
    />
  );
}

export const Route = createFileRoute('/economy/')({
  validateSearch: EconomySearchSchema,
  component: EconomyRoute,
});
