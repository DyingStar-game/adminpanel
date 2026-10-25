import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcRemoveDialog } from './NpcRemoveDialog';

const selected = [
  { id: ids.denis, displayName: 'Denis Faure' },
  { id: ids.elise, displayName: 'Élise Garnier' },
];

describe('NpcRemoveDialog', () => {
  it('despawns a count of NPCs in a village', async () => {
    const bff = useInProcessBff();
    const onDone = vi.fn();
    renderWithProviders(<NpcRemoveDialog selected={[]} onClose={vi.fn()} onDone={onDone} />);

    await userEvent.type(screen.getByLabelText('How many'), '1');
    await userEvent.type(screen.getByLabelText('Village (optional)'), 'M0012');
    await userEvent.click(screen.getByRole('button', { name: 'Despawn 1 NPC' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    // The most recent enabled non-storekeeper.
    expect(bff.npc.writes).toEqual([
      { call: 'POST /npcs/bulk', body: { action: 'despawn', count: 1, village: 'M0012' } },
    ]);
    expect(bff.npc.data.npcs.find((n) => n.id === ids.camille)?.enabled).toBe(false);
  });

  it('deletes the selected NPCs once the word is typed', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(<NpcRemoveDialog selected={selected} onClose={onClose} onDone={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Action' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Delete (for good)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2 selected NPCs…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete these NPCs for good?' });
    expect(dialog).toHaveTextContent('Denis Faure, Élise Garnier');
    const confirm = within(dialog).getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Type "delete" to confirm'), 'delete');
    await userEvent.click(confirm);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.npc.writes).toEqual([
      { call: 'POST /npcs/bulk', body: { action: 'delete', ids: [ids.denis, ids.elise] } },
    ]);
    expect(bff.npc.data.npcs).toHaveLength(3);
  });
});
