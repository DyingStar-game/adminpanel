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
  renderWithProviders(<TopBar crumbs={['Admin', 'Persistence']} onSearch={onSearch} />);
  return { onSearch };
};

describe('TopBar', () => {
  it('shows the breadcrumb and the active game server', async () => {
    renderTopBar();

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'AdminPersistence',
    );
    expect(await screen.findByText('Universe Testing')).toBeInTheDocument();
  });

  it('forwards searches', async () => {
    const { onSearch } = renderTopBar();

    await userEvent.type(screen.getByRole('textbox'), 'abc{Enter}');

    expect(onSearch).toHaveBeenCalledWith('abc');
  });

  it('toggles live refresh', async () => {
    renderTopBar();
    usePreferences.setState({ live: true });

    await userEvent.click(screen.getByRole('button', { name: 'Toggle live refresh' }));

    expect(usePreferences.getState().live).toBe(false);
    expect(await screen.findByText('Paused')).toBeInTheDocument();
  });
});
