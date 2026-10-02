import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import type { MapSearch } from '@/lib/mapSearch';
import { usePreferences } from '@/stores/preferences';
import { MapPage } from './MapPage';

function renderMap(uuid: string) {
  const onSearchChange = vi.fn();
  function Harness() {
    const [search, setSearch] = useState<MapSearch>({});
    return (
      <div style={{ width: 1200, height: 800 }}>
        <MapPage
          uuid={uuid}
          search={search}
          onSearchChange={(next) => {
            onSearchChange(next);
            setSearch(next);
          }}
          onOpenPage={vi.fn()}
          onOpenInExplorer={vi.fn()}
          onOpenOrbit={vi.fn()}
        />
      </div>
    );
  }
  renderWithProviders(<Harness />);
  return { onSearchChange };
}

describe('MapPage', () => {
  it('lists the types on the body, rocks hidden by default, and remembers toggles', async () => {
    useInProcessBff();
    renderMap(ids.planet);

    expect(await screen.findByRole('heading', { name: 'Map of SandBox' })).toBeInTheDocument();
    const legend = screen.getByRole('region', { name: 'Types' });
    // The moon has no position, the wheels belong to the vehicle: neither is listed.
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['miningrock1', 'player1', 'spawnbuilding1', 'vehicle1']);
    const rocks = within(legend).getByRole('switch', { name: 'Show miningrock' });
    expect(rocks).not.toBeChecked();
    expect(screen.getByText('3 of 4 items shown')).toBeInTheDocument();

    await userEvent.click(rocks);

    expect(rocks).toBeChecked();
    expect(screen.getByText('4 of 4 items shown')).toBeInTheDocument();
    expect(usePreferences.getState().mapHidden).toMatchObject({ miningrock: false });
  });

  it('writes the names of a type above its markers on demand', async () => {
    useInProcessBff();
    renderMap(ids.planet);

    const legend = await screen.findByRole('region', { name: 'Types' });
    const names = within(legend).getByRole('button', { name: 'Names of player' });
    expect(names).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(names);

    expect(names).toHaveAttribute('aria-pressed', 'true');
    // jsdom gives the map no size: markers stay clustered, labels are checked in a browser.
    expect(usePreferences.getState().mapNamed).toMatchObject({ player: true });
  });

  it('finds an item, selects it and shows it in the inspector', async () => {
    useInProcessBff();
    const { onSearchChange } = renderMap(ids.planet);

    await userEvent.type(
      await screen.findByRole('combobox', { name: 'Search (name, UUID, type)' }),
      'ddur',
    );
    await userEvent.click(await screen.findByRole('option', { name: /ddurieux/ }));

    expect(onSearchChange).toHaveBeenLastCalledWith({ selected: ids.player });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'ddurieux' })).toBeInTheDocument(),
    );
  });

  it('says when the item does not exist', async () => {
    useInProcessBff();
    renderMap('6a6a6a6a-0000-0000-0000-000000000000');

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
