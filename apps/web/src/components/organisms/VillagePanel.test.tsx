import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { VillagePanel } from './VillagePanel';

describe('VillagePanel', () => {
  it("shows a village's summed stocks, warehouses, goods on the way and local prices", async () => {
    useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <PermissionsContext.Provider value={['simulation.view']}>
        <VillagePanel villageId={ids.m0002} onClose={onClose} />
      </PermissionsContext.Provider>,
    );

    const panel = await screen.findByRole('complementary', { name: 'M0002' });
    expect(panel).toHaveTextContent('mining · 80 inhabitants · commune M0002');
    const stocks = within(panel).getByRole('table', { name: 'Village stocks' });
    expect(within(stocks).getByRole('row', { name: /Iron ore/ })).toHaveTextContent(
      'Below threshold',
    );
    expect(within(stocks).getByRole('row', { name: /Titanium ore/ })).toHaveTextContent('Empty');
    expect(within(panel).getByRole('region', { name: 'M0002 — Cargo depot' })).toHaveTextContent(
      'Main',
    );
    const incoming = within(panel).getByRole('table', { name: 'On the way' });
    expect(await within(incoming).findByRole('row', { name: /^F0001/ })).toHaveTextContent(
      '600 Water',
    );
    expect(within(incoming).getByRole('row', { name: /^Mine/ })).toHaveTextContent('On offer');
    expect(within(panel).getByRole('table', { name: 'Local prices' })).toHaveTextContent(
      'Iron ore',
    );
    // Read-only: the flows, no threshold to edit.
    expect(within(panel).getByRole('table', { name: 'Flows' })).toHaveTextContent('Miners');
    expect(within(panel).queryByRole('table', { name: 'Thresholds' })).not.toBeInTheDocument();

    await userEvent.click(within(panel).getByRole('button', { name: 'Close the panel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('edits the configuration for an admin', async () => {
    useInProcessBff();
    renderWithProviders(<VillagePanel villageId={ids.c0001} onClose={vi.fn()} />);

    const panel = await screen.findByRole('complementary', { name: 'C0001' });
    expect(await within(panel).findByRole('table', { name: 'Thresholds' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Add a flow' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Make it the main warehouse' })).toBeVisible();
  });
});
