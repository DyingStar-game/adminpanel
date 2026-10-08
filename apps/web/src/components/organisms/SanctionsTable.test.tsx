import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SanctionsTable } from './SanctionsTable';

const sanctions = createSocialDataset().sanctions;

describe('SanctionsTable', () => {
  it('names the sanctioned players, from their profiles', async () => {
    useInProcessBff();
    renderWithProviders(<SanctionsTable sanctions={sanctions} onOpenPlayer={vi.fn()} />);
    const table = screen.getByRole('table', { name: 'Sanctions' });

    expect(await within(table).findAllByRole('button', { name: 'griefer42' })).toHaveLength(2);
  });

  it('shows a warning as one-off, and offers to lift only what is in force', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-08T12:00:00.000Z'), shouldAdvanceTime: true });
    useInProcessBff();
    const onLift = vi.fn();
    renderWithProviders(
      <SanctionsTable
        sanctions={sanctions}
        showPlayer={false}
        onOpenPlayer={vi.fn()}
        onLift={onLift}
      />,
    );
    const table = screen.getByRole('table', { name: 'Sanctions' });

    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    // A warning has nothing to do: a dash in the actions column.
    expect(within(table).getByText('Warning').closest('tr')).toHaveTextContent('One-off');
    expect(within(table).getByText('Warning').closest('tr')?.lastElementChild).toHaveTextContent(
      '—',
    );
    const lift = within(table).getAllByRole('button', { name: 'Lift' });
    expect(lift).toHaveLength(1);
    const [button] = lift;
    if (!button) throw new Error('no Lift button');
    await userEvent.click(button);
    expect(onLift).toHaveBeenCalledWith(expect.objectContaining({ type: 'mute' }));
    vi.useRealTimers();
  });
});
