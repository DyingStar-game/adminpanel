import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import { Toaster } from '@/components/ui/sonner';
import { useItemActions } from '@/stores/itemActions';
import { usePreferences } from '@/stores/preferences';
import { spawnNextTo, type SpawnPreset } from '@/lib/spawn';
import { ItemActionsHost } from './ItemActionsHost';

function renderHost() {
  const onCreated = vi.fn();
  const onDeleted = vi.fn();
  renderWithProviders(
    <>
      <ItemActionsHost onCreated={onCreated} onDeleted={onDeleted} />
      <Toaster />
    </>,
  );
  return { onCreated, onDeleted };
}

const stored = (bff: ReturnType<typeof useInProcessBff>, uuid: string) => {
  const item = bff.persistence.items.get(uuid);
  if (!item) throw new Error(`missing ${uuid}`);
  return item;
};

describe('ItemActionsHost', () => {
  it('edits an item and only sends what changed', async () => {
    const bff = useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().edit(ids.vehicle));

    const speed = await screen.findByRole('textbox', { name: 'speed' });
    // The game saves a new position while the editor is open.
    stored(bff, ids.vehicle).object_data = {
      ...stored(bff, ids.vehicle).object_data,
      position: { x: 9, y: 9, z: 9 },
    };
    await userEvent.clear(speed);
    await userEvent.type(speed, '12.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(stored(bff, ids.vehicle).object_data).toMatchObject({
      speed: 12.5,
      // Not reverted: the user did not touch the position.
      position: { x: 9, y: 9, z: 9 },
    });
  });

  it('asks before overwriting a value the game changed meanwhile', async () => {
    const bff = useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().edit(ids.vehicle));

    const speed = await screen.findByRole('textbox', { name: 'speed' });
    stored(bff, ids.vehicle).object_data = { ...stored(bff, ids.vehicle).object_data, speed: 99 };
    await userEvent.clear(speed);
    await userEvent.type(speed, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'The game changed this item meanwhile',
    });
    expect(within(dialog).getByText(/speed/)).toBeInTheDocument();
    expect(stored(bff, ids.vehicle).object_data.speed).toBe(99);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Overwrite with my values' }));
    await vi.waitFor(() => expect(stored(bff, ids.vehicle).object_data.speed).toBe(0));
  });

  it('validates values before sending', async () => {
    useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().edit(ids.vehicle));

    const speed = await screen.findByRole('textbox', { name: 'speed' });
    await userEvent.clear(speed);
    await userEvent.type(speed, 'fast');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Not a number.')).toBeInTheDocument();
  });

  it('creates an item in the given level', async () => {
    const bff = useInProcessBff();
    const { onCreated } = renderHost();
    act(() => useItemActions.getState().create({ parentId: ids.planet, objectType: 'vehicle' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    const created = onCreated.mock.calls[0]?.[0];
    expect(stored(bff, created.object_uuid)).toMatchObject({
      object_type: 'vehicle',
      object_data: { parent_id: ids.planet, position: { x: 0, y: 0, z: 0 } },
    });
  });

  it('spawns next to a reference, recomputed from the type and the offsets', async () => {
    const bff = useInProcessBff();
    const { onCreated } = renderHost();
    const player = stored(bff, ids.player);
    act(() =>
      useItemActions.getState().create({
        parentId: ids.spawnbuilding,
        objectType: 'vehicle',
        spawn: {
          reference: player,
          nearLabel: 'ddurieux',
          preset: spawnNextTo(player, 3, 0.5) as SpawnPreset,
        },
      }),
    );

    expect(await screen.findByText(/Spawned next to ddurieux/)).toBeInTheDocument();
    // A vehicle keeps 8 m and 1 m from the reference by default.
    expect(await screen.findByDisplayValue('8')).toBeInTheDocument();
    const distance = screen.getByRole('textbox', { name: 'Distance (m)' });
    await userEvent.clear(distance);
    await userEvent.type(distance, '12');
    await userEvent.type(screen.getByRole('combobox', { name: 'scenename' }), 'truck');
    await userEvent.click(await screen.findByRole('option', { name: /truck\.tscn/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    const expected = spawnNextTo(player, 12, 1) as SpawnPreset;
    expect(stored(bff, onCreated.mock.calls[0]?.[0].object_uuid).object_data).toMatchObject({
      parent_id: ids.spawnbuilding,
      scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
      position: expected.position,
      rotation: expected.rotation,
    });
  });

  it('fills the type from a picked scene', async () => {
    const bff = useInProcessBff();
    const { onCreated } = renderHost();
    act(() => useItemActions.getState().create({ parentId: ids.planet }));

    await userEvent.type(await screen.findByRole('combobox', { name: 'scenename' }), 'truck');
    await userEvent.click(await screen.findByRole('option', { name: /truck\.tscn/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(stored(bff, onCreated.mock.calls[0]?.[0].object_uuid).object_type).toBe('vehicle');
  });

  it('refuses a UUID that already exists', async () => {
    useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().create({ parentId: ids.planet, objectType: 'vehicle' }));

    const uuid = await screen.findByRole('textbox', { name: 'object_uuid' });
    await userEvent.clear(uuid);
    await userEvent.type(uuid, ids.vehicle);
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('An item already uses this UUID.')).toBeInTheDocument();
  });

  it('deletes after warning about orphans and the game not being notified', async () => {
    const bff = useInProcessBff();
    const { onDeleted } = renderHost();
    act(() => useItemActions.getState().remove(ids.vehicle));

    const dialog = await screen.findByRole('alertdialog');
    expect(await within(dialog).findByText(/2 children are not deleted/)).toBeInTheDocument();
    expect(within(dialog).getByText(/not notified/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(bff.persistence.items.has(ids.vehicle)).toBe(false);
  });

  it('duplicates an item and its children next to a picked player', async () => {
    const bff = useInProcessBff();
    const { onCreated } = renderHost();
    const before = bff.persistence.items.size;
    act(() => useItemActions.getState().duplicate(ids.vehicle));

    const dialog = await screen.findByRole('dialog', { name: /Duplicate vehicle 4e9a9ff9/ });
    await userEvent.click(await within(dialog).findByRole('option', { name: /ddurieux/ }));
    const placement = within(dialog).getByRole('region', { name: 'Placement of the copy' });
    expect(within(placement).getByText(/next to ddurieux/)).toBeInTheDocument();
    expect(within(placement).getByLabelText('parent_id')).toHaveValue(ids.spawnbuilding);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Duplicate' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bff.persistence.items.size).toBe(before + 3);
    const root = stored(bff, onCreated.mock.calls[0]?.[0].object_uuid);
    expect(root.object_data).toMatchObject({ parent_id: ids.spawnbuilding });
    expect(root.object_data).not.toHaveProperty('pilot_uuid');
    // The player is remembered as "me".
    expect(usePreferences.getState().me).toBe(ids.player);
  });

  it('places the copy next to any item given by UUID', async () => {
    useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().duplicate(ids.vehicle));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'or any item UUID' }),
      ids.spawnbuilding,
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use' }));

    expect(await within(dialog).findByText(/next to tarsis_4-1006/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('parent_id')).toHaveValue(ids.planet);
  });

  it('blocks an invalid placement', async () => {
    useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().duplicate(ids.vehicle));

    const dialog = await screen.findByRole('dialog');
    const x = await within(dialog).findByRole('textbox', { name: 'position x' });
    await userEvent.clear(x);
    await userEvent.type(x, 'abc');

    expect(within(dialog).getByRole('button', { name: 'Duplicate' })).toBeDisabled();
  });

  it('keeps 8 m between vehicles by default, and recomputes on another distance', async () => {
    const bff = useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().duplicate(ids.vehicle));
    const original = stored(bff, ids.vehicle);

    const dialog = await screen.findByRole('dialog');
    const shown = () =>
      Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [
          axis,
          Number(
            within(dialog)
              .getByRole('textbox', { name: `position ${axis}` })
              .getAttribute('value'),
          ),
        ]),
      );
    // The vehicle's own gap applies once the original is loaded.
    const distance = await within(dialog).findByDisplayValue('8');
    await vi.waitFor(() => expect(shown()).toEqual(spawnNextTo(original, 8, 1)?.position));

    await userEvent.clear(distance);
    await userEvent.type(distance, '20');

    await vi.waitFor(() => expect(shown()).toEqual(spawnNextTo(original, 20, 1)?.position));
  });

  it('raises the copy above the reference (radially on a planet), by 1 m for a vehicle by default', async () => {
    const bff = useInProcessBff();
    renderHost();
    act(() => useItemActions.getState().duplicate(ids.vehicle));
    // The vehicle stands on the planet: its position is relative to the planet centre.
    const radius = ({ x, y, z }: { x: number; y: number; z: number }) => Math.hypot(x, y, z);
    const originalRadius = radius(
      stored(bff, ids.vehicle).object_data.position as { x: number; y: number; z: number },
    );

    const dialog = await screen.findByRole('dialog');
    const height = await within(dialog).findByRole('textbox', { name: 'Height (m)' });
    await within(dialog).findByDisplayValue('8');
    expect(height).toHaveValue('1');
    const altitude = () => {
      const [x, y, z] = ['x', 'y', 'z'].map((axis) =>
        Number(
          within(dialog)
            .getByRole('textbox', { name: `position ${axis}` })
            .getAttribute('value'),
        ),
      ) as [number, number, number];
      return radius({ x, y, z }) - originalRadius;
    };
    expect(altitude()).toBeCloseTo(1, 2);

    await userEvent.clear(height);
    await userEvent.type(height, '3');

    expect(altitude()).toBeCloseTo(3, 2);
  });
});
