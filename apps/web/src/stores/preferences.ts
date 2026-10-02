import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { i18n, type Locale } from '@/i18n';

export type Theme = 'light' | 'dark' | 'system';

interface PreferencesState {
  locale: Locale;
  theme: Theme;
  /** Last game server picked by this viewer. */
  serverId: string | null;
  /** Live refresh toggle (ADR 0009). */
  live: boolean;
  /** Player chosen as "me" for "next to me" actions (no authentication, ADR 0002). */
  me: string | null;
  /** Types shown (`false`) or hidden (`true`) on planetary maps; profile default otherwise. */
  mapHidden: Record<string, boolean>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setServerId: (serverId: string) => void;
  setLive: (live: boolean) => void;
  setMe: (me: string | null) => void;
  setMapHidden: (objectType: string, hidden: boolean) => void;
}

/** Per-viewer UI preferences, persisted in localStorage. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'en',
      theme: 'system',
      serverId: null,
      live: true,
      me: null,
      mapHidden: {},
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
      setTheme: (theme) => set({ theme }),
      setServerId: (serverId) => set({ serverId }),
      setLive: (live) => set({ live }),
      setMe: (me) => set({ me }),
      setMapHidden: (objectType, hidden) =>
        set((s) => ({ mapHidden: { ...s.mapHidden, [objectType]: hidden } })),
    }),
    {
      name: 'dyingstar-admin-preferences',
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.locale);
      },
    },
  ),
);
