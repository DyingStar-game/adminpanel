import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUniversesimulatorDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MineralSourceDialog } from './MineralSourceDialog';

const [source] = createUniversesimulatorDataset().mineralSources;

describe('MineralSourceDialog', () => {
  it("changes the size of a village's mining orders, keeping what is left to mine", async () => {
    if (!source) throw new Error('no mineral source in the dataset');
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <MineralSourceDialog
        source={source}
        village="M0002"
        resource={{ name: 'Iron ore', unit: 'kg' }}
        onClose={onClose}
      />,
    );

    const size = screen.getByLabelText('Most asked by one mining order');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.clear(size);
    await userEvent.type(size, '0');
    expect(await screen.findByText('A whole number, 1 or more.')).toBeInTheDocument();
    await userEvent.clear(size);
    await userEvent.type(size, '10000');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('10,000 kg');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.universesimulator.writes).toEqual([
      {
        call: 'PUT /mineral-sources',
        body: {
          villageId: source.villageId,
          resourceId: source.resourceId,
          maxUnitsPerMission: 10_000,
          ...(source.remainingUnits == null ? {} : { remainingUnits: source.remainingUnits }),
        },
      },
    ]);
  });
});
