import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HealthResponseSchema } from '@dyingstar-admin/schemas';
import { apiGet } from '@/lib/api';
import { LOCALES } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

/** Placeholder page of the foundation step: checks that the BFF is reachable. */
export function HomePage() {
  const { t } = useTranslation();
  const { locale, setLocale } = usePreferences();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/health', HealthResponseSchema),
  });

  const bffStatus = health.isPending
    ? t('home.bffLoading')
    : health.isError
      ? t('home.bffDown')
      : t('home.bffOk', { version: health.data.version });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-10 font-sans">
      <h1 className="text-xl font-semibold tracking-tight">
        {t('app.title')} <span className="text-zinc-500">/ {t('app.subtitle')}</span>
      </h1>
      <p className="text-sm text-zinc-600">{t('home.heading')}</p>
      <p className="font-mono text-sm" data-testid="bff-status">
        {t('home.bff')} : {bffStatus}
      </p>
      <label className="flex items-center gap-2 text-sm">
        {t('language.label')}
        <select
          className="rounded border border-zinc-300 px-2 py-1"
          value={locale}
          onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`language.${l}`)}
            </option>
          ))}
        </select>
      </label>
    </main>
  );
}
