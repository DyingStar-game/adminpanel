import { useState, type ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LiveToggle } from '@/components/molecules/LiveToggle';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ItemSearch } from '@/components/molecules/ItemSearch';
import { useCan } from '@/hooks/useCan';
import { useItemSearch } from '@/hooks/useItemSearch';
import { usePanel } from '@/hooks/usePanel';
import { LOCALES, type Locale } from '@/i18n';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/stores/preferences';

interface TopBarProps {
  /** Breadcrumb of the page on screen, e.g. `Admin › Explorer`. */
  crumbs: string[];
  /** An item picked in the search, or a query submitted with no result (a full UUID). */
  onSearch: (query: string) => void;
  /** The signed-in user's menu, at the far end (none when the BFF runs without sign-in). */
  account?: ReactNode;
}

/**
 * Header of the first DyingStar panel: breadcrumb, then search, live refresh, language, the
 * panel's game server and the signed-in user. Brand and navigation are in the sidebar; page actions
 * (Add an item) are in each page's title.
 */
export function TopBar({ crumbs, onSearch, account }: TopBarProps) {
  const { t } = useTranslation();
  const { live, setLive, locale, setLocale } = usePreferences();
  const { gameServerName, environment } = usePanel();
  // Search of the whole universe by a piece of name or UUID.
  const [query, setQuery] = useState('');
  const search = useItemSearch(query);
  // Searching items reads persistence (ADR 0023).
  const canSearch = useCan()('persistence.read');

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b bg-background/90 px-6 py-3 backdrop-blur">
      <nav aria-label={t('nav.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRightIcon className="size-3.5 text-fg-3" aria-hidden />}
            <span className={cn(i === crumbs.length - 1 ? 'text-foreground' : 'text-fg-3')}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 justify-center">
        {canSearch && (
          <ItemSearch
            className="w-110 max-w-full"
            query={query}
            onQueryChange={setQuery}
            results={search.results}
            loading={search.loading}
            total={search.total}
            onPick={onSearch}
            onSubmit={(value) => {
              setQuery('');
              onSearch(value);
            }}
            labels={{
              field: t('topBar.searchPlaceholder'),
              empty: t('topBar.searchEmpty'),
              loading: t('topBar.searchLoading'),
              more: (shown, total) => t('topBar.searchMore', { shown, total }),
            }}
          />
        )}
      </div>
      <LiveToggle
        live={live}
        onToggle={() => setLive(!live)}
        labels={{
          on: t('live.on'),
          off: t('live.off'),
          toggle: t('live.toggle'),
          hint: t('live.freshness'),
        }}
      />
      <OptionSelect<Locale>
        label={t('language.label')}
        value={locale}
        options={LOCALES.map((l) => ({ value: l, label: l === 'en' ? 'English' : 'Français' }))}
        onChange={setLocale}
        className="w-26"
      />
      <div className="flex items-center gap-2 border-l pl-3 text-sm">
        <span
          aria-hidden
          className={cn('size-2 rounded-full', gameServerName ? 'bg-success' : 'bg-amber-500')}
        />
        {environment && (
          <span
            title={t('environment.hint')}
            className={cn(
              'rounded border px-1.5 py-0.5 text-2xs font-semibold tracking-wider uppercase',
              environment === 'production'
                ? 'border-destructive/50 text-destructive'
                : 'border-amber-500/50 text-amber-500',
            )}
          >
            {t(`environment.names.${environment}`, { defaultValue: environment })}
          </span>
        )}
        <span className="text-fg-3">{t('topBar.serverLabel')}</span>
        <span className="font-medium text-link">{gameServerName ?? '—'}</span>
      </div>
      {account && <div className="border-l pl-3">{account}</div>}
    </header>
  );
}
