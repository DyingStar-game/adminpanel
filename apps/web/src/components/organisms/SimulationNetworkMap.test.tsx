import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids, simulationIds as sim } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationNetworkMap } from './SimulationNetworkMap';

const renderMap = (props: Partial<Parameters<typeof SimulationNetworkMap>[0]> = {}) => {
  const onVillageChange = vi.fn();
  const onResourceChange = vi.fn();
  renderWithProviders(
    <div style={{ width: 1200, height: 800 }}>
      <SimulationNetworkMap
        resource={sim.water}
        village={undefined}
        body={undefined}
        onResourceChange={onResourceChange}
        onVillageChange={onVillageChange}
        {...props}
      />
    </div>,
  );
  return { onVillageChange, onResourceChange };
};

/** The persistence fixtures hold SandBox, not the simulation's POIs: the body is given. */
describe('SimulationNetworkMap', () => {
  it('places the villages on the planet, coloured by the health of their summed stock', async () => {
    useInProcessBff();
    const { onVillageChange } = renderMap({ body: ids.planet });

    expect(await screen.findByText('Placed on the map of SandBox')).toBeInTheDocument();
    const m0002 = await screen.findByTitle('M0002 · Below threshold');
    expect(screen.getByTitle('C0001 · OK')).toBeInTheDocument();
    // Their warehouses as secondary points, never mining depots.
    expect(screen.getByTitle('C0001 — Cargo depot (main warehouse)')).toBeInTheDocument();
    expect(screen.getByTitle('C0001 — Annex (warehouse)')).toBeInTheDocument();
    // A village's stock has no capacity: no "Full" in the legend.
    expect(
      within(screen.getByRole('list', { name: 'Stock health' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Empty', 'Below threshold', 'OK', 'Not kept']);

    await userEvent.click(m0002);
    expect(onVillageChange).toHaveBeenCalledWith(sim.m0002);
  });

  it('opens the panel of the selected village', async () => {
    useInProcessBff();
    const { onVillageChange } = renderMap({ body: ids.planet, village: sim.f0001 });

    const panel = await screen.findByRole('complementary', { name: 'F0001' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Close the panel' }));
    expect(onVillageChange).toHaveBeenCalledWith(undefined);
  });

  it('says why nothing is placed when the planet cannot be known', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <SimulationNetworkMap
          resource={undefined}
          village={undefined}
          body={undefined}
          onResourceChange={vi.fn()}
          onVillageChange={vi.fn()}
        />
      </PermissionsContext.Provider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot read');
    expect(screen.queryByTitle(/C0001/)).not.toBeInTheDocument();
  });
});
