import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import type { OrbitSearch } from '@/lib/orbitSearch';
import { OrbitPage } from './OrbitPage';

function renderOrbit(uuid: string, initial: Partial<OrbitSearch> = {}) {
  const onSearchChange = vi.fn();
  const onRecenter = vi.fn();
  function Harness() {
    const [search, setSearch] = useState<OrbitSearch>({ page: 1, ...initial });
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
  });

  it('opens a cluster and fans its children out', async () => {
    useInProcessBff();
    const { onSearchChange } = renderOrbit(ids.vehicle);

    fireEvent.click(await node('vehicle_component'));

    expect(onSearchChange).toHaveBeenLastCalledWith({ page: 1, open: 'vehicle_component' });
    expect(await node('Slot_FL')).toBeInTheDocument();
    expect(await screen.findByText('1–2 of 2')).toBeInTheDocument();
  });

  it('inspects on click and re-centres on double-click', async () => {
    useInProcessBff();
    const { onSearchChange, onRecenter } = renderOrbit(ids.vehicle);

    fireEvent.click(await node('SandBox'));
    await waitFor(() =>
      expect(onSearchChange).toHaveBeenLastCalledWith({ page: 1, selected: ids.planet }),
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
