import { usePanel } from './usePanel';

/** Game server receiving writes; production writes ask for an extra confirmation (ADR 0004). */
export function useWriteTarget() {
  const { gameServerName, environment } = usePanel();
  return { serverName: gameServerName ?? '', isProduction: environment === 'production' };
}
