import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { Sidebar } from './Sidebar';

const servers = [
  { id: 'universe-testing', name: 'Universe Testing', environment: 'testing' },
  { id: 'universe', name: 'Universe', environment: 'production' },
];

const renderSidebar = () => {
  server.use(http.get('*/api/servers', () => HttpResponse.json({ servers })));
  const onNavigate = vi.fn();
  const onHome = vi.fn();
  renderWithProviders(
    <Sidebar active="explorer" onNavigate={onNavigate} onHome={onHome} version="0.1.0" />,
  );
  return { onNavigate, onHome };
};

describe('Sidebar', () => {
  it('selects the first configured server by default', async () => {
    renderSidebar();

    expect(await screen.findByText('Universe Testing')).toBeInTheDocument();
    expect(usePreferences.getState().serverId).toBe('universe-testing');
  });

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
    expect(within(nav).getByRole('button', { name: /Bans/ })).toBeDisabled();
  });
});
