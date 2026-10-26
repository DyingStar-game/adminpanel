import { describe, expect, it } from 'vitest';
import { createMissionDataset, createPois, missionIds, poiIds } from '@dyingstar-admin/testing';
import { objectiveView } from './objectiveSchematics';
import { formatDistance, missionPlaces, placeFacts, surfaceDistance } from './places';

const pois = createPois();
const poi = (id: string) => {
  const found = pois.find((p) => p.id === id);
  if (!found) throw new Error('fixture');
  return found;
};

describe('places (ADR 0026)', () => {
  it("reads a POI's body from its scene, and its latitude, longitude and altitude", () => {
    const facts = placeFacts(poi(poiIds.foundryBay));
    // `tarsis_3/new-haven` stands on Tarsis III.
    expect(facts).toMatchObject({ model: 'tarsis_3', body: { designation: 'Tarsis III' } });
    expect(facts.latLon?.lat).toBeCloseTo(22.6, 3);
    expect(facts.latLon?.lon).toBeCloseTo(130.7, 3);
    expect(facts.altitude).toBeCloseTo(4000, -1);
  });

  it('places a POI in open space on no body', () => {
    expect(placeFacts(poi(poiIds.relayStation))).toEqual({
      model: null,
      body: null,
      latLon: null,
      altitude: null,
    });
  });

  it('measures along the surface between two places of one body only', () => {
    const d = surfaceDistance(poi(poiIds.depot), poi(poiIds.drillSite));
    // 1.1° of latitude and 1.5° of longitude apart on 6,356 km: about 190 km.
    expect(d).toBeGreaterThan(150_000);
    expect(d).toBeLessThan(230_000);
    expect(surfaceDistance(poi(poiIds.depot), poi(poiIds.relayStation))).toBeNull();
    expect(formatDistance(186_400, 'en')).toBe('186.4 km');
    expect(formatDistance(40, 'fr')).toBe('40 m');
  });

  it("lays out a mission's places per body, true to scale, with its routes (ADR 0027)", () => {
    const byId = Object.fromEntries([
      ...pois.map((p) => [p.id, p] as const),
      [poiIds.missing, null] as const,
    ]);
    const objectives = createMissionDataset().objectives.filter((o) =>
      [missionIds.transport, missionIds.delivery, missionIds.grouped].includes(
        o.missionId as never,
      ),
    );
    const { bodies, undrawn } = missionPlaces(
      objectives.map((o) => ({ objective: o, view: objectiveView(o, byId) })),
    );

    expect(bodies.map((b) => [b.model, b.places.map((p) => p.poi.name)])).toEqual([
      ['tarsis_3', ['Foundry loading bay', 'Vance depot', 'Drill site 7']],
    ]);
    const [body] = bodies;
    const [route] = body?.routes ?? [];
    expect(route?.loaded).toBe(true);
    // Projected metres keep the distance along the surface, near the places.
    const [dn, de] = [
      (route?.to[0] ?? 0) - (route?.from[0] ?? 0),
      (route?.to[1] ?? 0) - (route?.from[1] ?? 0),
    ];
    expect(Math.hypot(dn, de) / (route?.distance ?? 1)).toBeCloseTo(1, 2);
    // The relay station is in orbit, the foreman's office unknown, used twice: listed once.
    expect(undrawn.map((p) => [p.poiId, p.uses.length])).toEqual([
      [poiIds.missing, 1],
      [poiIds.relayStation, 2],
    ]);
  });
});
