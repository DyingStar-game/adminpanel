import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationOverview } from './SimulationOverview';

describe('SimulationOverview', () => {
  it('shows the tick, treasury and missions, and the villages below their threshold', async () => {
    useInProcessBff();
    const onOpenVillage = vi.fn();
    renderWithProviders(<SimulationOverview onOpenVillage={onOpenVillage} />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Orders in progress').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Escrowed').nextSibling).toHaveTextContent('3,340');
    const alerts = screen.getByRole('table', { name: 'Villages below their threshold' });
    const village = await within(alerts).findByRole('row', { name: /^M0002 Water/ });
    expect(village).toHaveTextContent('Water');
    expect(village).toHaveTextContent('-30/h');
    expect(village).toHaveTextContent('4 h');

    await userEvent.click(village);
    expect(onOpenVillage).toHaveBeenCalledWith(simulationIds.m0002);
  });

  it('pauses after confirmation for an admin', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<SimulationOverview onOpenVillage={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Pause the simulation?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pause' }));

    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(bff.universesimulator.writes.map((w) => w.call)).toEqual(['POST /simulation/pause']);
  });

  it('offers no control to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <SimulationOverview onOpenVillage={vi.fn()} />
      </PermissionsContext.Provider>,
    );

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Force a tick' })).not.toBeInTheDocument();
  });
});
