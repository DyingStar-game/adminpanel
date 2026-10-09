import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { TeleportDialog } from './TeleportDialog';

const options = {
  player: [
    { uuid: 'p1', label: 'ynotna', objectType: 'player' },
    { uuid: 'p2', label: 'arnobeck', objectType: 'player' },
  ],
  vehicle: [{ uuid: 'v1', label: 'vehicle 92fc8c9d', objectType: 'vehicle' }],
};

describe('TeleportDialog', () => {
  it('picks a player, or a vehicle from its tab', async () => {
    const onPick = vi.fn();
    renderWithProviders(
      <TeleportDialog
        place="10.85° N · 50.70° W"
        options={options}
        onPick={onPick}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Teleport here: 10.85° N · 50.70° W' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Search a player'), 'arno');
    expect(screen.queryByText('ynotna')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('arnobeck'));
    expect(onPick).toHaveBeenCalledWith('p2');

    await userEvent.click(screen.getByRole('tab', { name: 'Vehicles (1)' }));
    await userEvent.click(screen.getByText('vehicle 92fc8c9d'));
    expect(onPick).toHaveBeenCalledWith('v1');
  });
});
