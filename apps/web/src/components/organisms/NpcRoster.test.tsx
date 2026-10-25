import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcRoster } from './NpcRoster';

const props = {
  page: 1,
  onPageChange: vi.fn(),
  selected: [],
  onSelectedChange: vi.fn(),
  onOpenNpc: vi.fn(),
};

describe('NpcRoster', () => {
  it('lists the NPCs with their role, live state and current action', async () => {
    useInProcessBff();
    const onOpenNpc = vi.fn();
    renderWithProviders(
      <NpcRoster {...props} filters={{}} onFiltersChange={vi.fn()} onOpenNpc={onOpenNpc} />,
    );

    const table = await screen.findByRole('table', { name: 'NPC roster' });
    const alain = await within(table).findByRole('row', { name: /Alain Deloin/ });
    expect(alain).toHaveTextContent('Storekeeper');
    expect(alain).toHaveTextContent('slot 1');
    expect(alain).toHaveTextContent('Connected');
    expect(alain).toHaveTextContent('depot_store_item');
    const camille = within(table).getByRole('row', { name: /Camille Roux/ });
    expect(camille).toHaveTextContent('take_a_walk');
    expect(camille).toHaveTextContent('Manual');
    expect(within(table).getByRole('row', { name: /Berthe Morel/ })).toHaveTextContent(
      'Running (off shift)',
    );
    expect(screen.getByText('1–5 of 5')).toBeInTheDocument();
    await userEvent.click(within(alain).getByRole('button', { name: 'Alain Deloin' }));
    expect(onOpenNpc).toHaveBeenCalledWith(ids.alain);
  });

  it('filters by role and selects rows for a bulk action', async () => {
    useInProcessBff();
    const onFiltersChange = vi.fn();
    const onSelectedChange = vi.fn();
    renderWithProviders(
      <NpcRoster
        {...props}
        filters={{ enabled: 'false' }}
        onFiltersChange={onFiltersChange}
        onSelectedChange={onSelectedChange}
      />,
    );

    const table = await screen.findByRole('table', { name: 'NPC roster' });
    expect(await within(table).findByRole('row', { name: /Denis Faure/ })).toBeInTheDocument();
    expect(within(table).queryByRole('row', { name: /Alain Deloin/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Denis Faure' }));
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      { id: ids.denis, displayName: 'Denis Faure' },
    ]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select the page' }));
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      { id: ids.denis, displayName: 'Denis Faure' },
      { id: ids.elise, displayName: 'Élise Garnier' },
    ]);
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Custom' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ enabled: 'false', role: 'custom' });
  });

  it('spawns one NPC from its row', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcRoster {...props} filters={{}} onFiltersChange={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Spawn Denis Faure' }));
    await vi.waitFor(() =>
      expect(bff.npc.writes.map((w) => w.call)).toEqual([`POST /npcs/${ids.denis}/spawn`]),
    );
  });

  it('offers no row action to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcRoster {...props} filters={{}} onFiltersChange={vi.fn()} />
      </PermissionsContext.Provider>,
    );

    await screen.findByRole('row', { name: /Denis Faure/ });
    expect(screen.queryByRole('button', { name: 'Spawn Denis Faure' })).not.toBeInTheDocument();
  });
});
