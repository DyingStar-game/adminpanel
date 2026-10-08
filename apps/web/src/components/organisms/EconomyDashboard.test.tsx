import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { EconomyDashboard } from './EconomyDashboard';

describe('EconomyDashboard', () => {
  it('shows the money supply and the richest, named through social', async () => {
    useInProcessBff();
    const onOpenPlayer = vi.fn();
    const onOpenCorporation = vi.fn();
    renderWithProviders(
      <EconomyDashboard
        days={30}
        onOpenPlayer={onOpenPlayer}
        onOpenCorporation={onOpenCorporation}
      />,
    );

    expect(await screen.findByText('10,590 credits')).toBeInTheDocument();
    expect(screen.getByText('4 accounts')).toBeInTheDocument();
    const players = screen.getByRole('table', { name: 'Richest players' });
    await userEvent.click(await within(players).findByRole('button', { name: 'ddurieux' }));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
    const corporations = screen.getByRole('table', { name: 'Richest corporations' });
    await userEvent.click(
      await within(corporations).findByRole('button', { name: 'Deep Core Mining' }),
    );
    expect(onOpenCorporation).toHaveBeenCalledWith(organisationIds.mining);
  });
});
