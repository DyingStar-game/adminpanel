import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/i18n/translations';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/** Persisted UI locale preference (`en` or `fr`). */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      /** Updates the active locale. */
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'dyingstar-locale' },
  ),
);
