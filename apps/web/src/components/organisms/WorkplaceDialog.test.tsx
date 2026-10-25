import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createNpcDataset, npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { WorkplaceDialog } from './WorkplaceDialog';

describe('WorkplaceDialog', () => {
  it("sets a village's workplace by hand", async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(<WorkplaceDialog village="M0013" workplace={null} onClose={onClose} />);

    const id = screen.getByLabelText('Cargo depot (persistence UUID)');
    await userEvent.type(id, 'not-a-uuid');
    expect(await screen.findByText('Not a UUID.')).toBeInTheDocument();
    await userEvent.clear(id);
    await userEvent.type(id, ids.m0013Depot);
    await userEvent.type(screen.getByLabelText('Code'), 'M0013-D1');
    await userEvent.click(screen.getByRole('button', { name: 'Save the workplace' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.npc.writes).toEqual([
      {
        call: 'PUT /villages/M0013/workplace',
        body: { warehouseId: ids.m0013Depot, warehouseCode: 'M0013-D1' },
      },
    ]);
  });

  it('clears a workplace after confirmation', async () => {
    const bff = useInProcessBff();
    const workplace = createNpcDataset().workplaces[0] ?? null;
    renderWithProviders(
      <WorkplaceDialog village="M0012" workplace={workplace} onClose={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear the workplace' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Clear the workplace of M0012?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clear the workplace' }));
    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([{ call: 'DELETE /villages/M0012/workplace' }]),
    );
  });
});
