import { useServers } from './useServers';

/** Server receiving writes; production writes ask for an extra confirmation (ADR 0004). */
export function useWriteTarget() {
  const { selected } = useServers();
  return { server: selected, isProduction: selected?.environment === 'production' };
}
