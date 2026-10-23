import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMissionDataset, createPois, missionIds, poiIds } from '@dyingstar-admin/testing';
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
    const { onSelect } = renderMap();

    expect(screen.getByRole('region', { name: "Map of the mission's places" })).toBeInTheDocument();
    expect(screen.getByText(/^On Tarsis III — Sandbox, around the places/)).toBeInTheDocument();
    const depot = screen.getByTitle('Vance depot · step 0 Bring the parts to the drill site: Load');
    expect(
      screen.getByTitle('Drill site 7 · step 0 Bring the parts to the drill site: Deliver'),
    ).toBeInTheDocument();
    await userEvent.click(depot);
    expect(onSelect).toHaveBeenCalledWith(
      objectives.find((o) => o.title.startsWith('Bring the parts'))?.id,
    );
  });

  it('lists the places it does not draw: in open space, unknown to inventory', () => {
    renderMap({ objectives: of(missionIds.delivery, missionIds.grouped) });

    expect(screen.getByText('Not on the map')).toBeInTheDocument();
    expect(screen.getByText(/^Relay station · Open space/)).toBeInTheDocument();
    expect(screen.getByText(/^Unknown place · 0b1a7e1e/)).toBeInTheDocument();
    expect(screen.getByTitle(/^Foundry loading bay/)).toBeInTheDocument();
  });

  it('says the places were not read without inventory, and draws nothing without places', () => {
    renderMap({ places: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('were not read from the inventory');

    renderMap({ objectives: of(missionIds.cancelled) });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
