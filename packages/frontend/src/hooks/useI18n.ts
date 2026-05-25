import { translations, type Locale } from '@/i18n/translations';
import { useLocaleStore } from '@/stores/localeStore';

/** Dot-separated keys for nested translation objects (e.g. `nav.dashboard`). */
type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

/** Union of all message keys available in the English catalog. */
export type MessageKey = NestedKeyOf<(typeof translations)['en']>;

/**
 * Resolves a dot-separated path against a nested translation object.
 *
 * @param obj - Locale dictionary root
 * @param path - Key path such as `items.title`
 */
function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Replaces `{{name}}` placeholders in a template with provided values.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

/**
 * Internationalization hook: current locale, setter, and `t()` lookup with interpolation.
 */
export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const dict = translations[locale];

  /** Translates a message key; returns the key itself when the entry is missing. */
  const t = (key: MessageKey, vars?: Record<string, string | number>): string => {
    const value = getNested(dict as Record<string, unknown>, key);
    if (!value) return key;
    return interpolate(value, vars);
  };

  return { t, locale, setLocale, locales: ['en', 'fr'] as Locale[] };
}
