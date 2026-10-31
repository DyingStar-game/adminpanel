import type { Item } from '@dyingstar-admin/schemas';
import { poiIds } from './inventoryMock';

/**
 * Fictional dataset reproducing the shapes observed on the live persistence service
 * (2026-10-01): roots with `parent_id: ""`, planets with orbital samples and quaternions,
 * moons parented to a planet, `components` / `seats` keyed by name, a dangling component
 * reference, an orphan, and UUIDs outside RFC 4122 variants.
 */
export const ids = {
  star: '0f1e2d3c-0000-4000-8000-000000000001',
  planet: 'c0379c08-1d5b-4ca2-8876-230908141b68',
  moon: '8a056e0f-9e00-4c00-8000-000000000003',
  spawnbuilding: 'f845c6ae-3fc1-4892-9a92-4012de49775f',
  player: '1b029618-ee3b-4045-abaa-ed1fafd9f8f8',
  vehicle: '4e9a9ff9-2c69-408d-bd3f-bffd3afc316d',
  wheelFl: '7c38c9df-dbfd-c8e5-d18e-5cfe3025691e',
  wheelFr: '0fbdbed2-a747-ac5f-6f0d-5825b4e8ead4',
  /** Referenced by the vehicle but absent from persistence. */
  missingComponent: 'deadbeef-0000-0000-0000-000000000000',
  orphanComponent: '6a6a6a6a-1111-2222-3333-444444444444',
  missingParent: 'bb389397-c700-4000-8000-000000000099',
  rock: '35ac67f7-c1cf-20c0-1424-af07889a5c77',
  /** A rock laid in the truck's bed (child of the vehicle). */
  loadedRock: '12749ffc-adda-4847-8600-a403d201cea5',
  /** A crate of gold a mining depot packed, loaded in the truck's bed (ADR 0029). */
  haulingCrate: '90b295dd-2388-42f0-9e33-611a94a39aa6',
  /** One of the empty crates laid on the planet. */
  emptyCrate: '9cdc0367-9777-87b7-6a41-f7a3c23ddc50',
  /** Caves (`cave` props, StarGrotte) on the planet, and their discoveries (ADR 0032). */
  caveEcho: 'a3c1e5f0-1d2b-5c3d-8e4f-000000000c01',
  caveFang: 'a3c1e5f0-1d2b-5c3d-8e4f-000000000c02',
  caveHollow: 'a3c1e5f0-1d2b-5c3d-8e4f-000000000c03',
  caveSpire: 'a3c1e5f0-1d2b-5c3d-8e4f-000000000c04',
  discoveryEcho: 'd15c0e1f-7a2b-5c3d-9e4f-000000000d01',
  discoveryFang: 'd15c0e1f-7a2b-5c3d-9e4f-000000000d02',
  discoveryHollow: 'd15c0e1f-7a2b-5c3d-9e4f-000000000d03',
  discoverySpire: 'd15c0e1f-7a2b-5c3d-9e4f-000000000d04',
} as const;

const star: Item = {
  object_type: 'star',
  object_uuid: ids.star,
  object_data: {
    name: 'Tarsis',
    parent_id: '',
    position: { x: 0, y: 0, z: 0 },
    scenename: 'scenes/_universe/environment/space/star.tscn',
    from_timestamp: 1790858538,
  },
};

const planet: Item = {
  object_type: 'planet',
  object_uuid: ids.planet,
  object_data: {
    name: 'SandBox',
    parent_id: '',
    scenename: 'scenes/systems/tarsis/sandbox.tscn',
    from_timestamp: 1790858538,
    soi: 18117124.97,
    positions: [
      { x: 159323864.73, y: 174823218.06, z: 222244398.56 },
      { x: 159324092.07, y: 174823470.17, z: 222244047.26 },
    ],
    rotations: [
      { w: -0.376, x: -0.336, y: -0.15, z: 0.85 },
      { w: -0.376, x: -0.336, y: -0.15, z: 0.85 },
    ],
  },
};

const moon: Item = {
  object_type: 'planet',
  object_uuid: ids.moon,
  object_data: {
    name: 'P3_M2',
    parent_id: ids.planet,
    scenename: 'scenes/systems/tarsis/tarsis_3_2.tscn',
    from_timestamp: 1790858538,
    soi: 1200000,
    positions: [{ x: 1, y: 2, z: 3 }],
    rotations: [{ w: 1, x: 0, y: 0, z: 0 }],
  },
};

const spawnbuilding: Item = {
  object_type: 'spawnbuilding',
  object_uuid: ids.spawnbuilding,
  object_data: {
    type: 'spawnbuilding',
    uuid: ids.spawnbuilding,
    name: 'tarsis_4-1006',
    parent_id: ids.planet,
    position: { x: 4449536.77, y: 2674848.18, z: -3676497.56 },
    rotation: { x: 0, y: 1.2, z: 0 },
    scenename: 'scenes/_universe/buildings/spawnbuilding.tscn',
    apartments: [
      { number: 1, player_uuid: ids.player },
      { number: 2, player_uuid: '' },
    ],
    total: 2,
    available: 1,
  },
};

const player: Item = {
  object_type: 'player',
  object_uuid: ids.player,
  object_data: {
    type: 'player',
    uuid: ids.player,
    name: 'ddurieux',
    parent_id: ids.spawnbuilding,
    spawn_appartment_id: ids.spawnbuilding,
    is_npc: false,
    action: 'land:15',
    seat: 'driver',
    carrying: false,
    head: 0.38,
    head_yaw: 0,
    position: { x: -3.226, y: 0.071, z: 8.009 },
    rotation: { x: 0, y: 1.708, z: 0 },
  },
};

/** Occupied vehicle: pilot and driver seat set, one component reference is dangling. */
const vehicle: Item = {
  object_type: 'vehicle',
  object_uuid: ids.vehicle,
  object_data: {
    type: 'vehicle',
    uuid: ids.vehicle,
    parent_id: ids.planet,
    scenename: 'scenes/_universe/vehicles/ground/trucks/truck.tscn',
    position: { x: 4449340.32, y: 2674885.87, z: -3676467.6 },
    rotation: { x: -1.025, y: 2.93, z: -2.19 },
    pilot_uuid: ids.player,
    seats: { seat_driver: ids.player, seat_passenger: '' },
    // slot_rr is an empty compartment.
    components: {
      slot_fl: ids.wheelFl,
      slot_fr: ids.wheelFr,
      slot_rl: ids.missingComponent,
      slot_rr: '',
    },
    doors: {
      front_l_door: true,
      front_r_door: false,
      hatch_fl: false,
      hatch_fr: true,
      hatch_rl: false,
      hatch_rr: false,
    },
    speed: 28.7,
    wheel_kmh: 29.4,
    engine: true,
    handbrake: false,
    headlights: true,
    limiter_on: false,
    limiter_kmh: 30,
    mass: 1450,
    cargo_mass: 0,
    odometer_km: 252.1,
    suspension: [-7, -7, -7, -7],
  },
};

/** A vehicle component: an engine by default, a battery (`charge_j` in joules) when given. */
const wheel = (
  uuid: string,
  slot: string,
  model: 'engine_t1' | 'battery_t1' = 'engine_t1',
  extra: Record<string, unknown> = {},
): Item => ({
  object_type: 'vehicle_component',
  object_uuid: uuid,
  object_data: {
    type: 'vehicle_component',
    uuid,
    parent_id: ids.vehicle,
    slot_id: slot,
    scenename: `scenes/_universe/props/vehicles/${model}.tscn`,
    weight: 25,
    ...extra,
    position: { x: -1227.515, y: -811.175, z: -7231.805 },
    rotation: { x: 1.245, y: 1.17, z: 1.125 },
  },
});

const orphanComponent: Item = {
  ...wheel(ids.orphanComponent, 'slot_rr'),
  object_data: {
    ...wheel(ids.orphanComponent, 'slot_rr').object_data,
    parent_id: ids.missingParent,
  },
};

const rock: Item = {
  object_type: 'miningrock',
  object_uuid: ids.rock,
  object_data: {
    type: 'miningrock',
    uuid: ids.rock,
    parent_id: ids.planet,
    scenename: 'scenes/_universe/environment/terrain/rocks/rock_mining_sm.tscn',
    mineral_id: 'gold',
    host_rock_id: 'corundum_sapphire',
    can_be_breakable: true,
    weight: 7572.7,
    fractures: [{ fractured: false, keep_side: 1, seq: 0 }],
    position: { x: 4449536.77, y: 2674848.18, z: -3676497.56 },
    rotation: { x: 0.52, y: 1.39, z: 0.74 },
  },
};

/**
 * A mined rock carried by the truck: its parent is the vehicle, its position local to it. Kept
 * out of `createDataset` (it would change the vehicle's children everywhere): add it when needed.
 */
export const loadedRock: Item = {
  object_type: 'miningrock',
  object_uuid: ids.loadedRock,
  object_data: {
    ...rock.object_data,
    uuid: ids.loadedRock,
    parent_id: ids.vehicle,
    weight: 114.3,
    position: { x: 0.255, y: 0.355, z: 1.055 },
    rotation: { x: 0, y: 1.21, z: 0 },
  },
};

/**
 * A crate a mining depot packed (`hauling_box.tscn`, the test server's `90b295dd…` on
 * 2026-10-23), loaded in the truck's bed: `content` is one mineral, in litres and m³ (ADR 0029).
 * Kept out of `createDataset`, like `loadedRock`.
 */
export const haulingCrate: Item = {
  object_type: 'crate_container',
  object_uuid: ids.haulingCrate,
  object_data: {
    content: { mineral: 'gold', ore_volume: 0.066, units: 66 },
    parent_id: ids.vehicle,
    position: { x: 0.31, y: 0.42, z: 1.2 },
    rotation: { x: 0.3, y: -0.545, z: -1.115 },
    scenename: 'scenes/_universe/props/containers/hauling_box.tscn',
    type: 'crate_container',
    uuid: ids.haulingCrate,
    weight: 50,
  },
};

/** One of the 108 crates laid on the test server's planet: named, `content` empty. */
export const emptyCrate: Item = {
  object_type: 'crate_container',
  object_uuid: ids.emptyCrate,
  object_data: {
    content: {},
    name: 'CrateContainer5',
    parent_id: ids.planet,
    position: { x: 4457495.72036904, y: 2645977.09630498, z: 3687809.39918231 },
    rotation: { x: -0.317812621819458, y: 2.60144323290555, z: 1.11757013790599 },
    scenename: 'scenes/_universe/props/containers/crate_container.tscn',
    type: 'crate_container',
    uuid: ids.emptyCrate,
  },
};

/** The social player ids of the discoverers (`socialIds` of `socialMock`: griefer42, ddurieux). */
const DISCOVERERS = {
  griefer: { id: '5b1d3c1e-0000-4000-8000-0000000000b2', name: 'griefer42' },
  ddurieux: { id: ids.player, name: 'ddurieux' },
} as const;

/** A StarGrotte cave on the planet (`cave` prop, its placement fields flat in `object_data`). */
const cave = (uuid: string, placementId: string, longitude: number, latitude: number): Item => ({
  object_type: 'cave',
  object_uuid: uuid,
  object_data: {
    type: 'cave',
    uuid,
    parent_id: ids.planet,
    scenename: 'scenes/planet/cave/cave_site.tscn',
    placement_id: placementId,
    planet_name: 'tarsis_3',
    longitude_deg: longitude,
    latitude_deg: latitude,
    seed: 4242,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
});

/** Discovered on 2026-10-29 and later (unix seconds). */
const DISCOVERED_AT = 1_793_260_800;

/**
 * A discovery as the game writes it (`Discovery.record`, `server/discoveries.gd`): a child of the
 * place's item, no geometry, then the fields the proposal and the decision fill.
 */
const discovery = (
  uuid: string,
  caveUuid: string,
  placementId: string,
  discoverer: { id: string; name: string },
  minutes: number,
  fields: Record<string, unknown>,
): Item => ({
  object_type: 'discovery',
  object_uuid: uuid,
  object_data: {
    type: 'discovery',
    uuid,
    scenename: 'scenes/exploration/discovery.tscn',
    parent_id: caveUuid,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    place_kind: 'cave',
    place_id: placementId,
    place_uuid: caveUuid,
    planet_name: 'tarsis_3',
    discoverer_id: discoverer.id,
    discoverer_name: discoverer.name,
    discovered_at: DISCOVERED_AT + minutes * 60,
    status: 'unnamed',
    proposed_name: '',
    proposed_at: 0,
    approved_name: '',
    refusal_reason: '',
    decided_at: 0,
    poi_id: '',
    ...fields,
  },
});

/**
 * Four caves and their discoveries (ADR 0032): two names awaiting review (the older one by an
 * online player with a POI, the newer one by an offline player without), one approved, one
 * refused. Kept out of `createDataset`, like `loadedRock`: add them when needed.
 */
export function createDiscoveries(): Item[] {
  const at = (minutes: number) => DISCOVERED_AT + minutes * 60;
  return structuredClone([
    cave(ids.caveEcho, 'tarsis_3_cave_017', 37.62, -12.4),
    cave(ids.caveFang, 'tarsis_3_cave_021', 38.05, -11.9),
    cave(ids.caveHollow, 'tarsis_3_cave_008', 36.9, -13.1),
    cave(ids.caveSpire, 'tarsis_3_cave_030', 39.4, -10.2),
    discovery(ids.discoveryEcho, ids.caveEcho, 'tarsis_3_cave_017', DISCOVERERS.griefer, 0, {
      status: 'pending',
      proposed_name: "L'Antre des Échos",
      proposed_at: at(12),
      poi_id: poiIds.caveEcho,
    }),
    discovery(ids.discoveryFang, ids.caveFang, 'tarsis_3_cave_021', DISCOVERERS.ddurieux, 90, {
      status: 'pending',
      proposed_name: 'Fang Hollow',
      proposed_at: at(95),
    }),
    discovery(
      ids.discoveryHollow,
      ids.caveHollow,
      'tarsis_3_cave_008',
      DISCOVERERS.ddurieux,
      -600,
      {
        status: 'approved',
        proposed_name: 'Deep Hollow',
        proposed_at: at(-590),
        approved_name: 'Deep Hollow',
        decided_at: at(-300),
      },
    ),
    discovery(ids.discoverySpire, ids.caveSpire, 'tarsis_3_cave_030', DISCOVERERS.griefer, -400, {
      status: 'refused',
      proposed_name: 'Griefer Was Here',
      proposed_at: at(-395),
      refusal_reason: 'Names may not advertise a player.',
      decided_at: at(-200),
    }),
  ]);
}

/** Returns a fresh deep copy of the dataset, safe to mutate in a test. */
export function createDataset(): Item[] {
  return structuredClone([
    star,
    planet,
    moon,
    spawnbuilding,
    player,
    vehicle,
    wheel(ids.wheelFl, 'slot_fl'),
    // A T1 battery at half charge (90 of 180 MJ).
    wheel(ids.wheelFr, 'slot_fr', 'battery_t1', { charge_j: 90e6 }),
    orphanComponent,
    rock,
  ]);
}
