import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { TopBar } from './TopBar';

const servers = [
  { id: 'universe-testing', name: 'Universe Testing', environment: 'testing' },
  { id: 'universe', name: 'Universe', environment: 'production' },
];

const renderTopBar = () => {
  server.use(http.get('*/api/servers', () => HttpResponse.json({ servers })));
  const onSearch = vi.fn();
  const onHome = vi.fn();
  renderWithProviders(<TopBar onHome={onHome} onSearch={onSearch} onCreate={vi.fn()} />);
  return { onSearch, onHome };
};

describe('TopBar', () => {
  it('selects the first configured server by default', async () => {
    renderTopBar();

    expect(await screen.findByText('Universe Testing')).toBeInTheDocument();
    expect(usePreferences.getState().serverId).toBe('universe-testing');
  });

  it('goes back to the explorer from the brand', async () => {
    const { onHome } = renderTopBar();

    await userEvent.click(screen.getByRole('button', { name: 'Back to the explorer' }));

    expect(onHome).toHaveBeenCalledOnce();
  });

  it('forwards searches', async () => {
    const { onSearch } = renderTopBar();

    await userEvent.type(screen.getByRole('textbox'), 'abc{Enter}');

    expect(onSearch).toHaveBeenCalledWith('abc');
  });

  it('toggles live refresh and the theme', async () => {
    renderTopBar();
    usePreferences.setState({ live: true, theme: 'light' });

    await userEvent.click(screen.getByRole('button', { name: 'Toggle live refresh' }));
    expect(usePreferences.getState().live).toBe(false);
    expect(await screen.findByText('Paused')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(usePreferences.getState().theme).toBe('dark');
  });
});
