import { describe, expect, it } from 'vitest';
import { createPois, poiIds } from '@dyingstar-admin/testing';
import { formatDistance, placeFacts, surfaceDistance } from './places';

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
});
