import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import type { OrbitSearch } from '@/lib/orbitSearch';
import { useItemActions } from '@/stores/itemActions';
import { OrbitPage } from './OrbitPage';

function renderOrbit(uuid: string, initial: Partial<OrbitSearch> = {}) {
  const onSearchChange = vi.fn();
  const onRecenter = vi.fn();
  function Harness() {
    const [search, setSearch] = useState<OrbitSearch>({ open: [], pages: {}, ...initial });
    return (
      <div style={{ width: 1200, height: 800 }}>
        <OrbitPage
          uuid={uuid}
          search={search}
          onSearchChange={(next) => {
            onSearchChange(next);
            setSearch(next);
          }}
          onRecenter={onRecenter}
          onOpenPage={vi.fn()}
          onOpenInExplorer={vi.fn()}
          onOpenMap={vi.fn()}
        />
      </div>
    );
  }
  renderWithProviders(<Harness />);
  return { onSearchChange, onRecenter };
}

// jsdom never measures nodes, so React Flow keeps them `visibility: hidden`, and the
// accessible name of hidden elements is empty: match their `aria-label` directly.
// Graph nodes are clicked with `fireEvent`: user-event's mousedown has no `view` in jsdom,
// which d3-zoom (inside React Flow) dereferences.
const node = (label: string | RegExp) =>
  waitFor(
    () => {
      const region = screen.getByRole('region', { name: 'Orbit' });
      const found = within(region)
        .queryAllByRole('group', { hidden: true })
        .find((el) => {
          const value = el.getAttribute('aria-label') ?? '';
          return typeof label === 'string' ? value === label : label.test(value);
        });
      if (!found) throw new Error(`No orbit node labelled ${String(label)}`);
      return found;
    },
    // Child counts query every known type before the graph is complete.
    { timeout: 3000 },
  );

describe('OrbitPage', () => {
  it('centres on the entity with its parent, child clusters and references', async () => {
    useInProcessBff();
    renderOrbit(ids.vehicle);

    expect(await node(/vehicle 4e9a9ff9/)).toBeInTheDocument();
    expect(await node('SandBox')).toBeInTheDocument();
    expect(await node('vehicle_component')).toBeInTheDocument();
    expect(await node('ddurieux')).toBeInTheDocument();
    // The dangling component reference is drawn, flagged as missing.
    expect(await node('deadbeef')).toBeInTheDocument();
    // Components are children: shown by the vehicle_component cluster, not as references.
    const labels = within(screen.getByRole('region', { name: 'Orbit' }))
      .queryAllByRole('group', { hidden: true })
      .map((el) => el.getAttribute('aria-label'));
    expect(labels).not.toContain('slot_fl');
  });

  it('adds an item under the centre', async () => {
    useInProcessBff();
    renderOrbit(ids.vehicle);

    await userEvent.click(await screen.findByRole('button', { name: 'Add an item' }));

    expect(useItemActions.getState().action).toMatchObject({
      kind: 'create',
      parentId: ids.vehicle,
    });
  });

  it('opens a cluster and fans its children out', async () => {
    useInProcessBff();
    const { onSearchChange } = renderOrbit(ids.vehicle);

    fireEvent.click(await node('vehicle_component'));

    expect(onSearchChange).toHaveBeenLastCalledWith({
      open: ['vehicle_component'],
      pages: {},
    });
    expect(await node('slot_fl')).toBeInTheDocument();
    expect(await screen.findByText('1–2 of 2')).toBeInTheDocument();
  });

  it('keeps several clusters open at once and closes them one by one or all', async () => {
    useInProcessBff();
    const { onSearchChange } = renderOrbit(ids.planet);

    fireEvent.click(await node('vehicle'));
    fireEvent.click(await node('spawnbuilding'));

    expect(onSearchChange).toHaveBeenLastCalledWith({
      open: ['vehicle', 'spawnbuilding'],
      pages: {},
    });
    // Unnamed children of an open cluster show their short UUID.
    expect(await node('4e9a9ff9')).toBeInTheDocument();
    expect(await node('tarsis_4-1006')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close · vehicle' }));
    expect(onSearchChange).toHaveBeenLastCalledWith({ open: ['spawnbuilding'], pages: {} });

    fireEvent.click(await node('miningrock'));
    await userEvent.click(await screen.findByRole('button', { name: 'Close all groups' }));
    expect(onSearchChange).toHaveBeenLastCalledWith({ open: [], pages: {} });
  });

  it('inspects on click and re-centres on double-click', async () => {
    useInProcessBff();
    const { onSearchChange, onRecenter } = renderOrbit(ids.vehicle);

    fireEvent.click(await node('SandBox'));
    await waitFor(() =>
      expect(onSearchChange).toHaveBeenLastCalledWith({
        open: [],
        pages: {},
        selected: ids.planet,
      }),
    );

    const sandbox = await node('SandBox');
    fireEvent.click(sandbox);
    fireEvent.click(sandbox);
    expect(onRecenter).toHaveBeenCalledWith(ids.planet, ids.planet);
  });

  it('centres the graph from the inspector', async () => {
    useInProcessBff();
    const { onRecenter } = renderOrbit(ids.vehicle, { selected: ids.player });

    await userEvent.click(await screen.findByRole('button', { name: 'Centre graph' }));

    expect(onRecenter).toHaveBeenCalledWith(ids.player, ids.player);
  });
});
