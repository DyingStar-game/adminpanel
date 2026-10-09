import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEconomieDataset, organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PoliticalSettingsDialog } from './PoliticalSettingsDialog';

const settings = createEconomieDataset().politicalSettings[0];
if (!settings) throw new Error('fixture settings missing');

describe('PoliticalSettingsDialog', () => {
  it('sends the changed rates only, after a summary of the changes', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <PoliticalSettingsDialog
        entity={{ id: organisationIds.commune, name: 'Port Gaea', type: 'commune' }}
        settings={settings}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Taxes and money issuing of Port Gaea' });

    // A commune does not issue money; nothing changed yet.
    expect(within(dialog).queryByLabelText('May issue money')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    const income = within(dialog).getByLabelText('Income tax (%)');
    expect(income).toHaveAttribute('type', 'number');
    expect(income).toHaveAttribute('step', '0.01');
    await userEvent.clear(income);
    await userEvent.type(income, '101');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.clear(income);
    await userEvent.type(income, '3.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Income tax: 2% → 3.5%');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes).toEqual([
      {
        call: `PUT /internal/politics/${organisationIds.commune}/settings`,
        body: { incomeTaxBps: 350 },
      },
    ]);
  });

  it('lets a country issue money, with a ceiling', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <PoliticalSettingsDialog
        entity={{ id: organisationIds.country, name: 'Tarsis Union', type: 'country' }}
        settings={{ ...settings, entityId: organisationIds.country, lastAssessedAt: null }}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');

    await userEvent.click(within(dialog).getByLabelText('May issue money'));
    const ceiling = within(dialog).getByLabelText(/Most issued at once/);
    await userEvent.clear(ceiling);
    await userEvent.type(ceiling, '50000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Money issuing: Not allowed → Allowed',
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Issuing ceiling: no limit → 50,000 credits',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes[0]?.body).toEqual({ allowMinting: true, mintCeiling: 50_000 });
  });
});
