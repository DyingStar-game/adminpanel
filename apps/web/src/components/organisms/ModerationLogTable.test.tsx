import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ModerationLogTable } from './ModerationLogTable';

describe('ModerationLogTable', () => {
  it('shows who did what to whom, as badges, with the reason and the report', async () => {
    useInProcessBff();
    const onOpenReport = vi.fn();
    renderWithProviders(
      <ModerationLogTable
        entries={createSocialDataset().log}
        onOpenPlayer={vi.fn()}
        onOpenReport={onOpenReport}
      />,
    );
    const table = screen.getByRole('table', { name: 'Moderation log' });

    const issued = within(table).getByText('Sanction given').closest('tr');
    expect(issued).toHaveTextContent('Warning');
    expect(issued).toHaveTextContent('« Griefing at the spawn »');
    expect(await within(table).findAllByRole('button', { name: 'dev-moderator' })).toHaveLength(2);
    await userEvent.click(within(table).getByRole('button', { name: 'Report #3' }));
    expect(onOpenReport).toHaveBeenCalledWith(3);
  });

  it('keeps an action it does not know as it is', () => {
    useInProcessBff();
    renderWithProviders(
      <ModerationLogTable
        entries={[
          {
            id: 9,
            actorId: null,
            action: 'player_renamed',
            targetPlayerId: null,
            details: null,
            createdAt: '2026-10-08T10:00:00.000Z',
          },
        ]}
        onOpenPlayer={vi.fn()}
        onOpenReport={vi.fn()}
      />,
    );
    expect(screen.getByText('player_renamed')).toBeInTheDocument();
    expect(screen.getAllByText('System')).toHaveLength(2);
  });
});
