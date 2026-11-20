import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { RouteDialog } from './RouteDialog';

const villages = [
  { id: ids.m0002, name: 'M0002' },
  { id: ids.c0001, name: 'C0001' },
];

describe('RouteDialog', () => {
  it('writes a route between two villages, in metres, refusing a village to itself', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(<RouteDialog villages={villages} onClose={onClose} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'From' }));
    await userEvent.click(await screen.findByRole('option', { name: 'M0002' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'To' }));
    await userEvent.click(await screen.findByRole('option', { name: 'M0002' }));
    await userEvent.type(screen.getByLabelText('Distance (km)'), '31.5');
    expect(await screen.findByText('A route links two different villages.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.click(screen.getByRole('combobox', { name: 'To' }));
    await userEvent.click(await screen.findByRole('option', { name: 'C0001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('M0002 to C0001, 31.5 km');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.universesimulator.writes).toEqual([
      {
        call: 'PUT /travel-routes',
        // Both ways and active: the defaults of the panel's contract (`zPanelRoute`).
        body: {
          fromVillageId: ids.m0002,
          toVillageId: ids.c0001,
          distanceM: 31_500,
          bidirectional: true,
          active: true,
        },
      },
    ]);
  });
});
