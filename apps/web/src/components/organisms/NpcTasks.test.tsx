import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcTasks } from './NpcTasks';

const camille = { id: ids.camille, displayName: 'Camille Roux' };

describe('NpcTasks', () => {
  it('lists the tasks, open ones first, with why one failed', async () => {
    useInProcessBff();
    renderWithProviders(<NpcTasks npc={camille} />);

    const table = await screen.findByRole('table', { name: 'Tasks' });
    await within(table).findByRole('row', { name: /timeout/ });
    const rows = within(table).getAllByRole('row') as HTMLTableRowElement[];
    expect(rows.slice(1).map((r) => r.cells[0]?.textContent)).toEqual(['4', '3', '2', '1']);
    expect(rows[2]).toHaveTextContent('Running');
    expect(rows[3]).toHaveTextContent('timeout: not arrived after 300 s');
    expect(within(rows[3] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('cancels an open task after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcTasks npc={camille} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel task 3' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel task 3?' });
    expect(dialog).toHaveTextContent('running');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel the task' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([{ call: `DELETE /npcs/${ids.camille}/tasks/3` }]),
    );
    expect(await screen.findByText('cancelled by an admin')).toBeInTheDocument();
  });

  it('opens the new task dialog, for npc.manage only', async () => {
    useInProcessBff();
    const { unmount } = renderWithProviders(<NpcTasks npc={camille} />);

    await userEvent.click(screen.getByRole('button', { name: 'New task' }));
    expect(screen.getByRole('dialog', { name: 'New task for Camille Roux' })).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcTasks npc={camille} />
      </PermissionsContext.Provider>,
    );
    await screen.findByRole('table', { name: 'Tasks' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
