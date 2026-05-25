import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServerPublic } from '@dyingstar/shared';

/** Default when no prior selection — matches the live test stack (launcher: universe-testing). */
const DEFAULT_ACTIVE_SERVER_ID = 'universe-testing';

function resolveActiveServerId(
  servers: ServerPublic[],
  current: string | null,
): string | null {
  if (servers.length === 0) return null;
  if (current && servers.some((s) => s.id === current)) return current;
  const preferred = servers.find((s) => s.id === DEFAULT_ACTIVE_SERVER_ID);
  return preferred?.id ?? servers[0]?.id ?? null;
}

interface ServerState {
  servers: ServerPublic[];
  activeServerId: string | null;
  setServers: (servers: ServerPublic[]) => void;
  setActiveServer: (id: string) => void;
  getActiveServer: () => ServerPublic | undefined;
}

/** Persisted store for the server list and the user's active server selection. */
export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: [],
      activeServerId: null,
      /** Replaces the server list and keeps or resets the active id if it is no longer valid. */
      setServers: (servers) => {
        set({
          servers,
          activeServerId: resolveActiveServerId(servers, get().activeServerId),
        });
      },
      /** Sets the active server by id. */
      setActiveServer: (id) => set({ activeServerId: id }),
      /** Returns the active server record, if it exists in the current list. */
      getActiveServer: () => {
        const { servers, activeServerId } = get();
        return servers.find((s) => s.id === activeServerId);
      },
    }),
    { name: 'dyingstar-active-server' },
  ),
);
