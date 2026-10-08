import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { TopBar } from './TopBar';

const servers = [{ id: 'universe-testing', name: 'Universe Testing', environment: 'testing' }];

const renderTopBar = () => {
  server.use(
    http.get('*/api/servers', () =>
      HttpResponse.json({ environment: 'testing', servers, services: ['persistence'] }),
    ),
  );
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
    // One panel per environment (ADR 0023): its environment is always in sight.
    expect(screen.getByText('Pre-production')).toBeInTheDocument();
    // Its only game server is the target of every call.
    expect(usePreferences.getState().serverId).toBe('universe-testing');
  });

  it('searches the whole universe by a piece of name, the parent as hint', async () => {
    useInProcessBff();
    const { onSearch } = renderTopBar();

    await userEvent.type(screen.getByRole('combobox', { name: 'Search (name, UUID)' }), 'DURIE');

    const option = await screen.findByRole('option', { name: /ddurieux/ });
    expect(await within(option).findByText('tarsis_4-1006')).toBeInTheDocument();
    await userEvent.click(option);
    expect(onSearch).toHaveBeenCalledWith(ids.player);
  });

  it('opens a full UUID submitted before the results come', async () => {
    const { onSearch } = renderTopBar();

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search (name, UUID)' }),
      `${ids.vehicle}{Enter}`,
    );

    expect(onSearch).toHaveBeenCalledWith(ids.vehicle);
  });

  it('toggles live refresh', async () => {
    renderTopBar();
    usePreferences.setState({ live: true });

    await userEvent.click(screen.getByRole('button', { name: 'Toggle live refresh' }));

    expect(usePreferences.getState().live).toBe(false);
    expect(await screen.findByText('Paused')).toBeInTheDocument();
  });
});
