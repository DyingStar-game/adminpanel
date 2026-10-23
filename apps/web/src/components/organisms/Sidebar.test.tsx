import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { usePreferences } from '@/stores/preferences';
import { Sidebar } from './Sidebar';

/** The sidebar reads which services the panel manages (ADR 0024). */
const servesPersistence = () =>
  server.use(
    http.get('*/api/panel', () =>
      HttpResponse.json({
        environment: 'testing',
        gameServerName: 'Test',
        services: ['persistence'],
      }),
    ),
  );

const renderSidebar = () => {
  servesPersistence();
  const onNavigate = vi.fn();
  const onHome = vi.fn();
  renderWithProviders(
    <Sidebar active="explorer" onNavigate={onNavigate} onHome={onHome} version="0.1.0" />,
  );
  return { onNavigate, onHome };
};

describe('Sidebar', () => {
  it('collapses to its icons and expands again, remembered', async () => {
    renderSidebar();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse the menu' }));

    expect(usePreferences.getState().sidebarCollapsed).toBe(true);
    // Items keep their name for screen readers and in their tooltip.
    expect(screen.getByRole('button', { name: 'Persistence — Items' })).toHaveAttribute(
      'title',
      'Persistence — Items',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Expand the menu' }));
    expect(usePreferences.getState().sidebarCollapsed).toBe(false);
  });

  it('goes back to the explorer from the brand', async () => {
    const { onHome } = renderSidebar();

    await userEvent.click(screen.getByRole('button', { name: 'Back to the explorer' }));

    expect(onHome).toHaveBeenCalledOnce();
  });

  it('navigates to the built pages and shows the others as coming soon', async () => {
    const { onNavigate } = renderSidebar();
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    expect(within(nav).getByRole('button', { name: 'Persistence — Items' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(within(nav).getByRole('button', { name: 'Persistence — Import JSON' }));
    expect(onNavigate).toHaveBeenCalledWith('import');
    expect(within(nav).getByRole('button', { name: /Settings/ })).toBeDisabled();
  });

  it('hides the import from an account that may not write', () => {
    servesPersistence();
    renderWithProviders(
      <PermissionsContext.Provider value={['persistence.read']}>
        <Sidebar active="explorer" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    expect(within(nav).getByRole('button', { name: 'Persistence — Items' })).toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Persistence — Import JSON' }),
    ).not.toBeInTheDocument();
  });

  it('shows moderation to a moderator when social is configured, not persistence', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['social.moderate']}>
        <Sidebar active="moderation" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    expect(await within(nav).findByRole('button', { name: 'Moderation' })).toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Persistence — Items' }),
    ).not.toBeInTheDocument();
    // Nothing left in the game world: the group goes too; the ones coming soon stay.
    expect(within(nav).queryByText('Game world')).not.toBeInTheDocument();
    expect(within(nav).getByText('Administration')).toBeInTheDocument();
    expect(within(nav).getByText('Supervision')).toBeInTheDocument();
  });

  it('hides moderation from an account that may not moderate', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['persistence.read']}>
        <Sidebar active="explorer" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });
    await within(nav).findByRole('button', { name: 'Persistence — Items' });

    expect(within(nav).queryByRole('button', { name: 'Moderation' })).not.toBeInTheDocument();
    expect(within(nav).queryByText('Administration')).not.toBeInTheDocument();
  });

  it('shows the simulation in the game world to a moderator when universesimulator is configured', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <Sidebar active="simulation" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    const entry = await within(nav).findByRole('button', { name: 'Simulation' });
    expect(entry).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByText('Game world')).toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Persistence — Items' }),
    ).not.toBeInTheDocument();
  });

  it('shows missions in the game world to whoever holds mission:read', async () => {
    useInProcessBff();
    const onNavigate = vi.fn();
    renderWithProviders(
      <PermissionsContext.Provider value={['mission.read']}>
        <Sidebar active="missions" onNavigate={onNavigate} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    await userEvent.click(await within(nav).findByRole('button', { name: 'Missions' }));
    expect(onNavigate).toHaveBeenCalledWith('missions');
    expect(within(nav).getByText('Game world')).toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Persistence — Items' }),
    ).not.toBeInTheDocument();
  });

  it('hides the simulation without its permission, or when universesimulator is not configured', async () => {
    useInProcessBff();
    const { unmount } = renderWithProviders(
      <PermissionsContext.Provider value={['persistence.read', 'social.moderate']}>
        <Sidebar active="explorer" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    let nav = screen.getByRole('complementary', { name: 'Navigation' });
    await within(nav).findByRole('button', { name: 'Moderation' });
    expect(within(nav).queryByRole('button', { name: 'Simulation' })).not.toBeInTheDocument();
    unmount();

    servesPersistence();
    renderWithProviders(
      <Sidebar active="explorer" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />,
    );
    nav = screen.getByRole('complementary', { name: 'Navigation' });
    await within(nav).findByRole('button', { name: 'Persistence — Items' });
    expect(within(nav).queryByRole('button', { name: 'Simulation' })).not.toBeInTheDocument();
  });

  it('shows the NPCs in the game world to a moderator when the npc service is configured', async () => {
    useInProcessBff();
    const onNavigate = vi.fn();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <Sidebar active="npcs" onNavigate={onNavigate} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    const nav = screen.getByRole('complementary', { name: 'Navigation' });

    const entry = await within(nav).findByRole('button', { name: 'NPCs' });
    expect(entry).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('button', { name: 'Simulation' })).not.toBeInTheDocument();
    await userEvent.click(entry);
    expect(onNavigate).toHaveBeenCalledWith('npcs');
  });

  it('hides the NPCs without npc.view, or when the npc service is not configured', async () => {
    useInProcessBff();
    const { unmount } = renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <Sidebar active="simulation" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />
      </PermissionsContext.Provider>,
    );
    let nav = screen.getByRole('complementary', { name: 'Navigation' });
    await within(nav).findByRole('button', { name: 'Simulation' });
    expect(within(nav).queryByRole('button', { name: 'NPCs' })).not.toBeInTheDocument();
    unmount();

    servesPersistence();
    renderWithProviders(
      <Sidebar active="explorer" onNavigate={vi.fn()} onHome={vi.fn()} version="0.1.0" />,
    );
    nav = screen.getByRole('complementary', { name: 'Navigation' });
    await within(nav).findByRole('button', { name: 'Persistence — Items' });
    expect(within(nav).queryByRole('button', { name: 'NPCs' })).not.toBeInTheDocument();
  });
});
