import { useServerStore } from '@/stores/serverStore';

/**
 * Returns the currently selected game server id from the server store.
 */
export function useServerId(): string | null {
  return useServerStore((s) => s.activeServerId);
}

/**
 * Returns the full public server record for the active server, if any.
 */
export function useActiveServer() {
  return useServerStore((s) => s.getActiveServer());
}
