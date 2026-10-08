import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { ReputationHistoryTable } from './ReputationHistoryTable';

describe('ReputationHistoryTable', () => {
  it('shows each change signed, the balance after, its source and reason', () => {
    const [event] = createSocialDataset().reputationEvents;
    if (!event) throw new Error('fixture reputation event missing');
    render(<ReputationHistoryTable events={[event, { ...event, id: 2, delta: 5 }]} />);
    const table = screen.getByRole('table', { name: 'Reputation history' });

    expect(within(table).getByText('-25').closest('tr')).toHaveTextContent(
      '-27reportUpheld report',
    );
    expect(within(table).getByText('+5')).toBeInTheDocument();
  });
});
