import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { MissionsSearchSchema } from '@/lib/missionsSearch';
import { MissionsPage } from '@/pages/MissionsPage';

function MissionsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/missions/' });
  return (
    <MissionsPage
      search={search}
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
      onOpenMission={(missionId) =>
        void navigate({ to: '/missions/$missionId', params: { missionId } })
      }
    />
  );
}

export const Route = createFileRoute('/missions/')({
  validateSearch: MissionsSearchSchema,
  component: MissionsRoute,
});
