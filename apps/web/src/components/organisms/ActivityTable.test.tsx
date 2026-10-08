import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ActivityTable } from './ActivityTable';

const entries = createSocialDataset().activity;

/** The table row of an event, by its badge. */
function row(event: string) {
  const found = screen.getAllByRole('row').find((tr) => within(tr).queryByText(event));
  if (!found) throw new Error(`No row for ${event}`);
  return found;
}

describe('ActivityTable', () => {
  it("shows social's events in words, with their details", async () => {
    useInProcessBff();
    const onOpenPlayer = vi.fn();
    renderWithProviders(
      <ActivityTable entries={entries} onOpenPlayer={onOpenPlayer} onOpenReport={vi.fn()} />,
    );
    const table = screen.getByRole('table', { name: 'Activity' });

    // The sanction's type sits next to the event, as in the moderation log.
    expect(within(table).getByText('Sanction received').closest('td')).toHaveTextContent(
      'Sanction receivedMute',
    );
    expect(within(table).getByText('rank Pilot')).toBeInTheDocument();
    await userEvent.click(
      await within(row('Friend added')).findByRole('button', { name: 'ddurieux' }),
    );
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
  });

  it('names the player a report was filed against, not their id', async () => {
    useInProcessBff();
    renderWithProviders(
      <ActivityTable entries={entries} onOpenPlayer={vi.fn()} onOpenReport={vi.fn()} />,
    );
    expect(
      await within(row('Report filed')).findByRole('button', { name: 'ddurieux' }),
    ).toBeInTheDocument();
    expect(within(row('Report filed')).getByText('Report #3')).toBeInTheDocument();
  });

  it("keeps the game's own types as they are, with their details", () => {
    useInProcessBff();
    renderWithProviders(
      <ActivityTable entries={entries} onOpenPlayer={vi.fn()} onOpenReport={vi.fn()} />,
    );
    const table = screen.getByRole('table', { name: 'Activity' });

    expect(within(table).getByText('mission_completed')).toBeInTheDocument();
    expect(within(table).getByText('missionId: m-7')).toBeInTheDocument();
  });
});
