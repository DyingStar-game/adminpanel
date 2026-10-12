import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationTreasury } from './SimulationTreasury';

describe('SimulationTreasury', () => {
  it('shows the balance against its floor and the money issued, newest first', async () => {
    useInProcessBff();
    renderWithProviders(<SimulationTreasury />);

    expect(await screen.findByText('1,204,560 credits')).toBeInTheDocument();
    expect(screen.getByText('floor 200,000 credits')).toBeInTheDocument();
    const events = screen.getByRole('table', { name: 'Money issued into the treasury' });
    const rows = await within(events).findAllByRole('row', { name: /credits/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('treasury below floor'),
      expect.stringContaining('initial treasury'),
    ]);
  });
});
