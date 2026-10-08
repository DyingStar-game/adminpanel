import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useCan } from '@/hooks/useCan';
import { useServers } from '@/hooks/useServers';

/** Home: the persistence explorer, or moderation for an account that may only moderate. */
function Home() {
  const can = useCan();
  const { services, isPending } = useServers();
  if (!can('persistence.read') && isPending) return null;
  if (!can('persistence.read') && services.includes('social') && can('social.moderate')) {
    return <Navigate to="/moderation" search={{ tab: 'overview' }} replace />;
  }
  return <Navigate to="/explorer" search={{ parent: '', scope: 'level', page: 1 }} replace />;
}

export const Route = createFileRoute('/')({ component: Home });
