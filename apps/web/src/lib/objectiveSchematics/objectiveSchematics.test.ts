import { describe, expect, it } from 'vitest';
import { createMissionDataset, createPois, missionIds, poiIds } from '@dyingstar-admin/testing';
import { i18n } from '@/i18n';
import { OBJECTIVE_SCHEMATICS, objectiveSchematicFor, objectiveView } from '.';
import { objectiveInstruction } from './instruction';

const { objectives } = createMissionDataset();
const places = Object.fromEntries([
  ...createPois().map((p) => [p.id, p] as const),
  [poiIds.missing, null] as const,
]);
const of = (missionId: string, n = 0) => {
  const found = objectives.filter((o) => o.missionId === missionId)[n];
  if (!found) throw new Error('fixture');
  return found;
};
const t = i18n.getFixedT('en');
const instruction = (missionId: string, n = 0, read = true) => {
  const o = of(missionId, n);
  const view = objectiveView(o, read ? places : undefined);
  if (!view) throw new Error('no schematic');
  return objectiveInstruction(t, o, view, { language: 'en', players: {} });
};

describe('objective schematics (ADR 0026)', () => {
  it("declares each kind of mission's registry once", () => {
    const kinds = OBJECTIVE_SCHEMATICS.map((s) => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.sort()).toEqual(
      [
        'deliver_material',
        'manual',
        'owns_items',
        'transport',
        'transport_passenger',
        'visit',
      ].sort(),
    );
    expect(objectiveSchematicFor('escort_npc')).toBeNull();
  });

  it('only uses params paths a sample objective of its kind has', () => {
    for (const schematic of OBJECTIVE_SCHEMATICS) {
      const sample = objectives.find((o) => o.type === schematic.kind);
      if (!sample) throw new Error(`no fixture for ${schematic.kind}`);
      const paths = [
        ...schematic.places.map((p) => `${p.path}`),
        ...(schematic.good ? [schematic.good.path] : []),
        ...(schematic.player ? [schematic.player.path] : []),
      ];
      for (const path of paths)
        expect(sample.params, `${schematic.kind}.${path}`).toHaveProperty(path);
    }
  });

  it("reads a transport's two places, its goods and whether they are loaded", () => {
    const view = objectiveView(of(missionIds.transport), places);
    expect(view?.places.map((p) => [p.role, p.poi?.name])).toEqual([
      ['pickup', 'Vance depot'],
      ['dropoff', 'Drill site 7'],
    ]);
    expect(view).toMatchObject({ good: 'drill_parts', loaded: true, pooled: false });
  });

  it('tells what to do, the places named or by their id', () => {
    expect(instruction(missionIds.transport)).toBe(
      'Load 4 crates of drill_parts at Vance depot, then deliver the load to Drill site 7.',
    );
    expect(instruction(missionIds.transport, 0, false)).toBe(
      'Load 4 crates of drill_parts at POI 0b1a7e1e, then deliver the load to POI 0b1a7e1e.',
    );
    expect(instruction(missionIds.delivery, 1)).toBe(
      'Reach an unknown place (0b1a7e1e): the first visit counts.',
    );
    expect(instruction(missionIds.transport, 1)).toBe(
      'Own 1 of drill_bit in the inventory: selling or using some lowers the progress.',
    );
    expect(instruction(missionIds.cancelled)).toBe("Done when the mission's issuer confirms it.");
  });
});
