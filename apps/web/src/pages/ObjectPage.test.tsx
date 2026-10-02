import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import { useItemActions } from '@/stores/itemActions';
import { ObjectPage } from './ObjectPage';

const renderPage = (uuid: string) => {
  const onNavigate = vi.fn();
  const onOpenInExplorer = vi.fn();
  renderWithProviders(
    <ObjectPage
      uuid={uuid}
      onNavigate={onNavigate}
      onOpenInExplorer={onOpenInExplorer}
      onOpenOrbit={vi.fn()}
    />,
  );
  return { onNavigate, onOpenInExplorer };
};
const section = (name: string) => screen.getByRole('region', { name });

describe('ObjectPage', () => {
  it('shows a vehicle with its headline, labelled relations and children', async () => {
    useInProcessBff();
    const { onNavigate } = renderPage(ids.vehicle);

    expect(
      await screen.findByRole('heading', { level: 1, name: /vehicle 4e9a9ff9/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('limiter_on / limiter_kmh')).toBeInTheDocument();
    const relations = section('Relations');
    expect(await within(relations).findByText('components.Slot_FL')).toBeInTheDocument();
    expect(within(relations).getAllByText('component')).toHaveLength(3);
    expect(within(relations).getByText('pilot')).toBeInTheDocument();
    expect(await within(relations).findByText(/missing item/)).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /vehicle_component/ })).toBeInTheDocument();

    const [pilot] = await within(relations).findAllByRole('button', { name: /ddurieux/ });
    await userEvent.click(pilot as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith(ids.player);
  });

  it('draws the truck schematic bound to the data', async () => {
    useInProcessBff();
    const { onNavigate } = renderPage(ids.vehicle);

    const schematic = await screen.findByRole('region', { name: 'Schematic' });
    const driver = await within(schematic).findByRole('link', { name: 'Driver · ddurieux' });
    expect(within(schematic).getByLabelText('Passenger · empty')).toBeInTheDocument();
    // Compartments show the installed component model, a broken reference or an empty bay.
    expect(await within(schematic).findByRole('link', { name: 'FL · wheel' })).toBeInTheDocument();
    expect(await within(schematic).findByLabelText('RL · missing item')).toBeInTheDocument();
    expect(within(schematic).getByLabelText('RR · empty')).toBeInTheDocument();
    expect(within(schematic).getByText('28.7 km/h')).toBeInTheDocument();

    await userEvent.click(driver);
    expect(onNavigate).toHaveBeenCalledWith(ids.player);
  });

  it('shows no schematic for a model without one', async () => {
    useInProcessBff();
    renderPage(ids.planet);

    await screen.findByRole('heading', { level: 1, name: 'SandBox' });
    expect(screen.queryByRole('region', { name: 'Schematic' })).not.toBeInTheDocument();
  });

  it('labels a moon and pairs its orbital samples', async () => {
    useInProcessBff();
    renderPage(ids.moon);

    expect(await screen.findByRole('heading', { level: 1, name: 'P3_M2' })).toBeInTheDocument();
    expect(await screen.findByText('moon')).toBeInTheDocument();
    expect(screen.getAllByText('1 sample').length).toBeGreaterThan(0);
    expect(screen.getByTitle('rotation w, x, y, z')).toHaveTextContent('1, 0, 0, 0');
    // `rotations` is shown with the samples, not as its own row.
    expect(within(section('Properties')).queryByText('rotations')).not.toBeInTheDocument();
  });

  it('lists the planets of a single-star system as implicit bodies of the star', async () => {
    useInProcessBff();
    renderPage(ids.star);

    expect(await screen.findByRole('tab', { name: /planet.*implicit/ })).toBeInTheDocument();
    expect(await screen.findByText(/Single star system/)).toBeInTheDocument();
    expect(await screen.findByText('SandBox')).toBeInTheDocument();
  });

  it('shows player angles in degrees', async () => {
    useInProcessBff();
    renderPage(ids.player);

    expect(await screen.findByText('0.38 rad · 21.772°')).toBeInTheDocument();
  });

  it('offers to spawn an item next to a player, in its parent', async () => {
    useInProcessBff();
    renderPage(ids.player);

    await userEvent.click(await screen.findByRole('button', { name: 'Spawn next to it' }));

    const action = useItemActions.getState().action;
    expect(action).toMatchObject({ kind: 'create', parentId: ids.spawnbuilding });
    expect(action?.kind === 'create' && action.spawn?.nearLabel).toBe('ddurieux');
  });

  it('opens the duplication from the object page', async () => {
    useInProcessBff();
    renderPage(ids.vehicle);

    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    expect(useItemActions.getState().action).toEqual({ kind: 'duplicate', uuid: ids.vehicle });
  });

  it('opens the item in the explorer and reports unknown items', async () => {
    useInProcessBff();
    const { onOpenInExplorer } = renderPage(ids.rock);

    await userEvent.click(await screen.findByRole('button', { name: 'Show in explorer' }));
    expect(onOpenInExplorer).toHaveBeenCalledWith(
      expect.objectContaining({ object_uuid: ids.rock }),
    );
  });

  it('reports an unknown item', async () => {
    useInProcessBff();
    renderPage('00000000-0000-0000-0000-000000000000');

    expect(await screen.findByText(/not found/)).toBeInTheDocument();
  });
});
