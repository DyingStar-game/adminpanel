import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset } from '@dyingstar-admin/testing';
import type { ReportView } from '@dyingstar-admin/contracts/social';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ReportDetail } from './ReportDetail';

const reports = createSocialDataset().reports;
const report = (id: number, changes: Partial<ReportView> = {}) => {
  const found = reports.find((r) => r.id === id);
  if (!found) throw new Error(`fixture report ${id} missing`);
  return { ...found, ...changes };
};

const renderDetail = (shown: ReportView, permissions?: string[]) => {
  const detail = (
    <ReportDetail
      report={shown}
      player={(id, label) => <span>{label ?? id ?? 'System'}</span>}
      onClose={vi.fn()}
    />
  );
  renderWithProviders(
    permissions ? (
      <PermissionsContext.Provider value={permissions}>{detail}</PermissionsContext.Provider>
    ) : (
      detail
    ),
  );
  return screen.getByRole('region', { name: `Report #${shown.id}` });
};

describe('ReportDetail', () => {
  const buttons = (region: HTMLElement) =>
    within(region)
      .queryAllByRole('button')
      .map((b) => b.textContent)
      .filter((name) => name !== '');

  it('offers only to claim an open report', async () => {
    useInProcessBff();
    const region = renderDetail(report(1));

    expect(within(region).getByText('Blew up my truck at the spawn.')).toBeInTheDocument();
    expect(buttons(region)).toEqual(['Claim']);
    await userEvent.click(within(region).getByRole('button', { name: 'Claim' }));
    expect(screen.getByRole('dialog', { name: 'Claim report #1' })).toBeInTheDocument();
  });

  it('then offers to confirm, dismiss or escalate it', async () => {
    useInProcessBff();
    const region = renderDetail(report(1, { status: 'reviewing' }));

    expect(buttons(region)).toEqual(['Confirm', 'Dismiss', 'Escalate']);
    await userEvent.click(within(region).getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('dialog', { name: 'Confirm report #1' })).toBeInTheDocument();
  });

  it('offers no escalation above the supervisors', () => {
    useInProcessBff();
    const region = renderDetail(report(2, { escalation: 'supervisor' }));

    expect(buttons(region)).toEqual(['Confirm', 'Dismiss']);
  });

  it('shows a closed report with its resolution and no action', () => {
    useInProcessBff();
    const region = renderDetail(report(3));

    expect(within(region).getByText(/Retaliation report\./)).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('shows the note of a report under review', () => {
    useInProcessBff();
    const region = renderDetail(
      report(1, { status: 'reviewing', resolutionNote: 'Checking logs' }),
    );

    expect(within(region).getByText('Checking logs')).toBeInTheDocument();
  });

  it('leaves a report above the user’s level to that level, saying so', () => {
    useInProcessBff();
    const region = renderDetail(report(2), ['social.moderate']);

    expect(within(region).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(within(region).queryByRole('button', { name: 'Escalate' })).toBeNull();
    expect(
      within(region).getByText(
        'Escalated to the Admin level: only that role or above may act on it.',
      ),
    ).toBeInTheDocument();
  });

  it('lets an admin act on a report at the admin level', () => {
    useInProcessBff();
    const region = renderDetail(report(2), ['social.moderate', 'social.reportsAdmin']);

    expect(within(region).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Escalate' })).toBeInTheDocument();
  });

  it('offers no action without the moderation permission', () => {
    useInProcessBff();
    const region = renderDetail(report(1), ['persistence.read']);

    expect(within(region).queryByRole('button', { name: 'Claim' })).toBeNull();
  });
});
