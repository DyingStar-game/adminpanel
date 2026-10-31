import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDataset, createDiscoveries } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { PlaceNamesSearchSchema, type PlaceNamesSearch } from '@/lib/placeNamesSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PlaceNamesPage } from './PlaceNamesPage';

const renderPage = (search: Partial<PlaceNamesSearch> = {}, permissions?: string[]) => {
  const onSearchChange = vi.fn();
  const page = (
    <PlaceNamesPage
      search={PlaceNamesSearchSchema.parse(search)}
      onSearchChange={onSearchChange}
      onOpenPlayer={vi.fn()}
      onOpenItem={vi.fn()}
    />
  );
  renderWithProviders(
    permissions ? (
      <PermissionsContext.Provider value={permissions}>{page}</PermissionsContext.Provider>
    ) : (
      page
    ),
  );
  return onSearchChange;
};

describe('PlaceNamesPage (ADR 0032)', () => {
  it('lists the names to review, oldest first, and opens the decision', async () => {
    useInProcessBff([...createDataset(), ...createDiscoveries()]);
    renderPage();

    const table = await screen.findByRole('table', { name: 'Names to review' });
    const names = await within(table).findAllByText(/L'Antre des Échos|Fang Hollow/);
    expect(names.map((n) => n.textContent)).toEqual(["L'Antre des Échos", 'Fang Hollow']);
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/published in game as approved by ARES/)).toBeInTheDocument();

    const line = names[1]?.closest('tr') as HTMLElement;
    await userEvent.click(within(line).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      '“Fang Hollow”, proposed by ddurieux (Cave, Tarsis III (Sandbox)).',
    );
  });

  it('filters by status and kind from the URL, back to the first page on a change', async () => {
    useInProcessBff([...createDataset(), ...createDiscoveries()]);
    const onSearchChange = renderPage({ status: 'approved', page: 1 });

    const table = await screen.findByRole('table', { name: 'Names to review' });
    expect(await within(table).findByText('Deep Hollow')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Kind of place' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cave' }));
    expect(onSearchChange).toHaveBeenCalledWith({ status: 'approved', kind: 'cave', page: 1 });
  });

  it('offers no decision to an account that may only read', async () => {
    useInProcessBff([...createDataset(), ...createDiscoveries()]);
    renderPage({}, ['persistence.read']);

    const table = await screen.findByRole('table', { name: 'Names to review' });
    await within(table).findByText('Fang Hollow');
    expect(within(table).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
