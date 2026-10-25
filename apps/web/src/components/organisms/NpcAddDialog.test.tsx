import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcAddDialog } from './NpcAddDialog';

describe('NpcAddDialog', () => {
  it('creates new villagers and spawns existing NPCs', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(<NpcAddDialog onClose={onClose} />);

    const submit = screen.getByRole('button', { name: 'Add' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('New NPCs (1 to 50)'), '2');
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Villager' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Spawn them at once' }));
    await userEvent.type(screen.getByLabelText('Existing NPCs to spawn'), '1');
    await userEvent.click(submit);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.npc.writes).toEqual([
      { call: 'POST /npcs', body: { count: 2, role: 'villager', enabled: false } },
      { call: 'POST /npcs/bulk', body: { action: 'spawn', count: 1 } },
    ]);
    // The oldest disabled NPC was spawned.
    expect(bff.npc.data.npcs.find((n) => n.id === ids.denis)?.enabled).toBe(true);
  });

  it('refuses more than 50 new NPCs at once', async () => {
    useInProcessBff();
    renderWithProviders(<NpcAddDialog onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('New NPCs (1 to 50)'), '51');
    expect(await screen.findByText('Out of range.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
