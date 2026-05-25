import { Breadcrumb, StatusDot, Select } from '@/components/ui';
import { useActiveServer } from '@/hooks/useApi';
import { useI18n } from '@/hooks/useI18n';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb';
import type { Locale } from '@/i18n/translations';

/** Top bar with breadcrumbs, locale switcher, and active server status. */
export function Header({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
  const server = useActiveServer();
  const { t, locale, setLocale, locales } = useI18n();

  return (
    <header className="sticky top-0 z-20 bg-ds-bg/90 backdrop-blur border-b border-ds-border px-6 py-4 flex items-center justify-between">
      <Breadcrumb items={breadcrumbs} />
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="locale-select" className="sr-only">
            Language
          </label>
          <Select
            id="locale-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-auto min-w-[88px] py-1.5 text-xs"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {l === 'en' ? 'English' : 'Français'}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3 border-l border-ds-border pl-4">
          <StatusDot status={server ? 'online' : 'warning'} />
          <span className="text-ds-muted">{t('header.serverLabel')}</span>
          <span className="font-medium text-ds-text">{server?.name ?? '—'}</span>
        </div>
      </div>
    </header>
  );
}
