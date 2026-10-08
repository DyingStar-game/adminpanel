import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { LiftSanctionDialog } from './LiftSanctionDialog';

describe('LiftSanctionDialog', () => {
  it('asks before lifting, then lifts and closes', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    const mute = createSocialDataset().sanctions[1];
    if (!mute) throw new Error('fixture mute missing');
    renderWithProviders(
      <LiftSanctionDialog sanction={mute} playerName="griefer42" onClose={onClose} />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Lift the Mute of griefer42?' });

    expect(within(dialog).getByText('Reputation below -25')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lift' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes.map((w) => w.call)).toEqual([`DELETE /sanctions/${mute.id}`]);
  });
});
