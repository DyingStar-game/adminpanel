import {
  BookOpenIcon,
  BoxesIcon,
  Building2Icon,
  LayoutDashboardIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ServerIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UploadIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GithubMark } from '@/components/atoms/GithubMark';
import { useCan } from '@/hooks/useCan';
import { useServers } from '@/hooks/useServers';
import { WIKI_HOME } from '@/lib/bodies';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/stores/preferences';

export type NavId =
  | 'dashboard'
  | 'servers'
  | 'explorer'
  | 'import'
  | 'players'
  | 'moderation'
  | 'organisations'
  | 'settings';

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
      { id: 'players', icon: UsersIcon },
      { id: 'moderation', icon: ShieldAlertIcon },
      { id: 'organisations', icon: Building2Icon },
    ],
  },
  { title: 'configuration', items: [{ id: 'settings', icon: SettingsIcon, soon: true }] },
];

/**
 * Fixed left navigation of the first DyingStar panel: brand, sections. It can be reduced to its
 * icons (remembered per viewer). There is nothing to choose about the server: one panel per
 * environment, one game server per environment (ADR 0023), shown in the top bar.
 */
export function Sidebar({ active, onNavigate, onHome, version }: SidebarProps) {
  const { t } = useTranslation();
  const can = useCan();
  const { services } = useServers();
  /** Built sections the account may open (ADR 0023, 0024); the others are greyed out. */
  const visible = (id: NavId) => {
    if (id === 'explorer') return can('persistence.read');
    // The import only writes.
    if (id === 'import') return can('persistence.write');
    if (id === 'players' || id === 'moderation' || id === 'organisations') {
      return services.includes('social') && can('social.moderate');
    }
    return true;
  };
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const setCollapsed = usePreferences((s) => s.setSidebarCollapsed);

  return (
    <aside
      aria-label={t('nav.label')}
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-surface-2 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand, and the button reducing the menu to its icons: at the top, where it is seen. */}
      <div
        className={cn(
          'flex items-center border-b py-5',
          collapsed ? 'flex-col gap-3 px-0' : 'justify-between gap-2 px-5',
        )}
      >
        <button
          type="button"
          onClick={onHome}
          aria-label={t('topBar.home')}
          title={t('topBar.home')}
          className={cn('flex items-center gap-2 text-left', collapsed && 'w-full justify-center')}
        >
          <span aria-hidden className="text-xl font-semibold text-link">
            ★
          </span>
          {!collapsed && (
            <span>
              <span className="block leading-tight font-semibold text-link">{t('app.brand')}</span>
              <span className="block text-3xs tracking-wider text-fg-3">{t('nav.adminPanel')}</span>
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
          title={t(collapsed ? 'nav.expand' : 'nav.collapse')}
          className="rounded-md p-1.5 text-fg-3 transition-all duration-150 hover:bg-white/5 hover:text-link"
        >
          {collapsed ? <PanelLeftOpenIcon size={18} /> : <PanelLeftCloseIcon size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map((section) => (
          <div key={section.title} className={collapsed ? 'mb-2 border-b pb-2' : 'mb-4'}>
            {!collapsed && (
              <div className="px-5 py-2 text-3xs font-semibold tracking-[0.15em] text-fg-3 uppercase">
                {t(`nav.sections.${section.title}`)}
              </div>
            )}
            {section.items
              .filter(({ id }) => visible(id))
              .map(({ id, icon: Icon, soon }) => (
                <button
                  key={id}
                  type="button"
                  disabled={soon}
                  aria-current={active === id ? 'page' : undefined}
                  title={collapsed ? t(`nav.items.${id}`) : undefined}
                  onClick={() => onNavigate(id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-l-2 py-2.5 text-left text-sm transition-all duration-150',
                    collapsed ? 'justify-center px-0' : 'px-5',
                    active === id
                      ? 'border-link bg-link-bg text-link'
                      : 'border-transparent text-fg-3 hover:bg-white/5 hover:text-foreground',
                    soon && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-fg-3',
                  )}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span className={collapsed ? 'sr-only' : 'flex-1'}>{t(`nav.items.${id}`)}</span>
                  {soon && !collapsed && (
                    <span className="text-3xs tracking-wider text-fg-3 uppercase">
                      {t('nav.soon')}
                    </span>
                  )}
                </button>
              ))}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'flex items-center border-t py-4 text-xs text-fg-3',
          collapsed ? 'flex-col gap-3 px-0' : 'justify-between gap-3 px-5',
        )}
      >
        {!collapsed && <span>v{version}</span>}
        <span className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
          <a
            href={WIKI_HOME}
            target="_blank"
            rel="noreferrer"
            aria-label={t('nav.wiki')}
            title={t('nav.wiki')}
            className="transition-all duration-150 hover:text-link"
          >
            <BookOpenIcon size={16} />
          </a>
          <a
            href="https://github.com/DyingStar-game"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="transition-all duration-150 hover:text-link"
          >
            <GithubMark size={16} />
          </a>
        </span>
      </div>
    </aside>
  );
}
