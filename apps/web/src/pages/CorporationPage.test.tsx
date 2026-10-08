import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { CorporationPage } from './CorporationPage';

const renderPage = (corporationId: string) => {
  const props = {
    onSearchChange: vi.fn(),
    onBack: vi.fn(),
    onOpenPlayer: vi.fn(),
    onOpenCorporation: vi.fn(),
    onOpenPoliticalEntity: vi.fn(),
  };
  renderWithProviders(
    <CorporationPage
      corporationId={corporationId}
      search={{ members: 1, children: 1 }}
      {...props}
    />,
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

    await userEvent.click(await screen.findByRole('button', { name: 'Port Gaea' }));
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
});
