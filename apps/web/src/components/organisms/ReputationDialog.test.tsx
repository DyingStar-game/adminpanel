import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ReputationDialog } from './ReputationDialog';

describe('ReputationDialog', () => {
  it('refuses a change out of −100…100 or a missing reason', async () => {
    useInProcessBff();
    renderWithProviders(
      <ReputationDialog
        playerId={socialIds.reporter}
        playerName="ddurieux"
        reputation={3}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const next = within(dialog).getByRole('button', { name: 'Continue' });

    await userEvent.type(within(dialog).getByLabelText('Change'), '150');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Helped');
    expect(next).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Change'));
    await userEvent.type(within(dialog).getByLabelText('Change'), '10');
    await vi.waitFor(() => expect(next).toBeEnabled());
  });

  it('confirms the change with the balance after, then adjusts', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <ReputationDialog
        playerId={socialIds.reporter}
        playerName="ddurieux"
        reputation={3}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Change'), '10');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Helped new players');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('+10 for ddurieux (3 → 13)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes[0]?.body).toEqual({ delta: 10, reason: 'Helped new players' });
  });
});
