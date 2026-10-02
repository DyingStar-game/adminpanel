import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import type { ExplorerSearch } from '@/lib/explorerSearch';
import { ExplorerPage } from './ExplorerPage';

/** Renders the page as the route does: URL state held by the parent. */
function renderExplorer(initial: Partial<ExplorerSearch> = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [search, setSearch] = useState<ExplorerSearch>({
      parent: '',
      scope: 'level',
      page: 1,
      ...initial,
    });
    return (
      <ExplorerPage
        onOpen={vi.fn()}
        onOrbit={vi.fn()}
        search={search}
        onSearchChange={(next) => {
          onChange(next);
          setSearch(next);
        }}
      />
    );
  }
  renderWithProviders(<Harness />);
  return { onChange };
}

const tree = () => screen.getByRole('tree');
const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });
const table = () => screen.getByRole('rowgroup');

describe('ExplorerPage', () => {
  it('lists roots in the tree and in the table', async () => {
    useInProcessBff();
    renderExplorer();

    expect(await within(tree()).findByRole('treeitem', { name: 'SandBox' })).toBeInTheDocument();
    expect(within(tree()).getByRole('treeitem', { name: 'Tarsis' })).toBeInTheDocument();
    expect(await within(table()).findByText('SandBox')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('expands an item into type groups with counts and opens a group in the table', async () => {
    useInProcessBff();
    const { onChange } = renderExplorer();

    const sandbox = await within(tree()).findByRole('treeitem', { name: 'SandBox' });
    await userEvent.click(within(sandbox).getByRole('button', { name: 'Expand' }));
    const group = await within(tree()).findByRole('treeitem', { name: 'vehicle' });
    expect(group).toHaveTextContent('1');

    await userEvent.click(group);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ parent: ids.planet, type: 'vehicle', scope: 'level', page: 1 }),
    );
    // Profile columns for vehicles, references resolved to the pilot's name.
    expect(await screen.findByRole('columnheader', { name: 'pilot_uuid' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'parent_id' })).toBeInTheDocument();
    for (const name of ['speed', 'mass', 'cargo_mass']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    for (const name of ['seats', 'engine']) {
      expect(screen.queryByRole('columnheader', { name })).not.toBeInTheDocument();
    }
    // The parent and the pilot are resolved links.
    expect(await within(table()).findByRole('button', { name: /SandBox/ })).toBeInTheDocument();
    expect(await within(table()).findByRole('button', { name: /ddurieux/ })).toBeInTheDocument();
    expect(await within(table()).findByText(/^1\D?450$/)).toBeInTheDocument();
  });

  it('inspects an item: relations, broken links, channels and undeclared keys', async () => {
    useInProcessBff();
    renderExplorer({ parent: ids.planet, type: 'vehicle', selected: ids.vehicle });

    expect(await screen.findByRole('heading', { name: /vehicle 4e9a9ff9/ })).toBeInTheDocument();
    // The parent shows in Relations and as the `parent_id` property of its channel.
    expect(await within(inspector()).findAllByRole('button', { name: /SandBox/ })).toHaveLength(2);
    // The dangling component shows in Relations and in the `components` property.
    expect(await within(inspector()).findAllByText(/missing item/)).toHaveLength(2);
    expect(screen.getByText('Zone 0')).toBeInTheDocument();
    expect(screen.getByText('Not declared')).toBeInTheDocument();
    expect(screen.getByText('not replicated')).toBeInTheDocument();
    expect(await screen.findByText('vehicle_component 2')).toBeInTheDocument();
    // `object_data.uuid` points to the item itself, resolved without a request.
    expect(
      within(inspector()).getAllByRole('button', { name: /vehicle 4e9a9ff9/ }).length,
    ).toBeGreaterThan(0);
  });

  it('flags orphans', async () => {
    useInProcessBff();
    renderExplorer({ scope: 'type', type: 'vehicle_component', selected: ids.orphanComponent });

    expect(await screen.findByText('orphan')).toBeInTheDocument();
  });

  it('navigates through a reference into the referenced item level', async () => {
    useInProcessBff();
    const { onChange } = renderExplorer({
      parent: ids.planet,
      type: 'vehicle',
      selected: ids.vehicle,
    });

    await screen.findByRole('heading', { name: /vehicle 4e9a9ff9/ });
    // The pilot is referenced twice (pilot_uuid and seats.SeatDriver).
    const [pilot] = await within(inspector()).findAllByRole('button', { name: /ddurieux/ });
    await userEvent.click(pilot as HTMLElement);

    expect(onChange).toHaveBeenLastCalledWith({
      parent: ids.spawnbuilding,
      type: 'player',
      scope: 'level',
      page: 1,
      selected: ids.player,
    });
  });

  it('lists every item of a type with the "all" scope', async () => {
    useInProcessBff();
    renderExplorer({ scope: 'type', type: 'vehicle_component' });

    expect(await screen.findByText('3 items')).toBeInTheDocument();
  });

  it('copies the full UUID from the table without selecting the row', async () => {
    useInProcessBff();
    const { onChange } = renderExplorer();
    await within(table()).findByText('SandBox');

    const row = within(table()).getByText('SandBox').closest('[role=row]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Copy UUID' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ids.planet);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters the current page locally', async () => {
    useInProcessBff();
    renderExplorer();
    await within(table()).findByText('SandBox');

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Filter the page (name, uuid)' }),
      'tar',
    );

    expect(within(table()).queryByText('SandBox')).not.toBeInTheDocument();
    expect(within(table()).getByText('Tarsis')).toBeInTheDocument();
  });
});
