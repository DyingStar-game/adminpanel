import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Boxes,
  Upload,
  Map,
  Users,
  ShieldOff,
  Settings,
  Github,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useServerStore } from '@/stores/serverStore';
import { Select } from '@/components/ui';
import { useI18n } from '@/hooks/useI18n';
import { serverSelectLabel } from '@/lib/serverDisplay';

/** Fixed left navigation with server selector and grouped route links. */
export function Sidebar() {
  const { servers, activeServerId, setActiveServer } = useServerStore();
  const { t } = useI18n();

  const navSections = [
    {
      title: t('nav.supervision'),
      items: [
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: '/servers', label: t('nav.serversPlayers'), icon: Server },
      ],
    },
    {
      title: t('nav.gameWorld'),
      items: [
        { to: '/items', label: t('nav.items'), icon: Boxes },
        { to: '/import', label: t('nav.import'), icon: Upload },
        { to: '/missions', label: t('nav.missions'), icon: Map },
      ],
    },
    {
      title: t('nav.administration'),
      items: [
        { to: '/users', label: t('nav.users'), icon: Users },
        { to: '/bans', label: t('nav.bans'), icon: ShieldOff },
      ],
    },
    {
      title: t('nav.configuration'),
      items: [{ to: '/settings', label: t('nav.settings'), icon: Settings }],
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-ds-surface border-r border-ds-border flex flex-col z-30">
      <div className="px-5 py-5 border-b border-ds-border">
        <div className="flex items-center gap-2">
          <span className="text-ds-text text-xl font-semibold">★</span>
          <div>
            <div className="font-semibold text-ds-text leading-tight">DyingStar</div>
            <div className="text-[10px] text-ds-muted tracking-wider">Admin Panel</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-ds-border">
        <label className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ds-muted block mb-2">
          {t('nav.activeServer')}
        </label>
        <Select
          value={activeServerId ?? ''}
          onChange={(e) => setActiveServer(e.target.value)}
        >
          {servers.length === 0 && <option value="">{t('nav.noServer')}</option>}
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {serverSelectLabel(s, t)}
            </option>
          ))}
        </Select>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-5 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-ds-muted">
              {section.title}
            </div>
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-150 border-l-2',
                    isActive
                      ? 'border-ds-text bg-[rgba(255,186,8,0.08)] text-ds-text'
                      : 'border-transparent text-ds-muted hover:bg-ds-surface-hover hover:text-gray-200',
                  )
                }
              >
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-ds-border text-xs text-ds-muted flex items-center justify-between">
        <span>v{import.meta.env.VITE_APP_VERSION ?? '0.1.0'}</span>
        <a
          href="https://github.com/DyingStar-game"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ds-text transition-all duration-150"
        >
          <Github size={16} strokeWidth={1.5} />
        </a>
      </div>
    </aside>
  );
}
