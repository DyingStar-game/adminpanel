import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationOrders } from './SimulationOrders';

const WATER = '600 Water for M0002';
const FOOD = '1,200 Food ration for C0001';

describe('SimulationOrders', () => {
  it('lists the orders with their hops, newest first', async () => {
    useInProcessBff();
    renderWithProviders(<SimulationOrders filters={{}} onFiltersChange={vi.fn()} />);

    const water = await screen.findByRole('listitem', { name: WATER });
    expect(screen.getByText('4 orders')).toBeInTheDocument();
    const hops = within(water).getAllByRole('listitem');
    expect(hops).toHaveLength(2);
    expect(hops[1]).toHaveTextContent('F0001');
    expect(hops[1]).toHaveTextContent('On offer');
    expect(hops[1]).toHaveTextContent('600 l · 15 km');
    expect(hops[1]).toHaveTextContent('F0001 — Cargo depot → M0002 — Cargo depot');
    // The mission on offer by its title and status from `mission` (ADR 0028).
    const mission = within(hops[1] as HTMLElement);
    expect(mission.getByTitle(simulationIds.waterMission)).toBeInTheDocument();
    expect(await mission.findByText('Transport 600 l Water → M0002')).toBeInTheDocument();
    expect(mission.getByText('Available')).toBeInTheDocument();
    // A leg whose mission is done keeps its id.
    expect(hops[0]).toHaveTextContent('a7e50000');
    const copper = screen.getByRole('listitem', { name: '660 Copper ore for C0001' });
    expect(within(copper).getAllByRole('listitem')[0]).toHaveTextContent('reward not set yet');
  });

  it('filters by status', async () => {
    useInProcessBff();
    const onFiltersChange = vi.fn();
    renderWithProviders(
      <SimulationOrders filters={{ status: 'completed' }} onFiltersChange={onFiltersChange} />,
    );

    expect(await screen.findByRole('listitem', { name: FOOD })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: WATER })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Any status' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ status: undefined });
  });

  it('cancels an open order after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<SimulationOrders filters={{}} onFiltersChange={vi.fn()} />);

    const water = await screen.findByRole('listitem', { name: WATER });
    await userEvent.click(within(water).getByRole('button', { name: 'Cancel the order' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel this order?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
        `POST /orders/${simulationIds.waterOrder}/cancel`,
      ]),
    );
    // Closed orders offer nothing.
    expect(
      within(await screen.findByRole('listitem', { name: FOOD })).queryByRole('button', {
        name: 'Cancel the order',
      }),
    ).not.toBeInTheDocument();
  });

  it('offers no cancel to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <SimulationOrders filters={{}} onFiltersChange={vi.fn()} />
      </PermissionsContext.Provider>,
    );

    await screen.findByRole('listitem', { name: WATER });
    expect(screen.queryByRole('button', { name: 'Cancel the order' })).not.toBeInTheDocument();
  });
});
