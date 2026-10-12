import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { VillagePolicyActions } from './VillagePolicyActions';

const village = { id: ids.m0002, name: 'M0002' };

describe('VillagePolicyActions', () => {
  it('edits or deletes an existing threshold, deleting after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <VillagePolicyActions
        village={village}
        resource={{ id: ids.water, name: 'Water', unit: 'l' }}
      />,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit the threshold · Water' }),
    );
    expect(screen.getByLabelText('Minimum threshold (l)')).toHaveValue(300);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Delete the threshold · Water' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete the threshold of Water in M0002?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete the threshold' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
        `DELETE /village-policies/${ids.m0002}/${ids.water}`,
      ]),
    );
    expect(await screen.findByRole('button', { name: 'Add a threshold · Water' })).toBeVisible();
  });

  it('offers to add a threshold where there is none', async () => {
    useInProcessBff();
    renderWithProviders(
      <VillagePolicyActions
        village={{ id: ids.f0001, name: 'F0001' }}
        resource={{ id: ids.oreFer, name: 'Iron ore', unit: 'kg' }}
      />,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add a threshold · Iron ore' }),
    );
    expect(screen.getByRole('dialog', { name: 'Threshold of Iron ore in F0001' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Delete the threshold/ })).not.toBeInTheDocument();
  });
});
