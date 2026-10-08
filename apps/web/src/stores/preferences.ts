import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { i18n, type Locale } from '@/i18n';

interface PreferencesState {
  locale: Locale;
  /** Live refresh toggle (ADR 0009). */
  live: boolean;
  /** Player chosen as "me" for "next to me" actions (no authentication, ADR 0002). */
  me: string | null;
  /** Types shown (`false`) or hidden (`true`) on planetary maps; profile default otherwise. */
  mapHidden: Record<string, boolean>;
  /** Types whose names are written above their markers on planetary maps. */
  mapNamed: Record<string, boolean>;
  /** Sidebar reduced to its icons. */
  sidebarCollapsed: boolean;
  setLocale: (locale: Locale) => void;
  setLive: (live: boolean) => void;
  setMe: (me: string | null) => void;
  setMapHidden: (objectType: string, hidden: boolean) => void;
  setMapNamed: (objectType: string, named: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/** Per-viewer UI preferences, persisted in localStorage. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'en',
      live: true,
      me: null,
      mapHidden: {},
      mapNamed: {},
      sidebarCollapsed: false,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
      setLive: (live) => set({ live }),
      setMe: (me) => set({ me }),
      setMapHidden: (objectType, hidden) =>
        set((s) => ({ mapHidden: { ...s.mapHidden, [objectType]: hidden } })),
      setMapNamed: (objectType, named) =>
        set((s) => ({ mapNamed: { ...s.mapNamed, [objectType]: named } })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'dyingstar-admin-preferences',
      // 1: no more `serverId` (one game server per panel, ADR 0024).
      version: 1,
      migrate: (persisted) => {
        const state = { ...(persisted as Record<string, unknown>) };
        delete state.serverId;
        return state as unknown as PreferencesState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.locale);
      },
    },
  ),
);
