import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEconomieDataset, organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { CorporationSettingsDialog } from './CorporationSettingsDialog';

const settings = createEconomieDataset().corporationSettings[0];
if (!settings) throw new Error('fixture settings missing');
const mining = { id: organisationIds.mining, name: 'Deep Core Mining' };

describe('CorporationSettingsDialog', () => {
  it('changes the internal tax and donations in one call, the home untouched', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <CorporationSettingsDialog
        corporation={mining}
        settings={settings}
        homeName="Port Gaea"
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Economic settings of Deep Core Mining' });

    expect(within(dialog).getByText('Fiscal home: Port Gaea')).toBeInTheDocument();
    const rate = within(dialog).getByLabelText('Internal tax on donations (%)');
    await userEvent.clear(rate);
    await userEvent.type(rate, '5');
    await userEvent.click(within(dialog).getByLabelText('Members may donate to the treasury'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    const summary = within(dialog).getByRole('alert');
    expect(summary).toHaveTextContent('Internal tax on donations: 2.5% → 5%');
    expect(summary).toHaveTextContent('Member donations: Allowed → Refused');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes).toEqual([
      {
        call: `PUT /internal/corporations/${organisationIds.mining}/settings`,
        body: { taxRateBps: 500, allowDonations: false },
      },
    ]);
  });

  it('moves the fiscal home to another political entity, then detaches it', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(
      <CorporationSettingsDialog
        corporation={mining}
        settings={settings}
        homeName="Port Gaea"
        onClose={onClose}
      />,
    );
    let dialog = screen.getByRole('dialog');

    await userEvent.type(
      within(dialog).getByPlaceholderText(/Search a political entity/),
      'tarsis',
    );
    await userEvent.click(await screen.findByRole('option', { name: /Tarsis Union/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Fiscal home: Port Gaea → Tarsis Union',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes).toEqual([
      {
        call: `PUT /internal/corporations/${organisationIds.mining}/affiliation`,
        body: { politicalEntityId: organisationIds.country },
      },
    ]);
    unmount();

    renderWithProviders(
      <CorporationSettingsDialog
        corporation={mining}
        settings={settings}
        homeName="Port Gaea"
        onClose={vi.fn()}
      />,
    );
    dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'No fiscal home' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fiscal home: Port Gaea → None');
  });
});
