import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { CorporationEconomySettings } from './CorporationEconomySettings';

const mining = { id: organisationIds.mining, name: 'Deep Core Mining' };

describe('CorporationEconomySettings', () => {
  it("shows a corporation's internal tax, donations and fiscal home, linked", async () => {
    useInProcessBff();
    const onOpen = vi.fn();
    renderWithProviders(
      <CorporationEconomySettings corporation={mining} onOpenPoliticalEntity={onOpen} />,
    );

    expect(await screen.findByText('2.5%')).toBeInTheDocument();
    expect(screen.getByText('Allowed')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Port Gaea' }));
    expect(onOpen).toHaveBeenCalledWith(organisationIds.commune);
    expect(screen.queryByRole('button', { name: 'Edit the settings' })).toBeNull();
  });

  it('opens the settings to those who manage them; none without a fiscal home', async () => {
    useInProcessBff();
    renderWithProviders(
      <CorporationEconomySettings
        corporation={{ id: organisationIds.logistics, name: 'DCM Logistics' }}
        manages
        onOpenPoliticalEntity={vi.fn()}
      />,
    );

    expect(await screen.findByText('None')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit the settings' }));
    expect(
      screen.getByRole('dialog', { name: 'Economic settings of DCM Logistics' }),
    ).toBeInTheDocument();
  });
});
