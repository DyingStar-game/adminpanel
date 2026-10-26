import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SimulationSearchSchema } from '@/lib/simulationSearch';
import { SimulationPage } from '@/pages/SimulationPage';

function SimulationRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/simulation/' });
  return (
    <SimulationPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenMission={(missionId) =>
        void navigate({ to: '/missions/$missionId', params: { missionId } })
      }
    />
  );
}

export const Route = createFileRoute('/simulation/')({
  validateSearch: SimulationSearchSchema,
  component: SimulationRoute,
});
