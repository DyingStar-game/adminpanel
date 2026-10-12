import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationStocks } from './SimulationStocks';

const props = {
  entity: undefined,
  village: undefined,
  resource: undefined,
  onEntityChange: vi.fn(),
  onVillageChange: vi.fn(),
  onResourceChange: vi.fn(),
};

describe('SimulationStocks', () => {
  it('lists only villages, with their summed stock of a resource against their policy', async () => {
    useInProcessBff();
    const onVillageChange = vi.fn();
    renderWithProviders(
      <SimulationStocks {...props} resource={ids.water} onVillageChange={onVillageChange} />,
    );

    const table = screen.getByRole('table', { name: 'Villages' });
    const c0001 = await within(table).findByRole('row', { name: /^C0001 city/ });
    // Two warehouses: 17,400 l, 600 held.
    expect(c0001).toHaveTextContent('1,200');
    expect(c0001).toHaveTextContent('16,800 l');
    expect(c0001).toHaveTextContent('+70/h');
    const m0002 = within(table).getByRole('row', { name: /^M0002 mining/ });
    expect(m0002).toHaveTextContent('4 h');
    expect(m0002).toHaveTextContent('Below threshold');
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText(/Pick a village/)).toBeInTheDocument();

    await userEvent.click(m0002);
    expect(onVillageChange).toHaveBeenCalledWith(ids.m0002);
  });

  it("shows a picked village's stocks, its warehouses and its history", async () => {
    useInProcessBff();
    renderWithProviders(<SimulationStocks {...props} village={ids.c0001} resource={ids.water} />);

    const village = await screen.findByRole('region', { name: 'C0001' });
    expect(
      await within(village).findByRole('img', { name: 'Water at C0001, last 24 h' }),
    ).toHaveTextContent('Threshold');
    const main = await within(village).findByRole('region', { name: 'C0001 — Cargo depot' });
    expect(main).toHaveTextContent('Main');
    expect(within(main).getByRole('row', { name: /^Water/ })).toHaveTextContent('30,000');
    expect(within(village).getByRole('region', { name: 'C0001 — Annex' })).not.toHaveTextContent(
      'Main',
    );
    expect(
      within(village).getByRole('button', { name: 'Edit the threshold · Water' }),
    ).toBeVisible();
  });

  it("keeps a commune's villages, and offers no edit to a moderator", async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <SimulationStocks {...props} entity={ids.communeM0002} village={ids.m0002} />
      </PermissionsContext.Provider>,
    );

    const table = screen.getByRole('table', { name: 'Villages' });
    await within(table).findByRole('row', { name: /^M0002/ });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    await screen.findByRole('region', { name: 'M0002 — Cargo depot' });
    expect(screen.queryByRole('button', { name: /Edit the/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /main warehouse/ })).not.toBeInTheDocument();
  });
});
