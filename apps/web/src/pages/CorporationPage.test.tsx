import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { CorporationPage } from './CorporationPage';

const renderPage = (corporationId: string, permissions?: string[]) => {
  const props = {
    onSearchChange: vi.fn(),
    onBack: vi.fn(),
    onOpenPlayer: vi.fn(),
    onOpenCorporation: vi.fn(),
    onOpenPoliticalEntity: vi.fn(),
    onDisbanded: vi.fn(),
  };
  const page = (
    <CorporationPage
      corporationId={corporationId}
      search={{ members: 1, children: 1 }}
      {...props}
    />
  );
  renderWithProviders(
    permissions ? (
      <PermissionsContext.Provider value={permissions}>{page}</PermissionsContext.Provider>
    ) : (
      page
    ),
  );
  return props;
};

describe('CorporationPage (ADR 0024 step 2)', () => {
  it('shows a holding: CEO, political home, ranks, members, subsidiaries', async () => {
    useInProcessBff();
    const props = renderPage(organisationIds.mining);

    expect(await screen.findByRole('heading', { name: 'Deep Core Mining' })).toBeInTheDocument();
    expect(screen.getByText('Ore from the deep shafts of SandBox.')).toBeInTheDocument();
    const ranks = screen.getByRole('table', { name: 'Ranks' });
    expect(within(ranks).getAllByRole('row')).toHaveLength(4);
    const members = await screen.findByRole('table', { name: 'Members' });
    expect(await within(members).findByText('griefer42')).toBeInTheDocument();

    // Its political home in social, and its fiscal home in economie: the same commune here.
    const homes = await screen.findAllByRole('button', { name: 'Port Gaea' });
    expect(homes).toHaveLength(2);
    expect(
      within(screen.getByRole('region', { name: 'Economic settings' })).getByRole('button', {
        name: 'Port Gaea',
      }),
    ).toBeInTheDocument();
    await userEvent.click(homes[0] as HTMLElement);
    expect(props.onOpenPoliticalEntity).toHaveBeenCalledWith(organisationIds.commune);
    await userEvent.click(screen.getByRole('button', { name: 'griefer42' }));
    expect(props.onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
    const subsidiaries = await screen.findByRole('table', { name: 'Subsidiaries' });
    await userEvent.click(await within(subsidiaries).findByText('DCM Logistics'));
    expect(props.onOpenCorporation).toHaveBeenCalledWith(organisationIds.logistics);
  });

  it('links a subsidiary to its holding', async () => {
    useInProcessBff();
    const props = renderPage(organisationIds.logistics);

    await userEvent.click(await screen.findByRole('button', { name: 'Deep Core Mining' }));
    expect(props.onOpenCorporation).toHaveBeenCalledWith(organisationIds.mining);
  });

  it('says when social has no such corporation', async () => {
    useInProcessBff();
    renderPage('7c0a7e1e-0000-4000-8000-000000000000');

    expect(
      await screen.findByText(/No organisation 7c0a7e1e-0000-4000-8000-000000000000/),
    ).toBeInTheDocument();
  });

  it('shows its economic settings, read only with the read role', async () => {
    useInProcessBff();
    renderPage(organisationIds.mining, ['social.moderate', 'economie.corporationRead']);

    const settings = await screen.findByRole('region', { name: 'Economic settings' });
    expect(await within(settings).findByText('2.5%')).toBeInTheDocument();
    expect(within(settings).queryByRole('button', { name: 'Edit the settings' })).toBeNull();
  });

  it('leaves the economic settings out without their capability role', async () => {
    useInProcessBff();
    renderPage(organisationIds.mining, ['social.moderate', 'economie.walletRead']);

    await screen.findByRole('region', { name: 'Treasury' });
    expect(screen.queryByRole('region', { name: 'Economic settings' })).toBeNull();
  });

  describe('managing it (step N, as svc-admin)', () => {
    it('edits, transfers and disbands, with the capability role', async () => {
      useInProcessBff();
      const props = renderPage(organisationIds.mining);

      await screen.findByRole('heading', { name: 'Deep Core Mining' });
      expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Transfer' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Disband' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disband' }),
      );
      await vi.waitFor(() => expect(props.onDisbanded).toHaveBeenCalled());
    });

    it('offers nothing to manage without the capability role', async () => {
      useInProcessBff();
      renderPage(organisationIds.mining, ['social.moderate']);

      await screen.findByRole('heading', { name: 'Deep Core Mining' });
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Disband' })).toBeNull();
    });
  });
});
