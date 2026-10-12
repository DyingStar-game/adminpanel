import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { VillageConfig } from './VillageConfig';

const village = { id: ids.c0001, name: 'C0001' };

describe('VillageConfig', () => {
  it('lists the thresholds and flows of a village with their actions', async () => {
    useInProcessBff();
    renderWithProviders(<VillageConfig village={village} />);

    const policies = screen.getByRole('table', { name: 'Thresholds' });
    const water = await within(policies).findByRole('row', { name: /^Water/ });
    expect(water).toHaveTextContent('2,000');
    expect(water).toHaveTextContent('6,000');
    const flows = screen.getByRole('table', { name: 'Flows' });
    expect(
      await within(flows).findByRole('row', { name: /Wells and recyclers/ }),
    ).toHaveTextContent('+250/h');
    expect(within(flows).getAllByRole('button', { name: 'Edit the flow · Water' })).toHaveLength(2);
  });

  it('adds a threshold for a resource without one', async () => {
    useInProcessBff();
    renderWithProviders(<VillageConfig village={village} />);

    await userEvent.click(await screen.findByRole('combobox', { name: 'Add a threshold for…' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Titanium ore']);
    await userEvent.click(screen.getByRole('option', { name: 'Titanium ore' }));
    expect(
      screen.getByRole('dialog', { name: 'Threshold of Titanium ore in C0001' }),
    ).toBeVisible();
  });

  it('deletes a flow after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<VillageConfig village={village} />);
    const flows = screen.getByRole('table', { name: 'Flows' });
    const food = await within(flows).findByRole('row', { name: /Food ration/ });

    await userEvent.click(
      within(food).getByRole('button', { name: 'Delete the flow · Food ration' }),
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this flow of Food ration?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete the flow' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
        'DELETE /flows/a7e50000-0000-4000-8000-000000000203',
      ]),
    );
    await vi.waitFor(() =>
      expect(within(flows).queryByRole('row', { name: /Food ration/ })).not.toBeInTheDocument(),
    );
  });
});
