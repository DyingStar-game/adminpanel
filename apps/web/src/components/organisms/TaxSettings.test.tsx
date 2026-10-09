import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { TaxSettings } from './TaxSettings';

const commune = { id: organisationIds.commune, name: 'Port Gaea', type: 'commune' } as const;

describe('TaxSettings', () => {
  it("shows an entity's tax rates and minting policy, read only by default", async () => {
    useInProcessBff();
    renderWithProviders(<TaxSettings entity={commune} />);

    expect(await screen.findByText('5%')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit the settings' })).toBeNull();
  });

  it('opens the settings and the assessment to those who manage them', async () => {
    useInProcessBff();
    renderWithProviders(<TaxSettings entity={commune} manages />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit the settings' }));
    expect(
      screen.getByRole('dialog', { name: 'Taxes and money issuing of Port Gaea' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Run a tax assessment' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Tax assessment of Port Gaea' }),
    ).toBeInTheDocument();
  });
});
