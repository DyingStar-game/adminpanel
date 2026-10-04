import { sceneModel } from './schematics';

/**
 * Facts on the celestial bodies, from the project wiki (GDD › worldbuilding › géographie ›
 * système Tarsis, read on 2026-10-04): persistence holds no radius, gravity or day length.
 * Matched on the body's scene: `tarsis_3.tscn` is Tarsis III (page `tarsis_III/`), and
 * `tarsis_3_1.tscn` its first moon, described on the planet's page. Data only: a new body is
 * one entry; values follow the wiki, not the game.
 */
export const WIKI_BASE =
  'https://developer.dyingstar-game.com/docs/project/GDD/worldbuilding/5_01_geographie/system_tarsis/';

export interface BodyFacts {
  /** Wiki designation, e.g. `Tarsis III`, `Tarsis III.M1`. */
  designation: string;
  /** Name given by the wiki, when there is one. */
  name?: string;
  /** Wiki page, relative to `WIKI_BASE`. */
  page: string;
  radiusKm: number;
  /** Surface gravity, m/s². */
  gravity?: number;
  /** Sidereal day, hours. */
  dayHours?: number;
  /** Orbital period around its parent, days. */
  orbitDays?: number;
  /** Surface temperature of a star, K. */
  temperatureK?: number;
}

const SOLAR_RADIUS_KM = 695_700;

const BODIES: Record<string, BodyFacts> = {
  star: {
    designation: 'Tarsis α',
    page: 'tarsis_alpha/',
    radiusKm: Math.round(0.821 * SOLAR_RADIUS_KM),
    temperatureK: 4831,
  },
  tarsis_1: {
    designation: 'Tarsis I',
    page: 'tarsis_I/',
    radiusKm: 4679,
    gravity: 5.803525677,
    dayHours: 126.421509308361,
    orbitDays: 5.267563,
  },
  tarsis_2: {
    designation: 'Tarsis II',
    page: 'tarsis_II/',
    radiusKm: 3123,
    gravity: 2.914267833,
    dayHours: 57.7596236145087,
    orbitDays: 24.0382857053076,
  },
  tarsis_3: {
    designation: 'Tarsis III',
    name: 'Sandbox',
    page: 'tarsis_III/',
    radiusKm: 6356,
    gravity: 7.774966156,
    dayHours: 25,
    orbitDays: 219.77,
  },
  // The wiki lists them under "Tarsis IV.M1 / M2" on the Tarsis III page; persistence has them
  // under SandBox (P3_M1, P3_M2): taken as Tarsis III's moons.
  tarsis_3_1: {
    designation: 'Tarsis III.M1',
    name: 'Korax',
    page: 'tarsis_III/',
    radiusKm: 1500,
    gravity: 1.258166787,
    orbitDays: 4.734,
  },
  tarsis_3_2: {
    designation: 'Tarsis III.M2',
    name: 'Xarok',
    page: 'tarsis_III/',
    radiusKm: 700,
    gravity: 0.4888982231,
    orbitDays: 23.49,
  },
  tarsis_4: {
    designation: 'Tarsis IV',
    name: 'Gaea',
    page: 'tarsis_IV/',
    radiusKm: 5875,
    gravity: 9.042449396,
    dayHours: 24,
    orbitDays: 171.05,
  },
  tarsis_4_1: {
    designation: 'Tarsis IV.M1',
    page: 'tarsis_IV/',
    radiusKm: 1146.42,
    gravity: 1.759059592,
    orbitDays: 14.8,
  },
  tarsis_5: {
    designation: 'Tarsis V',
    page: 'tarsis_V/',
    radiusKm: 69292,
    gravity: 11.11,
    dayHours: 11.74,
    orbitDays: 489.95,
  },
  tarsis_5_1: {
    designation: 'Tarsis V.M1',
    page: 'tarsis_V/',
    radiusKm: 2552,
    gravity: 2.33,
    orbitDays: 4.1,
  },
  tarsis_5_2: {
    designation: 'Tarsis V.M2',
    page: 'tarsis_V/',
    radiusKm: 5900,
    gravity: 3.14,
    orbitDays: 7.7,
  },
  tarsis_5_3: {
    designation: 'Tarsis V.M3',
    page: 'tarsis_V/',
    radiusKm: 3632,
    gravity: 3.57,
    orbitDays: 20.2,
  },
  tarsis_5_4: {
    designation: 'Tarsis V.M4',
    page: 'tarsis_V/',
    radiusKm: 7757,
    gravity: 2.54,
    orbitDays: 33.5,
  },
  tarsis_5_5: {
    designation: 'Tarsis V.M5',
    page: 'tarsis_V/',
    radiusKm: 809,
    gravity: 0.61,
    orbitDays: 57.1,
  },
  tarsis_5_6: {
    designation: 'Tarsis V.M6',
    page: 'tarsis_V/',
    radiusKm: 10023,
    gravity: 5.32,
    orbitDays: 62.8,
  },
  tarsis_6: {
    designation: 'Tarsis VI',
    page: 'tarsis_VI/',
    radiusKm: 26806,
    gravity: 21.32945451,
    dayHours: 24.4611834990364,
    orbitDays: 6896.576759,
  },
  tarsis_6_1: {
    designation: 'Tarsis VI.M1',
    page: 'tarsis_VI/',
    radiusKm: 5775,
    gravity: 3.07163221,
    orbitDays: 138.7,
  },
  tarsis_6_2: {
    designation: 'Tarsis VI.M2',
    page: 'tarsis_VI/',
    radiusKm: 3568,
    gravity: 3.475468481,
    orbitDays: 548.8,
  },
  tarsis_7: {
    designation: 'Tarsis VII',
    page: 'tarsis_VII/',
    radiusKm: 3515,
    gravity: 3.565613077,
    dayHours: 57.7596236145087,
    orbitDays: 9640.0544043535,
  },
  tarsis_8: {
    designation: 'Tarsis VIII',
    page: 'tarsis_VIII/',
    radiusKm: 3467,
    gravity: 3.484529789,
    dayHours: 76.8974824125262,
    orbitDays: 27496.225578,
  },
};

/** Wiki facts of a body, from its scene, or null for an unknown one. */
export function bodyFacts(scenename: unknown): BodyFacts | null {
  const model = sceneModel(scenename);
  return model ? (BODIES[model] ?? null) : null;
}

/** Full URL of a body's wiki page. */
export const wikiUrl = (facts: BodyFacts) => `${WIKI_BASE}${facts.page}`;

export type BodyFactKey = 'radius' | 'gravity' | 'day' | 'orbit' | 'temperature';

/** The facts a body has, in display order, with their unit. */
export function bodyFactList(
  facts: BodyFacts,
): { key: BodyFactKey; value: number; unit: string }[] {
  const list: { key: BodyFactKey; value: number | undefined; unit: string }[] = [
    { key: 'radius', value: facts.radiusKm, unit: 'km' },
    { key: 'gravity', value: facts.gravity, unit: 'm/s²' },
    { key: 'day', value: facts.dayHours, unit: 'h' },
    { key: 'orbit', value: facts.orbitDays, unit: 'd' },
    { key: 'temperature', value: facts.temperatureK, unit: 'K' },
  ];
  return list.filter(
    (f): f is { key: BodyFactKey; value: number; unit: string } => f.value !== undefined,
  );
}
