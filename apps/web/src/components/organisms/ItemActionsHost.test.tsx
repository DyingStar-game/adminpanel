import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import { Toaster } from '@/components/ui/sonner';
import { useItemActions } from '@/stores/itemActions';
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

  it('spawns next to an entity with its parent, position, yaw and a known scene', async () => {
    const bff = useInProcessBff();
    const { onCreated } = renderHost();
    act(() =>
      useItemActions.getState().create({
        parentId: ids.spawnbuilding,
        objectType: 'vehicle',
        spawn: {
          nearLabel: 'ddurieux',
          preset: {
            parentId: ids.spawnbuilding,
            position: { x: 1, y: 0, z: 8 },
            rotation: { x: 0, y: 1.5, z: 0 },
          },
        },
      }),
    );

    expect(await screen.findByText(/Spawned next to ddurieux/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'truck.tscn' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    const created = onCreated.mock.calls[0]?.[0];
    expect(stored(bff, created.object_uuid).object_data).toMatchObject({
      parent_id: ids.spawnbuilding,
      scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
      position: { x: 1, y: 0, z: 8 },
      rotation: { x: 0, y: 1.5, z: 0 },
    });
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
});
