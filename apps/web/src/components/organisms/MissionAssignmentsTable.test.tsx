import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMissionDataset, missionIds, socialIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { MissionAssignmentsTable } from './MissionAssignmentsTable';

const { assignments, playerNames } = createMissionDataset();
const delivery = assignments.filter((a) => a.missionId === missionIds.delivery);

describe('MissionAssignmentsTable', () => {
  it('shows who took it, what they handed in and whether they were paid', async () => {
    const onOpenPlayer = vi.fn();
    renderWithProviders(
      <MissionAssignmentsTable
        assignments={delivery}
        players={playerNames}
        onOpenPlayer={onOpenPlayer}
      />,
    );
    const table = screen.getByRole('table', { name: 'Who took it' });

    const partial = within(table).getByText('griefer42').closest('tr') as HTMLElement;
    expect(partial).toHaveTextContent('Partly handed in');
    expect(partial).toHaveTextContent('60%');
    expect(partial).toHaveTextContent('900 credits');
    expect(partial).toHaveTextContent('Paid');
    // An NPC has no name in `social` nor a sheet.
    const npc = within(table).getByText('NPC').closest('tr') as HTMLElement;
    expect(npc).toHaveTextContent('Abandoned');
    // No way to a sheet, only the id to copy.
    expect(
      within(npc)
        .queryAllByRole('button')
        .filter((b) => b.getAttribute('aria-label') !== 'Copy UUID'),
    ).toEqual([]);

    await userEvent.click(within(table).getByRole('button', { name: /ddurieux/ }));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
  });

  it('shows players without links when the account may not open their sheet', () => {
    renderWithProviders(<MissionAssignmentsTable assignments={delivery} players={{}} />);
    const table = screen.getByRole('table', { name: 'Who took it' });
    expect(
      within(table)
        .queryAllByRole('button')
        .filter((b) => b.getAttribute('aria-label') !== 'Copy UUID'),
    ).toEqual([]);
    // Without a name from `social`, the start of the id.
    expect(within(table).getByText(socialIds.griefer.slice(0, 8))).toBeInTheDocument();
  });
});
