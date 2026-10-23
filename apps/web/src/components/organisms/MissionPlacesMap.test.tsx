import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createDataset,
  createMissionDataset,
  createPois,
  missionIds,
  poiIds,
} from '@dyingstar-admin/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionPlacesMap } from './MissionPlacesMap';

const { objectives } = createMissionDataset();
const of = (...missions: string[]) => objectives.filter((o) => missions.includes(o.missionId));
const places = Object.fromEntries([
  ...createPois().map((p) => [p.id, p] as const),
  [poiIds.missing, null] as const,
]);

const renderMap = (props: Partial<Parameters<typeof MissionPlacesMap>[0]> = {}) => {
  const onSelect = vi.fn();
  renderWithProviders(
    <div style={{ width: 1000, height: 600 }}>
      <MissionPlacesMap
        objectives={of(missionIds.transport)}
        places={places}
        selected={undefined}
        onSelect={onSelect}
        {...props}
      />
    </div>,
  );
  return { onSelect };
};

describe('MissionPlacesMap (ADR 0027)', () => {
  it("draws a transport's two places on their body, and chooses the objective on a click", async () => {
    useInProcessBff();
    const { onSelect } = renderMap();

    expect(screen.getByRole('region', { name: "Map of the mission's places" })).toBeInTheDocument();
    expect(screen.getByText(/^On Tarsis III — Sandbox, around the places/)).toBeInTheDocument();
    const depot = screen.getByTitle('Vance depot · step 1 Bring the parts to the drill site: Load');
    expect(
      screen.getByTitle('Drill site 7 · step 1 Bring the parts to the drill site: Deliver'),
    ).toBeInTheDocument();
    await userEvent.click(depot);
    expect(onSelect).toHaveBeenCalledWith(
      objectives.find((o) => o.title.startsWith('Bring the parts'))?.id,
    );
  });

  it('lists the places it does not draw: in open space, unknown to inventory', () => {
    useInProcessBff();
    renderMap({ objectives: of(missionIds.delivery, missionIds.grouped) });

    expect(screen.getByText('Not on the map')).toBeInTheDocument();
    expect(screen.getByText(/^Relay station · Open space/)).toBeInTheDocument();
    expect(screen.getByText(/^Unknown place · 0b1a7e1e/)).toBeInTheDocument();
    expect(screen.getByTitle(/^Foundry loading bay/)).toBeInTheDocument();
  });

  it('says the places were not read without inventory, and draws nothing without places', () => {
    useInProcessBff();
    renderMap({ places: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('were not read from the inventory');

    renderMap({ objectives: of(missionIds.cancelled) });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it("draws the planet's fixed landmarks around the places, shown or hidden by type", async () => {
    // Tarsis III in persistence, with a village and a vehicle beside the foundry's POI.
    const tarsis3 = '7a751530-0000-4000-8000-000000000003';
    const child = (uuid: string, objectType: string, name: string, dx: number): Item => ({
      object_type: objectType,
      object_uuid: uuid,
      object_data: {
        name,
        parent_id: tarsis3,
        scenename: `scenes/_universe/${objectType}.tscn`,
        position: { x: -3_828_872.1 + dx, y: 2_444_118.3, z: 4_451_474.4 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    });
    useInProcessBff([
      ...createDataset(),
      {
        object_type: 'planet',
        object_uuid: tarsis3,
        object_data: {
          name: 'Tarsis III',
          parent_id: '',
          scenename: 'scenes/systems/tarsis/tarsis_3.tscn',
          positions: [{ x: 1, y: 2, z: 3 }],
          rotations: [{ w: 1, x: 0, y: 0, z: 0 }],
        },
      },
      child('7a751530-0000-4000-8000-0000000000a1', 'poi_village', 'M0063', 300),
      child('7a751530-0000-4000-8000-0000000000a2', 'vehicle', 'Hauler', 200),
    ]);
    renderWithProviders(
      <PermissionsContext.Provider value={['persistence.read', 'mission.read', 'inventory.read']}>
        <div style={{ width: 1000, height: 600 }}>
          <MissionPlacesMap
            objectives={of(missionIds.delivery)}
            places={places}
            selected={undefined}
            onSelect={vi.fn()}
          />
        </div>
      </PermissionsContext.Provider>,
    );

    expect(await screen.findByTitle('M0063 · poi_village')).toBeInTheDocument();
    expect(screen.getByText(/in its planet map's frame, among its landmarks/)).toBeInTheDocument();
    // Vehicles move: never drawn as landmarks.
    expect(screen.queryByTitle(/Hauler/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Show poi_village' }));
    await waitFor(() => expect(screen.queryByTitle('M0063 · poi_village')).not.toBeInTheDocument());
  });

  it('says landmarks need persistence without its right', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['mission.read', 'inventory.read']}>
        <MissionPlacesMap
          objectives={of(missionIds.delivery)}
          places={places}
          selected={undefined}
          onSelect={vi.fn()}
        />
      </PermissionsContext.Provider>,
    );
    expect(await screen.findByText(/landmarks need persistence:read/)).toBeInTheDocument();
  });
});
