import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { PlayerReportsTable } from './PlayerReportsTable';

describe('PlayerReportsTable', () => {
  it('lists reports with reason, reporter and status, and opens one', async () => {
    const onOpenReport = vi.fn();
    render(
      <PlayerReportsTable reports={createSocialDataset().reports} onOpenReport={onOpenReport} />,
    );
    const table = screen.getByRole('table', { name: 'Reports against them' });

    expect(within(table).getByText('Griefing').closest('tr')).toHaveTextContent('ddurieuxOpen');
    // Raised by the reputation thresholds: no reporter.
    expect(within(table).getByText('Reputation threshold').closest('tr')).toHaveTextContent(
      'System',
    );
    await userEvent.click(within(table).getByText('Griefing'));
    expect(onOpenReport).toHaveBeenCalledWith(1);
  });
});
