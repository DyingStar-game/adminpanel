import {
  BoxesIcon,
  LayoutDashboardIcon,
  ServerIcon,
  SettingsIcon,
  ShieldOffIcon,
  UploadIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GithubMark } from '@/components/atoms/GithubMark';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { useServers } from '@/hooks/useServers';
import { cn } from '@/lib/cn';

export type NavId = 'dashboard' | 'servers' | 'explorer' | 'import' | 'users' | 'bans' | 'settings';

interface SidebarProps {
  /** Section of the page on screen. */
  active: NavId | null;
  onNavigate: (id: NavId) => void;
  /** Brand click: back to the main view (explorer). */
  onHome: () => void;
  version: string;
}

interface NavItem {
  id: NavId;
  icon: LucideIcon;
  /** Not built yet (later lots): shown, not clickable. */
  soon?: boolean;
}

const SECTIONS: {
  title: 'supervision' | 'gameWorld' | 'administration' | 'configuration';
  items: NavItem[];
}[] = [
  {
    title: 'supervision',
    items: [
      { id: 'dashboard', icon: LayoutDashboardIcon, soon: true },
      { id: 'servers', icon: ServerIcon, soon: true },
    ],
  },
  {
    title: 'gameWorld',
    items: [
      { id: 'explorer', icon: BoxesIcon },
      { id: 'import', icon: UploadIcon },
    ],
  },
  {
    title: 'administration',
    items: [
      { id: 'users', icon: UsersIcon, soon: true },
      { id: 'bans', icon: ShieldOffIcon, soon: true },
    ],
  },
  { title: 'configuration', items: [{ id: 'settings', icon: SettingsIcon, soon: true }] },
];

/** Fixed left navigation of the first DyingStar panel: brand, game server, sections. */
export function Sidebar({ active, onNavigate, onHome, version }: SidebarProps) {
  const { t } = useTranslation();
  const { servers, selected, select } = useServers();

  return (
    <aside
      aria-label={t('nav.label')}
      className="flex h-full w-64 shrink-0 flex-col border-r bg-surface-2"
    >
      <div className="border-b px-5 py-5">
        <button
          type="button"
          onClick={onHome}
          aria-label={t('topBar.home')}
          title={t('topBar.home')}
          className="flex items-center gap-2 text-left"
        >
          <span aria-hidden className="text-xl font-semibold text-link">
            ★
          </span>
          <span>
            <span className="block leading-tight font-semibold text-link">{t('app.brand')}</span>
            <span className="block text-3xs tracking-wider text-fg-3">{t('nav.adminPanel')}</span>
          </span>
        </button>
      </div>

      <div className="border-b px-4 py-4">
        <span className="mb-2 block text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
          {t('nav.activeServer')}
        </span>
        <OptionSelect
          label={t('topBar.server')}
          value={selected?.id}
          placeholder={t('topBar.noServer')}
          options={servers.map((s) => ({ value: s.id, label: s.name }))}
          onChange={select}
          className="w-full"
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-5 py-2 text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
              {t(`nav.sections.${section.title}`)}
            </div>
            {section.items.map(({ id, icon: Icon, soon }) => (
              <button
                key={id}
                type="button"
                disabled={soon}
                aria-current={active === id ? 'page' : undefined}
                onClick={() => onNavigate(id)}
                className={cn(
                  'flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-left text-sm transition-all duration-150',
                  active === id
                    ? 'border-link bg-link-bg text-link'
                    : 'border-transparent text-fg-3 hover:bg-white/5 hover:text-foreground',
                  soon && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-fg-3',
                )}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span className="flex-1">{t(`nav.items.${id}`)}</span>
                {soon && (
                  <span className="text-3xs tracking-wider text-fg-3 uppercase">
                    {t('nav.soon')}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-fg-3">
        <span>v{version}</span>
        <a
          href="https://github.com/DyingStar-game"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="transition-all duration-150 hover:text-link"
        >
          <GithubMark size={16} />
        </a>
      </div>
    </aside>
  );
}
