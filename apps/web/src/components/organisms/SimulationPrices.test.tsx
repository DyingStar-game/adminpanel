import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationPrices } from './SimulationPrices';

describe('SimulationPrices', () => {
  it('shows the index per resource with its trend, and picks a resource', async () => {
    useInProcessBff();
    const onResourceChange = vi.fn();
    renderWithProviders(
      <SimulationPrices resource={undefined} onResourceChange={onResourceChange} />,
    );

    const index = screen.getByRole('table', { name: 'Federation price index' });
    const iron = await within(index).findByRole('row', { name: /Iron ore/ });
    expect(iron).toHaveTextContent('12.6');
    expect(iron).toHaveTextContent('1,580 / 5,000 (0.32)');
    expect(
      await within(iron).findByRole('img', { name: 'Unit price of Iron ore, last 24 h' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pick a resource to see its local prices.')).toBeInTheDocument();

    await userEvent.click(iron);
    expect(onResourceChange).toHaveBeenCalledWith(simulationIds.oreFer);
  });

  it('lists the local prices of a resource per village, largest spread first', async () => {
    useInProcessBff();
    renderWithProviders(
      <SimulationPrices resource={simulationIds.water} onResourceChange={vi.fn()} />,
    );

    const local = await screen.findByRole('table', { name: 'Local prices of Water' });
    const rows = await within(local).findAllByRole('row', { name: /^[CFM]\d{4}/ });
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual([
      'M0002',
      'F0003',
      'F0001',
      'C0001',
    ]);
  });
});
