import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEconomieDataset, organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MintMoneyDialog } from './MintMoneyDialog';

const base = createEconomieDataset().politicalSettings[0];
if (!base) throw new Error('fixture settings missing');
const country = { id: organisationIds.country, name: 'Tarsis Union' };

describe('MintMoneyDialog', () => {
  it('issues money within the ceiling, after a summary', async () => {
    const bff = useInProcessBff();
    await fetch(`/api/economie/politics/${organisationIds.country}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowMinting: true, mintCeiling: 10_000 }),
    });
    const onClose = vi.fn();
    renderWithProviders(
      <MintMoneyDialog
        entity={country}
        settings={{ ...base, entityId: country.id, allowMinting: true, mintCeiling: 10_000 }}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Issue money into the treasury of Tarsis Union',
    });

    expect(within(dialog).getByText('At most 10,000 credits at once')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Why/), 'Founding stimulus');
    await userEvent.type(within(dialog).getByLabelText('Amount (credits)'), '10001');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Amount (credits)'));
    await userEvent.type(within(dialog).getByLabelText('Amount (credits)'), '10000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '10,000 credits created and credited to the treasury of Tarsis Union.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes.at(-1)).toEqual({
      call: `POST /internal/politics/${organisationIds.country}/mint`,
      body: { amount: 10_000, reason: 'Founding stimulus', currency: 'credits' },
    });
  });

  it('says when the settings do not allow it', () => {
    useInProcessBff();
    renderWithProviders(<MintMoneyDialog entity={country} settings={base} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('may not issue money');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
