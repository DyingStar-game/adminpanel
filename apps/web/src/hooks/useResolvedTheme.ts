import { useEffect, useSyncExternalStore } from 'react';
import { usePreferences } from '@/stores/preferences';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(onChange: () => void) {
  const mql = query();
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Light or dark, following the OS when the preference is `system`. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePreferences((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, () => query().matches);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Applies the resolved theme as the `dark` class on `<html>` (shadcn convention). */
export function useApplyTheme(): 'light' | 'dark' {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);
  return resolved;
}
