import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/atoms/BrandMark';
import { LiveToggle } from '@/components/molecules/LiveToggle';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { SearchBar } from '@/components/molecules/SearchBar';
import { ThemeToggle } from '@/components/molecules/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useServers } from '@/hooks/useServers';
import { LOCALES, type Locale } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

interface TopBarProps {
  onSearch: (query: string) => void;
  onCreate: () => void;
}

/** Application header from the mock-up: brand, game server, search, live, theme, language. */
export function TopBar({ onSearch, onCreate }: TopBarProps) {
  const { t } = useTranslation();
  const { live, setLive, locale, setLocale, setTheme } = usePreferences();
  const resolved = useResolvedTheme();
  const { servers, selected, select } = useServers();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b bg-background pr-3 pl-4">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <BrandMark />
        <span className="font-semibold tracking-tight">{t('app.brand')}</span>
        <span className="text-fg-3">/</span>
        <span className="font-medium">{t('app.section')}</span>
        <OptionSelect
          label={t('topBar.server')}
          value={selected?.id}
          placeholder={t('topBar.noServer')}
          options={servers.map((s) => ({ value: s.id, label: s.name }))}
          onChange={select}
          className="ml-1 font-mono"
        />
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <SearchBar placeholder={t('topBar.searchPlaceholder')} onSubmit={onSearch} />
      </div>
      <LiveToggle
        live={live}
        onToggle={() => setLive(!live)}
        labels={{ on: t('live.on'), off: t('live.off'), toggle: t('live.toggle') }}
      />
      <ThemeToggle
        resolved={resolved}
        label={t('theme.toggle')}
        onToggle={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
      />
      <OptionSelect<Locale>
        label={t('language.label')}
        value={locale}
        options={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
        onChange={setLocale}
        className="w-[62px]"
      />
      <Button size="sm" onClick={onCreate}>
        <PlusIcon />
        {t('topBar.newItem')}
      </Button>
    </header>
  );
}
