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
    expect(rows[2]).toHaveTextContent('Salary+200 credits—player');
    expect(rows[3]).toHaveTextContent('Transfer-160 credits10 creditssvc-game');
  });
});
