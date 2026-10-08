import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { TransferOrganisationDialog } from './TransferOrganisationDialog';

describe('TransferOrganisationDialog', () => {
  it('says when no other member may take the lead', () => {
    useInProcessBff();
    renderWithProviders(
      <TransferOrganisationDialog
        kind="corporation"
        organisation={{ id: organisationIds.mining, name: 'Deep Core Mining' }}
        candidates={[]}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Transfer Deep Core Mining' });

    expect(within(dialog).getByText(/No other member/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
