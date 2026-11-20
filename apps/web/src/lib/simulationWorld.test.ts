import { describe, expect, it } from 'vitest';
import {
  formatKm,
  parseWorldFile,
  RouteFormSchema,
  routeToWrite,
  SourceFormSchema,
  sourceFormValues,
  sourceToWrite,
} from './simulationWorld';

const a = 'a7e50000-0000-4000-8000-000000000001';
const b = 'a7e50000-0000-4000-8000-000000000002';

describe('simulation world (ADR 0025 › The world)', () => {
  it('writes a route in metres, between two different villages', () => {
    const route = { fromVillageId: a, toVillageId: b, distanceKm: 17.6 };
    expect(RouteFormSchema.safeParse(route).success).toBe(true);
    expect(routeToWrite(route)).toEqual({ fromVillageId: a, toVillageId: b, distanceM: 17_600 });
    const messages = (value: unknown) =>
      RouteFormSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? [];
    expect(messages({ ...route, toVillageId: a })).toEqual(['sameVillage']);
    expect(messages({ ...route, distanceKm: 0 })).toEqual(['positive']);
    expect(messages({ ...route, distanceKm: Number.NaN })).toEqual(['number']);
    expect(messages({ ...route, fromVillageId: '' })).toEqual(['required']);
  });

  it('writes a mineral source whole, an empty "left to mine" being a source without an end', () => {
    const source = {
      id: a,
      villageId: a,
      resourceId: b,
      remainingUnits: 1_999_820,
      maxUnitsPerMission: 60,
    };
    expect(sourceFormValues(source)).toEqual({ maxUnitsPerMission: 60, remainingUnits: 1_999_820 });
    expect(
      sourceToWrite(source, { maxUnitsPerMission: 10_000, remainingUnits: 1_999_820 }),
    ).toEqual({
      villageId: a,
      resourceId: b,
      maxUnitsPerMission: 10_000,
      remainingUnits: 1_999_820,
    });
    expect(
      sourceToWrite(source, { maxUnitsPerMission: 240, remainingUnits: Number.NaN }),
    ).toMatchObject({
      remainingUnits: null,
    });
    const ok = (value: unknown) => SourceFormSchema.safeParse(value).success;
    expect(ok({ maxUnitsPerMission: 240, remainingUnits: Number.NaN })).toBe(true);
    expect(ok({ maxUnitsPerMission: 0, remainingUnits: 10 })).toBe(false);
    expect(ok({ maxUnitsPerMission: 2.5, remainingUnits: 10 })).toBe(false);
    expect(ok({ maxUnitsPerMission: 240, remainingUnits: -1 })).toBe(false);
  });

  it('reads kilometres, a decimal under ten', () => {
    expect(formatKm(6_781, 'en')).toBe('6.8');
    expect(formatKm(232_900, 'en')).toBe('233');
  });

  it('reads a world file, and says why a text is none', () => {
    const world = {
      economyScale: 25,
      federation: { code: 'ARES', name: 'ARES', planetInternalName: 'tarsis_3' },
    };
    const read = parseWorldFile(JSON.stringify(world));
    expect(read).toEqual({ ok: true, file: world });
    expect(parseWorldFile('{ not json')).toEqual({ ok: false, issue: 'notJson' });
    expect(parseWorldFile('{"villages": {}}')).toEqual({ ok: false, issue: 'notWorld' });
    expect(parseWorldFile('{"federation": {"code": "ARES"}}')).toEqual({
      ok: false,
      issue: 'notWorld',
    });
  });
});
