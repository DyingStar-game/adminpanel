/**
 * Prepares `make seed-simulation` (minikube): what `universesimulator` imports, and the
 * persistence objects it reads its villages from.
 *
 * - `docker/minikube/universesimulator/world-ares.json` is the world file the back team prepared
 *   (2026-10-23). It is written for a newer `universesimulator` than `develop`'s, whose importer
 *   refuses unknown keys (`src/import/mod.rs`, `deny_unknown_fields`, `develop` `0c14db4`): the
 *   copy leaves out what that importer does not know (listed in `UNKNOWN`), and its federation
 *   stands on the persistence planet the panel reads (`SANDBOX`). Drop a key from `UNKNOWN` once
 *   `develop` reads it (lot 2 plan, question 25).
 * - Minikube's persistence is empty: the planet, its `poi_village` and `cargo_depot` objects are
 *   read GET only from `PERSISTENCE_URL` (the test server), with their UUIDs, to be upserted into
 *   minikube's persistence by `docker/minikube/universesimulator/load-persistence.mjs`.
 *
 * Writes both into `docker/minikube/universesimulator/.build/` (not tracked).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** SandBox (Tarsis III) in the test server's persistence: the planet the panel's map draws. */
const SANDBOX = 'c0379c08-1d5b-4ca2-8876-230908141b68';
const DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docker/minikube/universesimulator',
);
const PERSISTENCE_URL = process.env.PERSISTENCE_URL;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Keys of the world file `develop`'s importer refuses, and what they would do. */
const UNKNOWN = {
  'federation.railSpeedKmh': 'train speed (no rail in develop)',
  'villages.hubs': 'the hub each village type delivers to',
  '<profile>.processes': 'factory and farm transformations',
  '<policy>.pushTo':
    'pushing a surplus to a hub or the spaceport (the whole policy: not a threshold)',
  'routes.links': 'routes by village type, rail included',
} as const;

/** `develop`'s `RoutesFile` defaults, as the service's own seed sets them. */
const ROUTES = { nearestNeighbours: 3, maxDistanceM: 60_000, extra: [] };

function worldForDevelop(world: Json) {
  const removed: Record<string, number> = {};
  const count = (key: keyof typeof UNKNOWN) => (removed[key] = (removed[key] ?? 0) + 1);
  const federation = world.federation as Json;
  if ('railSpeedKmh' in federation) {
    delete federation.railSpeedKmh;
    count('federation.railSpeedKmh');
  }
  federation.planetPoiUuid = SANDBOX;
  const villages = world.villages as Json;
  if ('hubs' in villages) {
    delete villages.hubs;
    count('villages.hubs');
  }
  const profiles = [
    villages.defaults,
    ...Object.values((villages.byType as Json | undefined) ?? {}),
    ...Object.values((villages.overrides as Json | undefined) ?? {}),
  ].filter(isObject);
  for (const profile of profiles) {
    if ('processes' in profile) {
      delete profile.processes;
      count('<profile>.processes');
    }
    // A `pushTo` policy sends a surplus away; without it, it would be a second threshold for a
    // resource the profile already has one for.
    if (Array.isArray(profile.policies)) {
      profile.policies = profile.policies.filter((policy) => {
        const push = isObject(policy) && 'pushTo' in policy;
        if (push) count('<policy>.pushTo');
        return !push;
      });
    }
  }
  if (isObject(world.routes) && 'links' in world.routes) {
    count('routes.links');
    world.routes = ROUTES;
  }
  return { world, removed };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${PERSISTENCE_URL}${path}`);
  if (!res.ok) throw new Error(`persistence answered ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/** The planet and the objects `universesimulator` imports its villages from, GET only. */
async function sandboxObjects() {
  const page = (type: string) =>
    get<{ items: Json[] }>(
      `/items?object_type=${type}&parent_id=${SANDBOX}&page=1&page_size=10000`,
    );
  const [planet, villages, depots] = await Promise.all([
    get<Json>(`/items/${SANDBOX}`),
    page('poi_village'),
    page('cargo_depot'),
  ]);
  return [planet, ...villages.items, ...depots.items];
}

async function main() {
  if (!PERSISTENCE_URL) throw new Error('PERSISTENCE_URL is unset: SandBox cannot be read');
  const source = JSON.parse(readFileSync(resolve(DIR, 'world-ares.json'), 'utf8')) as Json;
  const { world, removed } = worldForDevelop(source);
  const objects = await sandboxObjects();
  mkdirSync(resolve(DIR, '.build'), { recursive: true });
  writeFileSync(resolve(DIR, '.build/world.json'), `${JSON.stringify(world, null, 2)}\n`);
  writeFileSync(resolve(DIR, '.build/persistence-items.json'), JSON.stringify(objects));

  console.log('World file for develop’s universesimulator:');
  for (const [key, what] of Object.entries(UNKNOWN)) {
    console.log(`  · left out ${key} (${what}): ${removed[key] ?? 0}`);
  }
  console.log(`  · federation on the persistence planet ${SANDBOX}`);
  const types = objects.reduce<Record<string, number>>((acc, item) => {
    const type = String(item.object_type);
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Persistence objects read from ${PERSISTENCE_URL}: ${JSON.stringify(types)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
