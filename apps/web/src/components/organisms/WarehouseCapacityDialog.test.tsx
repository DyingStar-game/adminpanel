import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { WarehouseCapacityDialog } from './WarehouseCapacityDialog';

const warehouse = { id: ids.c0001Annex, name: 'C0001 — Annex' };
const water = { id: ids.water, name: 'Water', unit: 'l' };

describe('WarehouseCapacityDialog', () => {
  it('changes a capacity after confirmation, refusing a negative one', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <WarehouseCapacityDialog
        warehouse={warehouse}
        resource={water}
        capacity={20_000}
        onClose={onClose}
      />,
    );
    const field = screen.getByLabelText('Capacity (l)');
    expect(field).toHaveAccessibleDescription('Leave empty for no limit.');

    await userEvent.clear(field);
    await userEvent.type(field, '-5');
    expect(await screen.findByText('A whole number, 0 or more.')).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, '25000');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Capacity (l): 20,000 l → 25,000 l');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.universesimulator.writes).toEqual([
      {
        call: 'PUT /warehouse-capacities',
        body: { warehouseId: ids.c0001Annex, resourceId: ids.water, capacity: 25_000 },
      },
    ]);
  });

  it('removes the limit when emptied', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <WarehouseCapacityDialog
        warehouse={warehouse}
        resource={water}
        capacity={20_000}
        onClose={vi.fn()}
      />,
    );

    await userEvent.clear(screen.getByLabelText('Capacity (l)'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('20,000 l → unlimited');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes[0]?.body).toMatchObject({ capacity: null }),
    );
  });
});
