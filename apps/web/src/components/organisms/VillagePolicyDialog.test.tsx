import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUniversesimulatorDataset, simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { VillagePolicyDialog } from './VillagePolicyDialog';

const village = { id: ids.m0002, name: 'M0002' };
const water = { id: ids.water, name: 'Water', unit: 'l' };
const policy = createUniversesimulatorDataset().policies.find(
  (p) => p.villageId === ids.m0002 && p.resourceId === ids.water,
);

describe('VillagePolicyDialog', () => {
  it('refuses a target below the threshold, then saves the change after confirmation', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <VillagePolicyDialog
        village={village}
        resource={water}
        policy={policy ?? null}
        onClose={onClose}
      />,
    );
    const threshold = screen.getByLabelText('Minimum threshold (l)');
    const next = screen.getByRole('button', { name: 'Continue' });

    await userEvent.clear(threshold);
    await userEvent.type(threshold, '1500');
    expect(
      await screen.findByText('The target level cannot be below the minimum threshold.'),
    ).toBeInTheDocument();
    expect(next).toBeDisabled();

    await userEvent.clear(threshold);
    await userEvent.type(threshold, '400');
    await userEvent.click(next);
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum threshold (l): 300 l → 400 l');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.universesimulator.writes).toEqual([
      {
        call: 'PUT /village-policies',
        body: {
          villageId: ids.m0002,
          resourceId: ids.water,
          minThreshold: 400,
          targetLevel: 1_000,
        },
      },
    ]);
  });

  it('adds a threshold for a resource without one', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <VillagePolicyDialog
        village={{ id: ids.f0001, name: 'F0001' }}
        resource={{ id: ids.oreFer, name: 'Iron ore', unit: 'kg' }}
        policy={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Threshold of Iron ore in F0001' })).toBeVisible();
    await userEvent.clear(screen.getByLabelText('Target level (kg)'));
    await userEvent.type(screen.getByLabelText('Target level (kg)'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes[0]?.body).toEqual({
        villageId: ids.f0001,
        resourceId: ids.oreFer,
        minThreshold: 0,
        targetLevel: 50,
      }),
    );
  });
});
