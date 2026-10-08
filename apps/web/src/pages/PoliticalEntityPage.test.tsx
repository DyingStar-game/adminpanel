import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PoliticalEntityPage } from './PoliticalEntityPage';

const renderPage = (entityId: string) => {
  const props = {
    onSearchChange: vi.fn(),
    onBack: vi.fn(),
    onOpenPlayer: vi.fn(),
    onOpenPoliticalEntity: vi.fn(),
  };
  renderWithProviders(
    <PoliticalEntityPage entityId={entityId} search={{ members: 1, children: 1 }} {...props} />,
  );
  return props;
};

describe('PoliticalEntityPage (ADR 0024 step 2)', () => {
  it('shows a commune: head, higher level, offices and members', async () => {
    useInProcessBff();
    const props = renderPage(organisationIds.commune);

    expect(await screen.findByRole('heading', { name: 'Port Gaea' })).toBeInTheDocument();
    const offices = screen.getByRole('table', { name: 'Offices' });
    expect(within(offices).getAllByRole('row')[1]).toHaveTextContent('MayorLeader100');
    const members = await screen.findByRole('table', { name: 'Members' });
    expect(await within(members).findByText('ddurieux')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tarsis Union' }));
    expect(props.onOpenPoliticalEntity).toHaveBeenCalledWith(organisationIds.country);
    await userEvent.click(screen.getByRole('button', { name: 'griefer42' }));
    expect(props.onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
  });

  it('shows a country as independent, with its lower levels', async () => {
    useInProcessBff();
    renderPage(organisationIds.country);

    expect(await screen.findByText('Independent')).toBeInTheDocument();
    const children = await screen.findByRole('table', { name: 'Lower levels' });
    expect(await within(children).findByText('Port Gaea')).toBeInTheDocument();
  });
});
