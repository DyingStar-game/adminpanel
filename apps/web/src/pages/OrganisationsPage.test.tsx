import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds } from '@dyingstar-admin/testing';
import { OrganisationsSearchSchema, type OrganisationsSearch } from '@/lib/organisationsSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { OrganisationsPage } from './OrganisationsPage';

const renderPage = (search: Partial<OrganisationsSearch> = {}) => {
  const props = {
    onSearchChange: vi.fn(),
    onOpenCorporation: vi.fn(),
    onOpenPoliticalEntity: vi.fn(),
  };
  renderWithProviders(
    <OrganisationsPage search={OrganisationsSearchSchema.parse(search)} {...props} />,
  );
  return props;
};

describe('OrganisationsPage (ADR 0024 step 2)', () => {
  it('lists the corporations and opens one', async () => {
    useInProcessBff();
    const { onOpenCorporation } = renderPage();

    const table = await screen.findByRole('table', { name: 'Corporations' });
    await userEvent.click(await within(table).findByText('Deep Core Mining'));
    expect(onOpenCorporation).toHaveBeenCalledWith(organisationIds.mining);
  });

  it('lists the political entities of a level and opens one', async () => {
    useInProcessBff();
    const { onOpenPoliticalEntity } = renderPage({ tab: 'politics', type: 'commune' });

    const table = await screen.findByRole('table', { name: 'Political entities' });
    await userEvent.click(await within(table).findByText('Port Gaea'));
    expect(within(table).queryByText('Tarsis Union')).toBeNull();
    expect(onOpenPoliticalEntity).toHaveBeenCalledWith(organisationIds.commune);
  });

  it('searches by name once the user pauses, from the first page', async () => {
    useInProcessBff();
    const { onSearchChange } = renderPage({ page: 2 });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search by name' }), 'core');
    await vi.waitFor(() =>
      expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'core', page: 1 })),
    );
  });
});
