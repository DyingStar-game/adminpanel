import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { DisbandOrganisationDialog } from './DisbandOrganisationDialog';

describe('DisbandOrganisationDialog', () => {
  it('disbands a political entity for good, after confirmation', async () => {
    const bff = useInProcessBff();
    const onDisbanded = vi.fn();
    renderWithProviders(
      <DisbandOrganisationDialog
        kind="politics"
        organisation={{ id: organisationIds.commune, name: 'Port Gaea' }}
        onClose={vi.fn()}
        onDisbanded={onDisbanded}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Disband Port Gaea?' });

    expect(within(dialog).getByText(/lower levels and corporations/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disband' }));
    await vi.waitFor(() => expect(onDisbanded).toHaveBeenCalled());
    expect(bff.social.data.politics.some((p) => p.id === organisationIds.commune)).toBe(false);
  });
});
