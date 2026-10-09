import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { accountIds, createEconomieDataset } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { LedgerTable } from './LedgerTable';

const transactions = createEconomieDataset().transactions.map((tx) => ({
  ...tx,
  id: BigInt(tx.id),
}));

describe('LedgerTable', () => {
  it("signs each movement from the holder's side, with its tax and its caller", () => {
    renderWithProviders(
      <LedgerTable transactions={transactions} own={new Set([accountIds.griefer])} />,
    );
    const rows = within(screen.getByRole('table', { name: 'Movements' })).getAllByRole('row');

    // Salary received, transfer paid with its tax.
    expect(rows[2]).toHaveTextContent('Salary+200 credits——player');
    expect(rows[3]).toHaveTextContent('Transfer-160 credits10 credits—svc-game');
  });

  it('shows why each movement was made: its reason, or a memo', () => {
    const [first, second] = transactions;
    if (!first || !second) throw new Error('fixtures missing');
    renderWithProviders(
      <LedgerTable
        transactions={[
          { ...first, reference: 'Cargo lost in a server crash', caller: 'svc-admin' },
          { ...second, details: { memo: 'For the new hangar' } },
        ]}
        own={new Set([accountIds.reporter, accountIds.griefer])}
      />,
    );
    const table = screen.getByRole('table', { name: 'Movements' });

    expect(within(table).getByRole('columnheader', { name: 'Reason' })).toBeInTheDocument();
    expect(within(table).getByText('Cargo lost in a server crash')).toHaveAttribute(
      'title',
      'Cargo lost in a server crash',
    );
    expect(within(table).getByText('For the new hangar')).toBeInTheDocument();
  });
});
