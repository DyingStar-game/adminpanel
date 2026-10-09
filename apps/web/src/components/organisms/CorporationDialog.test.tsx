import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset, organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { CorporationDialog } from './CorporationDialog';

describe('CorporationDialog', () => {
  it('creates a corporation with the CEO picked, after a summary', async () => {
    const bff = useInProcessBff();
    const onCreated = vi.fn();
    renderWithProviders(<CorporationDialog onClose={vi.fn()} onCreated={onCreated} />);
    const dialog = screen.getByRole('dialog', { name: 'Create a corporation' });

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ddurieux Hauling');
    await userEvent.type(within(dialog).getByLabelText('Ticker'), 'dhl');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(within(dialog).getByPlaceholderText(/Search a player/), 'ddur');
    await userEvent.click(await screen.findByRole('option', { name: /ddurieux/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Ddurieux Hauling [DHL], recruitment On application.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bff.social.writes[0]).toEqual({
      call: 'POST /internal/corporations',
      body: {
        name: 'Ddurieux Hauling',
        ticker: 'dhl',
        recruitment: 'apply',
        description: null,
        ceoId: socialIds.reporter,
      },
    });
  });

  it('edits a corporation without asking for a CEO', async () => {
    const bff = useInProcessBff();
    const corporation = createSocialDataset().corporations.find(
      (c) => c.id === organisationIds.mining,
    );
    if (!corporation) throw new Error('fixture corporation missing');
    const onClose = vi.fn();
    renderWithProviders(<CorporationDialog corporation={corporation} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit Deep Core Mining' });

    expect(within(dialog).queryByPlaceholderText(/Search a player/)).toBeNull();
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Deep Core Drilling');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes[0]).toMatchObject({
      call: `PATCH /internal/corporations/${organisationIds.mining}`,
      body: { name: 'Deep Core Drilling', ticker: 'DCM' },
    });
  });
});
