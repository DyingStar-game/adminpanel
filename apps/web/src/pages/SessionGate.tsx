import type { ReactNode } from 'react';
import { PermissionsContext } from '@/hooks/useCan';
import { useSession } from '@/hooks/useSession';
import { AccessDeniedPage, SessionUnavailablePage, SignInPage } from './SessionPages';

/** Nothing of the app before a session that opens it (ADR 0023). */
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.isPending) return null;
  if (session.signedOut) return <SignInPage />;
  if (!session.me) return <SessionUnavailablePage onRetry={() => void session.refetch()} />;
  if (!session.me.access) return <AccessDeniedPage username={session.me.user?.username ?? ''} />;
  return (
    <PermissionsContext.Provider value={session.me.permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}
