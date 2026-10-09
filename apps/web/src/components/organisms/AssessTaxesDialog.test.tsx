import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEconomieDataset, organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { AssessTaxesDialog } from './AssessTaxesDialog';

const settings = createEconomieDataset().politicalSettings[0];
if (!settings) throw new Error('fixture settings missing');

describe('AssessTaxesDialog', () => {
  it('warns that each run books new debts, then runs the assessment', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <AssessTaxesDialog
        entity={{ id: organisationIds.commune, name: 'Port Gaea' }}
        settings={settings}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Tax assessment of Port Gaea' });

    expect(dialog).toHaveTextContent('5% of the treasury of each corporation');
    expect(dialog).toHaveTextContent('2% of its members’ income');
    expect(dialog).toHaveTextContent('running it twice taxes the same treasuries twice');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run a tax assessment' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.economie.writes).toEqual([
      {
        call: `POST /internal/politics/${organisationIds.commune}/taxes/assess`,
        body: { currency: 'credits' },
      },
    ]);
    expect(bff.economie.data.taxDebts).toMatchObject([{ amount: 450 }]);
  });

  it('says when it is the first assessment', () => {
    useInProcessBff();
    renderWithProviders(
      <AssessTaxesDialog
        entity={{ id: organisationIds.country, name: 'Tarsis Union' }}
        settings={{ ...settings, lastAssessedAt: null }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('First assessment');
  });
});
