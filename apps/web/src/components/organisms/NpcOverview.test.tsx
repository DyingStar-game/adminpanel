import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useNpc } from '@/hooks/useNpcs';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcOverview } from './NpcOverview';

function Overview({ id, onDeleted = vi.fn() }: { id: string; onDeleted?: () => void }) {
  const npc = useNpc(id);
  return npc.data ? <NpcOverview detail={npc.data} onDeleted={onDeleted} /> : null;
}

describe('NpcOverview', () => {
  it('shows the live state, the current manual action, the role and the workplace', async () => {
    useInProcessBff();
    renderWithProviders(<Overview id={ids.camille} />);

    const facts = await screen.findByText('Current action');
    const action = facts.nextElementSibling;
    expect(action).toHaveTextContent('take_a_walk');
    expect(action).toHaveTextContent('Manual task');
    expect(action).toHaveTextContent('task 3');
    expect(screen.getByText('FSM status').nextElementSibling).toHaveTextContent('walking');
    expect(screen.getByText('Workplace').nextElementSibling).toHaveTextContent('M0012-D1');
    expect(screen.getByText('Keycloak account').nextElementSibling).toHaveTextContent('Ready');
  });

  it("names a Keycloak account's error", async () => {
    useInProcessBff();
    renderWithProviders(<Overview id={ids.elise} />);

    expect(await screen.findByText(/User exists with same username/)).toBeInTheDocument();
  });

  it('despawns, reassigns after confirmation, then deletes after typing the word', async () => {
    const bff = useInProcessBff();
    const onDeleted = vi.fn();
    renderWithProviders(<Overview id={ids.alain} onDeleted={onDeleted} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Despawn' }));
    expect(await screen.findByRole('button', { name: 'Spawn' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reassign' }));
    const reassign = screen.getByRole('alertdialog', { name: 'Reassign Alain Deloin?' });
    await userEvent.click(within(reassign).getByRole('button', { name: 'Reassign' }));
    await vi.waitFor(() =>
      expect(bff.npc.data.npcs.find((n) => n.id === ids.alain)?.role).toBe('unassigned'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Alain Deloin for good?' });
    await userEvent.type(within(dialog).getByLabelText('Type "delete" to confirm'), 'delete');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(bff.npc.writes.map((w) => w.call)).toEqual([
      `POST /npcs/${ids.alain}/despawn`,
      `POST /npcs/${ids.alain}/reassign`,
      `DELETE /npcs/${ids.alain}`,
    ]);
  });

  it('offers no action to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <Overview id={ids.alain} />
      </PermissionsContext.Provider>,
    );

    await screen.findByText('Current action');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
