import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcsPage } from './NpcsPage';

describe('NpcsPage (ADR 0031)', () => {
  it('opens on the roster under the switch, and changes tab through the URL state', async () => {
    useInProcessBff();
    const onSearchChange = vi.fn();
    renderWithProviders(
      <NpcsPage
        search={{ tab: 'roster', page: 1 }}
        onSearchChange={onSearchChange}
        onOpenNpc={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'NPCs' })).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'NPCs on the servers: on' })).toBeChecked();
    expect(await screen.findByRole('row', { name: /Alain Deloin/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Routines' }));
    expect(onSearchChange).toHaveBeenCalledWith({ tab: 'routines', page: 1 });
  });

  it('shows the tab of the URL', async () => {
    useInProcessBff();
    renderWithProviders(
      <NpcsPage
        search={{ tab: 'activity', page: 1 }}
        onSearchChange={vi.fn()}
        onOpenNpc={vi.fn()}
      />,
    );

    expect(await screen.findByRole('list', { name: 'Events' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'NPC roster' })).not.toBeInTheDocument();
  });

  it('despawns the rows selected in the roster', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <NpcsPage search={{ tab: 'roster', page: 1 }} onSearchChange={vi.fn()} onOpenNpc={vi.fn()} />,
    );

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Alain Deloin' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Camille Roux' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove 2 selected' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove NPCs' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Despawn 2 selected NPCs' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        { call: 'POST /npcs/bulk', body: { action: 'despawn', ids: [ids.alain, ids.camille] } },
      ]),
    );
    // The selection is cleared once done.
    expect(await screen.findByRole('button', { name: 'Remove NPCs' })).toBeInTheDocument();
  });

  it('offers no add or remove to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcsPage
          search={{ tab: 'roster', page: 1 }}
          onSearchChange={vi.fn()}
          onOpenNpc={vi.fn()}
        />
      </PermissionsContext.Provider>,
    );

    await screen.findByRole('row', { name: /Alain Deloin/ });
    expect(screen.queryByRole('button', { name: 'Add NPCs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove NPCs' })).not.toBeInTheDocument();
  });
});
