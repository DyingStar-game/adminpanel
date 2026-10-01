import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HealthResponseSchema } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import { apiGet } from '@/lib/api';

/** Placeholder content until the explorer (step 4): checks that the BFF is reachable. */
export function HomePage() {
  const { t } = useTranslation();
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
    <div className="grid flex-1 place-items-center bg-surface-2 bg-[radial-gradient(var(--color-grid-dot)_1px,transparent_1px)] bg-size-[20px_20px]">
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-background px-6 py-5 text-center">
        <p className="text-sm font-semibold tracking-tight">{t('home.heading')}</p>
        <p className="text-xs text-fg-2">{t('home.next')}</p>
        <MonoText tone="muted" data-testid="bff-status">
          {t('home.bff')} : {bffStatus}
        </MonoText>
      </div>
    </div>
  );
}
