import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MoneyMovementDialog } from './MoneyMovementDialog';

describe('MoneyMovementDialog', () => {
  it('credits a player after a summary, with a reason and an idempotency key', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <MoneyMovementDialog
        holder="players"
        target={{ id: socialIds.griefer, name: 'griefer42' }}
        direction="credit"
        balance={40}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Credit griefer42' });

    await userEvent.type(within(dialog).getByLabelText('Amount (credits)'), '500');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Why/), 'Cargo lost in a server crash');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    const summary = within(dialog).getByRole('alert');
    expect(summary).toHaveTextContent('500 credits credited to griefer42 (Deposit).');
    expect(summary).toHaveTextContent('Balance: 40 credits → 540 credits.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes[0]).toMatchObject({
      call: `POST /internal/players/${socialIds.griefer}/wallet/credit`,
      body: {
        amount: 500,
        type: 'deposit',
        reference: 'Cargo lost in a server crash',
        currency: 'credits',
        externalId: expect.stringMatching(/^admin-panel:/),
      },
    });
  });

  it('refuses to debit more than the balance', async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <MoneyMovementDialog
        holder="corporations"
        target={{ id: organisationIds.mining, name: 'Deep Core Mining' }}
        direction="debit"
        balance={9_000}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Debit Deep Core Mining' });

    await userEvent.type(within(dialog).getByLabelText(/Why/), 'Fine');
    await userEvent.type(within(dialog).getByLabelText('Amount (credits)'), '9001');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(within(dialog).getByText(/Available: 9,000 credits/)).toHaveClass('text-destructive');
    await userEvent.clear(within(dialog).getByLabelText('Amount (credits)'));
    await userEvent.type(within(dialog).getByLabelText('Amount (credits)'), '9000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('(Withdrawal)');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('→ 0 credits');
    expect(bff.economie.writes).toHaveLength(0);
  });
});
