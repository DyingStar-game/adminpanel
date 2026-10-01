import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { i18n, type Locale } from '@/i18n';

interface PreferencesState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/** Per-viewer UI preferences, persisted in localStorage. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'dyingstar-admin-preferences',
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.locale);
      },
    },
  ),
);
