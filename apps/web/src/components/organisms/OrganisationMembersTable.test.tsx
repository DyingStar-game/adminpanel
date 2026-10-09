import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { OrganisationMembersTable } from './OrganisationMembersTable';

const members = [
  {
    playerId: socialIds.griefer,
    displayName: 'griefer42',
    role: 'Mayor',
    head: true,
    status: 'online' as const,
    joinedAt: '2026-10-08T10:03:00.000Z',
  },
  {
    playerId: socialIds.reporter,
    displayName: 'ddurieux',
    role: 'Citizen',
    head: false,
    status: 'offline' as const,
    joinedAt: '2026-10-08T10:04:00.000Z',
  },
];

describe('OrganisationMembersTable', () => {
  it('shows each member with their office and presence, and opens their sheet', async () => {
    const onOpenPlayer = vi.fn();
    renderWithProviders(
      <OrganisationMembersTable
        members={members}
        roleHeader="Office"
        onOpenPlayer={onOpenPlayer}
      />,
    );
    const table = screen.getByRole('table', { name: 'Members' });

    expect(within(table).getByRole('columnheader', { name: 'Office' })).toBeInTheDocument();
    expect(within(table).getByText('Online')).toBeInTheDocument();
    await userEvent.click(within(table).getByText('ddurieux'));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
  });
});
