import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ReportStatusDialog, type ReportMove } from './ReportStatusDialog';

const [playerReport, systemReport] = createSocialDataset().reports;

/** Report 1, claimed in the service (the panel decides claimed reports only). */
const claim = (bff: ReturnType<typeof useInProcessBff>) => {
  const report = bff.social.data.reports.find((r) => r.id === 1);
  if (report) report.status = 'reviewing';
};

const renderDialog = (status: ReportMove, report = playerReport) => {
  if (!report) throw new Error('fixture report missing');
  const onClose = vi.fn();
  renderWithProviders(<ReportStatusDialog report={report} status={status} onClose={onClose} />);
  return { onClose, dialog: screen.getByRole('dialog') };
};

describe('ReportStatusDialog', () => {
  it('confirms a claimed report with a note, after a summary telling its reputation cost', async () => {
    const bff = useInProcessBff();
    claim(bff);
    const { onClose, dialog } = renderDialog('resolved');

    expect(within(dialog).getByText('griefer42 loses reputation again.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Note'), '  Seen on the replay.  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Report #1 against griefer42: Confirmed. “Seen on the replay.” griefer42 loses reputation again.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes).toEqual([
      { call: 'PATCH /reports/1', body: { status: 'resolved', note: 'Seen on the replay.' } },
    ]);
  });

  it('claims a report without a note', async () => {
    const bff = useInProcessBff();
    const { onClose, dialog } = renderDialog('reviewing');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes[0]?.body).toEqual({ status: 'reviewing' });
  });

  it('tells no reputation change for a report the system raised', () => {
    useInProcessBff();
    const { dialog } = renderDialog('dismissed', systemReport);

    expect(within(dialog).queryByText(/reputation the report cost/)).not.toBeInTheDocument();
  });

  it("keeps the dialog open on social's refusal", async () => {
    const bff = useInProcessBff();
    const report = bff.social.data.reports[0];
    if (report) report.status = 'resolved';
    const { onClose, dialog } = renderDialog('dismissed');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
