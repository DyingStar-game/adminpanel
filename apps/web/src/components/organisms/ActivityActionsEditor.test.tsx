import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createNpcDataset, NPC_MANUAL_ACTIONS } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ActivityActionsEditor } from './ActivityActionsEditor';

const { activityActions } = createNpcDataset();

describe('ActivityActionsEditor', () => {
  it('adds an action to the meal and sends that activity only', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <ActivityActionsEditor mapping={activityActions} actions={[...NPC_MANUAL_ACTIONS]} />,
    );

    expect(screen.getByRole('button', { name: 'go_to_meal during Meal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'take_a_walk during Meal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save the mapping' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        {
          call: 'PUT /schedule/activity-actions',
          body: { meal: ['go_to_meal', 'take_a_walk'] },
        },
      ]),
    );
  });

  it('is read only for a moderator', () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <ActivityActionsEditor mapping={activityActions} actions={[...NPC_MANUAL_ACTIONS]} />
      </PermissionsContext.Provider>,
    );

    expect(screen.getByRole('button', { name: 'go_home during Off shift' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save the mapping' })).not.toBeInTheDocument();
  });
});
