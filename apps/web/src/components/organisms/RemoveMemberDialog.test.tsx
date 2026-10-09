import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { RemoveMemberDialog } from './RemoveMemberDialog';

describe('RemoveMemberDialog', () => {
  it('asks before removing a member, then removes them', async () => {
    const bff = useInProcessBff();
    bff.social.data.corporationMembers.push({
      corporationId: organisationIds.mining,
      playerId: socialIds.reporter,
      rankId: 3,
      joinedAt: '2026-10-08T10:10:00.000Z',
    });
    const onClose = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        corporation={{ id: organisationIds.mining, name: 'Deep Core Mining' }}
        member={{ playerId: socialIds.reporter, displayName: 'ddurieux' }}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('alertdialog', {
      name: 'Remove ddurieux from Deep Core Mining?',
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes.map((w) => w.call)).toEqual([
      `DELETE /internal/corporations/${organisationIds.mining}/members/${socialIds.reporter}`,
    ]);
  });
});
