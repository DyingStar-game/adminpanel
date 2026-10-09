import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MemberRankDialog } from './MemberRankDialog';

describe('MemberRankDialog', () => {
  it("gives a member another rank, as the corporation's CEO", async () => {
    const bff = useInProcessBff();
    bff.social.data.corporationMembers.push({
      corporationId: organisationIds.mining,
      playerId: socialIds.reporter,
      rankId: 3,
      joinedAt: '2026-10-08T10:10:00.000Z',
    });
    const onClose = vi.fn();
    renderWithProviders(
      <MemberRankDialog
        corporationId={organisationIds.mining}
        member={{ playerId: socialIds.reporter, displayName: 'ddurieux', role: 'Member' }}
        ranks={[
          { id: 2, name: 'Director', priority: 50, permissions: [], head: false, isDefault: false },
          { id: 3, name: 'Member', priority: 0, permissions: [], head: false, isDefault: true },
        ]}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Rank of ddurieux' });

    await userEvent.click(within(dialog).getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Director' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('ddurieux: Member → Director.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes[0]).toEqual({
      call: `PATCH /internal/corporations/${organisationIds.mining}/members/${socialIds.reporter}`,
      body: { rankId: 2 },
    });
  });
});
