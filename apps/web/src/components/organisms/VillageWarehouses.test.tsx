import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { VillageWarehouses } from './VillageWarehouses';

const village = { id: ids.c0001, name: 'C0001' };

describe('VillageWarehouses', () => {
  it('shows each warehouse with its own stocks and capacities, the main one marked', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <VillageWarehouses village={village} />
      </PermissionsContext.Provider>,
    );

    const main = await screen.findByRole('region', { name: 'C0001 — Cargo depot' });
    expect(main).toHaveTextContent('Main');
    const annex = screen.getByRole('region', { name: 'C0001 — Annex' });
    expect(within(annex).getByRole('row', { name: /^Water/ })).toHaveTextContent('5,400 l');
    expect(within(annex).getByRole('row', { name: /^Food ration/ })).toHaveTextContent('unlimited');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('makes another warehouse the main one after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<VillageWarehouses village={village} />);

    const annex = await screen.findByRole('region', { name: 'C0001 — Annex' });
    await userEvent.click(
      within(annex).getByRole('button', { name: 'Make it the main warehouse' }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: 'Make C0001 — Annex the main warehouse of C0001?',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Make it the main warehouse' }),
    );

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes).toEqual([
        { call: `PUT /villages/${ids.c0001}`, body: { mainWarehouseId: ids.c0001Annex } },
      ]),
    );
    await vi.waitFor(() => expect(annex).toHaveTextContent('Main'));
  });

  it('opens the capacity of a warehouse for a resource', async () => {
    useInProcessBff();
    renderWithProviders(<VillageWarehouses village={village} />);

    const annex = await screen.findByRole('region', { name: 'C0001 — Annex' });
    await userEvent.click(within(annex).getByRole('button', { name: 'Edit the capacity · Water' }));
    expect(
      screen.getByRole('dialog', { name: 'Capacity of C0001 — Annex for Water' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Capacity (l)')).toHaveValue(20_000);
  });
});
