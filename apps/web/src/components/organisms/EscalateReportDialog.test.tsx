import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { EscalateReportDialog } from './EscalateReportDialog';

describe('EscalateReportDialog', () => {
  it('asks before escalating one level, then escalates and closes', async () => {
    const bff = useInProcessBff();
    const claimed = bff.social.data.reports.find((r) => r.id === 1);
    if (claimed) claimed.status = 'reviewing';
    const onClose = vi.fn();
    const report = createSocialDataset().reports[0];
    if (!report) throw new Error('fixture report missing');
    renderWithProviders(<EscalateReportDialog report={report} to="admin" onClose={onClose} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Escalate report #1?' });

    expect(within(dialog).getByText(/From Moderator to Admin/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escalate' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes.map((w) => w.call)).toEqual(['POST /reports/1/escalate']);
    expect(bff.social.data.reports[0]).toMatchObject({ escalation: 'admin', status: 'open' });
  });
});
