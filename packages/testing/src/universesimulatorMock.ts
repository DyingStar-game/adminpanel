import { http, HttpResponse } from 'msw';
import type {
  ActiveLeg,
  Alert,
  Entity,
  Federation,
  Flow,
  Leg,
  LocalPrice,
  MineralSource,
  MintEvent,
  Order,
  PriceHistory,
  PriceIndex,
  Resource,
  Simulation,
  StockHistory,
  TickReport,
  TravelRoute,
  Village,
  VillagePolicy,
  VillageStock,
  Warehouse,
  WarehouseCapacity,
  WarehouseStock,
} from '@dyingstar-admin/contracts/universesimulator';

/** Base URL used by tests for the mocked `universesimulator` service (ADR 0025). */
export const UNIVERSESIMULATOR_URL = 'http://universesimulator.test';

/**
 * Ids of the fixtures: federation ARES on SandBox, its villages (the nodes of the simulation,
 * the service's ADR 0013) and their warehouses. Village and warehouse ids are persistence
 * `poi_village` and `cargo_depot` UUIDs, written here without RFC version bits, as persistence
 * has them (the contract takes any hex UUID).
 */
export const simulationIds = {
  federation: 'a7e50000-0000-4000-8000-0000000000f1',
  ares: 'a7e50000-0000-4000-8000-0000000000e0',
  /** Communes in `social`, one per village. */
  communeC0001: 'a7e50000-0000-4000-8000-0000000000e1',
  communeF0001: 'a7e50000-0000-4000-8000-0000000000e2',
  communeM0002: 'a7e50000-0000-4000-8000-0000000000e3',
  communeF0003: 'a7e50000-0000-4000-8000-0000000000e4',
  /** Villages: the city C0001, the factory towns F0001 and F0003, the mining village M0002. */
  c0001: '0b1d0000-0000-0000-0000-000000000001',
  f0001: '0b1d0000-0000-0000-0000-000000000002',
  m0002: '0b1d0000-0000-0000-0000-000000000003',
  f0003: '0b1d0000-0000-0000-0000-000000000004',
  /** Warehouses (cargo depots): two in C0001 and F0001, one in M0002 and F0003. */
  c0001Main: '0cde0000-0000-0000-0000-000000000011',
  c0001Annex: '0cde0000-0000-0000-0000-000000000012',
  f0001Main: '0cde0000-0000-0000-0000-000000000021',
  f0001Annex: '0cde0000-0000-0000-0000-000000000022',
  m0002Main: '0cde0000-0000-0000-0000-000000000031',
  f0003Main: '0cde0000-0000-0000-0000-000000000041',
  water: 'a7e50000-0000-4000-8000-0000000000a1',
  food: 'a7e50000-0000-4000-8000-0000000000a2',
  oreFer: 'a7e50000-0000-4000-8000-0000000000a3',
  oreCuivre: 'a7e50000-0000-4000-8000-0000000000a4',
  oreTitane: 'a7e50000-0000-4000-8000-0000000000a5',
  /** Water carried from C0001 to M0002 through F0001: its second hop is on a mission. */
  waterOrder: 'a7e50000-0000-4000-8000-0000000000b1',
  /** Iron ore mined at M0002. */
  miningOrder: 'a7e50000-0000-4000-8000-0000000000b2',
  /** Food from F0003 to C0001, delivered. */
  foodOrder: 'a7e50000-0000-4000-8000-0000000000b3',
  /** Copper from M0002 for C0001, planned, not published yet. */
  copperOrder: 'a7e50000-0000-4000-8000-0000000000b4',
  waterMission: 'a7e50000-0000-4000-8000-0000000000c1',
  miningMission: 'a7e50000-0000-4000-8000-0000000000c2',
} as const;

/** A warehouse's stock as `universesimulator` reads it from inventory. */
export interface WarehouseLevel {
  warehouseId: string;
  resourceId: string;
  quantity: number;
  held: number;
}

export interface UniversesimulatorDataset {
  federation: Federation;
  entities: Entity[];
  resources: Resource[];
  villages: Village[];
  warehouses: Warehouse[];
  routes: TravelRoute[];
  policies: VillagePolicy[];
  capacities: WarehouseCapacity[];
  levels: WarehouseLevel[];
  flows: Flow[];
  mineralSources: MineralSource[];
  orders: Order[];
  prices: PriceIndex[];
  localPrices: LocalPrice[];
  mintEvents: MintEvent[];
  simulation: Simulation;
  /** The federation's treasury in `economie`; null when `economie` is unreachable. */
  treasuryBalance: number | null;
}

const HOUR = 3_600_000;

/** A position `east`, `north` metres away from `[x, y, z]` on the sphere (fixtures only). */
const near = ([x, y, z]: [number, number, number], dx: number, dz: number) =>
  [Number((x + dx).toFixed(2)), y, Number((z + dz).toFixed(2))] as [number, number, number];

/**
 * The ARES world after a day of simulation: four villages around the persistence fixtures'
 * buildings on SandBox, each with its cargo depots (positions relative to the planet centre),
 * routes between villages, village policies and flows, capacities per depot; M0002 short of
 * water (an order carries it hop by hop), an iron mining order, prices moved by supply and
 * demand. Times are relative to `now`, so the service's default windows (last 24 h) hold the
 * history.
 */
export function createUniversesimulatorDataset(now = Date.now()): UniversesimulatorDataset {
  const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();
  const s = simulationIds;
  const at = {
    c0001: [4450246.74, 2675582.34, -3675138.38] as [number, number, number],
    f0001: [4442589.19, 2662133.8, -3694106.41] as [number, number, number],
    m0002: [4436949.04, 2653662.6, -3706957.69] as [number, number, number],
    f0003: [4456762.34, 2665321.67, -3674684.63] as [number, number, number],
  };
  const village = (
    id: string,
    code: string,
    commune: string,
    villageType: string,
    population: number,
    position: [number, number, number],
    mainWarehouseId: string,
  ): Village => ({
    id,
    code,
    name: code,
    federationId: s.federation,
    politicalEntityId: commune,
    villageType,
    population,
    radiusM: 2_000,
    x: position[0],
    y: position[1],
    z: position[2],
    mainWarehouseId,
    active: true,
  });
  const warehouse = (
    id: string,
    villageId: string,
    code: string,
    name: string,
    [x, y, z]: [number, number, number],
  ): Warehouse => ({
    id,
    villageId,
    code,
    name,
    scenename: 'res://scenes/poi/cargo_depot.tscn',
    x,
    y,
    z,
    active: true,
  });
  const resource = (
    id: string,
    code: string,
    name: string,
    category: Resource['category'],
    unit: string,
    basePrice: number,
  ): Resource => ({
    id,
    code,
    name,
    category,
    unit,
    inventoryGoodType: code,
    massPerUnitKg: code === 'food_ration' ? 0.5 : 1,
    basePrice,
  });
  const route = (id: string, from: string, to: string, distanceM: number): TravelRoute => ({
    id,
    fromVillageId: from,
    toVillageId: to,
    distanceM,
    cost: distanceM / 1000,
    bidirectional: true,
    active: true,
  });
  const policy = (
    villageId: string,
    resourceId: string,
    minThreshold: number,
    targetLevel: number,
  ): VillagePolicy => ({ villageId, resourceId, minThreshold, targetLevel });
  const capacity = (
    warehouseId: string,
    resourceId: string,
    value: number | null,
    initialStock = 0,
  ): WarehouseCapacity => ({
    warehouseId,
    resourceId,
    capacity: value,
    initialStock,
    initialStockApplied: true,
  });
  const level = (warehouseId: string, resourceId: string, quantity: number, held = 0) => ({
    warehouseId,
    resourceId,
    quantity,
    held,
  });
  let flowId = 0;
  const flow = (
    villageId: string,
    resourceId: string,
    ratePerHour: number,
    source: Flow['source'],
    label: string | null,
  ): Flow => ({
    id: `a7e50000-0000-4000-8000-0000000002${String(++flowId).padStart(2, '0')}`,
    villageId,
    resourceId,
    ratePerHour,
    carry: 0,
    source,
    label,
  });
  const leg = (
    orderId: string,
    seq: number,
    [fromVillageId, fromWarehouseId]: [string | null, string | null],
    [toVillageId, toWarehouseId]: [string, string],
    quantity: number,
    distanceM: number,
    status: Leg['status'],
    extra: {
      rewardAmount?: number;
      missionId?: string;
      publishedAt?: string;
      completedAt?: string;
    } = {},
  ): Leg => ({
    // Derived from the order's id: `…0000000b1` → legs `…000000000b11`, `…b12`.
    id: `a7e50000-0000-4000-8000-000000000${orderId.slice(-2)}${seq}`,
    orderId,
    seq,
    fromVillageId,
    toVillageId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
    distanceM,
    rewardAmount: extra.rewardAmount ?? null,
    status,
    holdId:
      status === 'published' || status === 'held'
        ? `a7e50000-0000-4000-8000-0000000d0${orderId.slice(-2)}${seq}`
        : null,
    missionId: extra.missionId ?? null,
    attempts: status === 'waiting' || status === 'pending' ? 0 : 1,
    lastError: null,
    publishedAt: extra.publishedAt ?? null,
    completedAt: extra.completedAt ?? null,
  });
  const price = (resourceId: string, supply: number, demand: number, unitPrice: number) => ({
    federationId: s.federation,
    resourceId,
    supply,
    demand,
    unitPrice,
    computedAt: ago(0.05),
  });
  const local = (villageId: string, resourceId: string, localFactor: number, unit: number) => ({
    villageId,
    resourceId,
    localFactor,
    buyPrice: Number((unit * localFactor * 0.95).toFixed(2)),
    sellPrice: Number((unit * localFactor * 1.05).toFixed(2)),
    computedAt: ago(0.05),
  });
  const commune = (id: string, name: string): Entity => ({
    id,
    type: 'commune',
    name,
    parentId: s.ares,
    federationId: s.federation,
  });

  return {
    federation: {
      id: s.federation,
      code: 'ARES',
      name: 'ARES',
      politicalEntityId: s.ares,
      planetInternalName: 'tarsis_3',
      planetPoiUuid: null,
      currency: 'credits',
      managedCategories: ['ore', 'food', 'water'],
      treasuryFloor: 200_000,
      mintBatch: 1_000_000,
      mintCeiling: 1_000_000_000,
      elasticity: 0.8,
      priceMinFactor: 0.25,
      priceMaxFactor: 4,
      spread: 0.1,
      freightRatePerTkm: 25,
      urgencyMax: 1,
      minerShare: 0.6,
      legBaseReward: 200,
      createdAt: ago(48),
      updatedAt: ago(48),
    },
    entities: [
      { id: s.ares, type: 'federation', name: 'ARES', parentId: null, federationId: s.federation },
      commune(s.communeC0001, 'C0001'),
      commune(s.communeF0001, 'F0001'),
      commune(s.communeM0002, 'M0002'),
      commune(s.communeF0003, 'F0003'),
    ],
    resources: [
      resource(s.water, 'water', 'Water', 'water', 'l', 2),
      resource(s.food, 'food_ration', 'Food ration', 'food', 'unit', 8),
      resource(s.oreFer, 'ore_fer', 'Iron ore', 'ore', 'kg', 5),
      resource(s.oreCuivre, 'ore_cuivre', 'Copper ore', 'ore', 'kg', 9),
      resource(s.oreTitane, 'ore_titane', 'Titanium ore', 'ore', 'kg', 25),
    ],
    villages: [
      village(s.c0001, 'C0001', s.communeC0001, 'city', 1_200, at.c0001, s.c0001Main),
      village(s.f0001, 'F0001', s.communeF0001, 'factory', 300, at.f0001, s.f0001Main),
      village(s.m0002, 'M0002', s.communeM0002, 'mining', 80, at.m0002, s.m0002Main),
      village(s.f0003, 'F0003', s.communeF0003, 'factory', 150, at.f0003, s.f0003Main),
    ],
    warehouses: [
      warehouse(s.c0001Main, s.c0001, 'C0001-1', 'C0001 — Cargo depot', near(at.c0001, 150, 0)),
      warehouse(s.c0001Annex, s.c0001, 'C0001-2', 'C0001 — Annex', near(at.c0001, -200, 120)),
      warehouse(s.f0001Main, s.f0001, 'F0001-1', 'F0001 — Cargo depot', near(at.f0001, 100, 0)),
      warehouse(s.f0001Annex, s.f0001, 'F0001-2', 'F0001 — Annex', near(at.f0001, 0, 180)),
      warehouse(s.m0002Main, s.m0002, 'M0002-1', 'M0002 — Cargo depot', near(at.m0002, 120, 60)),
      warehouse(s.f0003Main, s.f0003, 'F0003-1', 'F0003 — Cargo depot', near(at.f0003, -90, 0)),
    ],
    routes: [
      route('a7e50000-0000-4000-8000-000000000102', s.m0002, s.f0001, 15_000),
      route('a7e50000-0000-4000-8000-000000000103', s.f0001, s.c0001, 25_000),
      route('a7e50000-0000-4000-8000-000000000104', s.f0003, s.c0001, 12_000),
      route('a7e50000-0000-4000-8000-000000000105', s.f0003, s.f0001, 18_000),
    ],
    policies: [
      policy(s.c0001, s.water, 2_000, 6_000),
      policy(s.c0001, s.food, 500, 2_000),
      policy(s.c0001, s.oreFer, 500, 2_000),
      policy(s.c0001, s.oreCuivre, 200, 800),
      policy(s.f0001, s.water, 300, 1_000),
      policy(s.f0001, s.food, 100, 400),
      policy(s.m0002, s.water, 300, 1_000),
      policy(s.m0002, s.food, 100, 400),
      policy(s.m0002, s.oreFer, 500, 3_000),
      policy(s.m0002, s.oreCuivre, 200, 1_500),
      policy(s.m0002, s.oreTitane, 50, 300),
      policy(s.f0003, s.food, 200, 1_500),
      policy(s.f0003, s.water, 200, 800),
    ],
    capacities: [
      capacity(s.c0001Main, s.water, 30_000, 15_000),
      capacity(s.c0001Annex, s.water, 20_000, 5_000),
      capacity(s.c0001Main, s.food, 20_000, 3_000),
      capacity(s.c0001Main, s.oreFer, 20_000, 1_000),
      capacity(s.c0001Main, s.oreCuivre, 10_000, 300),
      capacity(s.f0001Main, s.water, 3_000, 800),
      capacity(s.f0001Annex, s.water, 2_000),
      capacity(s.f0001Main, s.food, 3_000, 300),
      capacity(s.m0002Main, s.water, 2_000, 400),
      capacity(s.m0002Main, s.food, 1_000, 150),
      capacity(s.m0002Main, s.oreFer, 10_000),
      capacity(s.m0002Main, s.oreCuivre, 5_000),
      capacity(s.m0002Main, s.oreTitane, 2_000),
      capacity(s.f0003Main, s.food, 10_000, 2_500),
      capacity(s.f0003Main, s.water, 3_000, 600),
    ],
    levels: [
      level(s.c0001Main, s.water, 12_000, 600),
      level(s.c0001Annex, s.water, 5_400),
      level(s.c0001Main, s.food, 1_500),
      level(s.c0001Annex, s.food, 850),
      level(s.c0001Main, s.oreFer, 1_200),
      level(s.c0001Main, s.oreCuivre, 140),
      level(s.f0001Main, s.water, 900, 600),
      level(s.f0001Annex, s.water, 350),
      level(s.f0001Main, s.food, 420),
      level(s.m0002Main, s.water, 120),
      level(s.m0002Main, s.food, 210),
      level(s.m0002Main, s.oreFer, 380),
      level(s.m0002Main, s.oreCuivre, 900),
      level(s.m0002Main, s.oreTitane, 0),
      level(s.f0003Main, s.food, 10_000),
      level(s.f0003Main, s.water, 640),
    ],
    flows: [
      flow(s.c0001, s.water, 250, 'industry', 'Wells and recyclers'),
      flow(s.c0001, s.water, -180, 'population', 'City'),
      flow(s.c0001, s.food, -60, 'population', 'City'),
      flow(s.f0001, s.water, -25, 'population', 'Town'),
      flow(s.m0002, s.water, -30, 'population', 'Miners'),
      flow(s.m0002, s.food, -8, 'population', null),
      flow(s.f0003, s.food, 90, 'industry', 'Farms'),
    ],
    mineralSources: [
      {
        id: 'a7e50000-0000-4000-8000-000000000301',
        villageId: s.m0002,
        resourceId: s.oreFer,
        remainingUnits: null,
        maxUnitsPerMission: 500,
      },
      {
        id: 'a7e50000-0000-4000-8000-000000000302',
        villageId: s.m0002,
        resourceId: s.oreTitane,
        remainingUnits: 4_000,
        maxUnitsPerMission: 100,
      },
    ],
    orders: [
      {
        id: s.waterOrder,
        kind: 'transport',
        federationId: s.federation,
        resourceId: s.water,
        quantity: 600,
        originVillageId: s.c0001,
        destinationVillageId: s.m0002,
        path: [s.c0001, s.f0001, s.m0002],
        status: 'in_progress',
        trigger: 'auto_shortage',
        totalReward: 3_760,
        createdBy: null,
        lastError: null,
        createdAt: ago(5),
        updatedAt: ago(1),
        legs: [
          leg(
            s.waterOrder,
            1,
            [s.c0001, s.c0001Main],
            [s.f0001, s.f0001Main],
            600,
            25_000,
            'completed',
            {
              rewardAmount: 2_120,
              missionId: 'a7e50000-0000-4000-8000-0000000000c0',
              publishedAt: ago(5),
              completedAt: ago(1.5),
            },
          ),
          leg(
            s.waterOrder,
            2,
            [s.f0001, s.f0001Main],
            [s.m0002, s.m0002Main],
            600,
            15_000,
            'published',
            {
              rewardAmount: 1_640,
              missionId: s.waterMission,
              publishedAt: ago(1.4),
            },
          ),
        ],
      },
      {
        id: s.miningOrder,
        kind: 'mining',
        federationId: s.federation,
        resourceId: s.oreFer,
        quantity: 500,
        originVillageId: null,
        destinationVillageId: s.m0002,
        path: [s.m0002],
        status: 'in_progress',
        trigger: 'auto_mining',
        totalReward: 1_700,
        createdBy: null,
        lastError: null,
        createdAt: ago(3),
        updatedAt: ago(3),
        legs: [
          leg(s.miningOrder, 1, [null, null], [s.m0002, s.m0002Main], 500, 0, 'published', {
            rewardAmount: 1_700,
            missionId: s.miningMission,
            publishedAt: ago(3),
          }),
        ],
      },
      {
        id: s.foodOrder,
        kind: 'transport',
        federationId: s.federation,
        resourceId: s.food,
        quantity: 1_200,
        originVillageId: s.f0003,
        destinationVillageId: s.c0001,
        path: [s.f0003, s.c0001],
        status: 'completed',
        trigger: 'auto_shortage',
        totalReward: 1_380,
        createdBy: null,
        lastError: null,
        createdAt: ago(20),
        updatedAt: ago(14),
        legs: [
          leg(
            s.foodOrder,
            1,
            [s.f0003, s.f0003Main],
            [s.c0001, s.c0001Main],
            1_200,
            12_000,
            'completed',
            {
              rewardAmount: 1_380,
              missionId: 'a7e50000-0000-4000-8000-0000000000c3',
              publishedAt: ago(20),
              completedAt: ago(14),
            },
          ),
        ],
      },
      {
        id: s.copperOrder,
        kind: 'transport',
        federationId: s.federation,
        resourceId: s.oreCuivre,
        quantity: 660,
        originVillageId: s.m0002,
        destinationVillageId: s.c0001,
        path: [s.m0002, s.f0001, s.c0001],
        status: 'planned',
        trigger: 'auto_shortage',
        totalReward: 0,
        createdBy: null,
        lastError: null,
        createdAt: ago(0.1),
        updatedAt: ago(0.1),
        legs: [
          leg(s.copperOrder, 1, [s.m0002, null], [s.f0001, s.f0001Main], 660, 15_000, 'pending'),
          leg(s.copperOrder, 2, [s.f0001, null], [s.c0001, s.c0001Main], 660, 25_000, 'waiting'),
        ],
      },
    ],
    prices: [
      price(s.water, 19_610, 26_000, 2.53),
      price(s.food, 12_980, 4_300, 4.16),
      price(s.oreFer, 1_580, 5_000, 12.6),
      price(s.oreCuivre, 1_040, 2_300, 17.2),
      price(s.oreTitane, 0, 300, 100),
    ],
    localPrices: [
      local(s.c0001, s.water, 0.9, 2.53),
      local(s.f0001, s.water, 1.1, 2.53),
      local(s.m0002, s.water, 1.6, 2.53),
      local(s.f0003, s.water, 1.2, 2.53),
      local(s.c0001, s.food, 1.05, 4.16),
      local(s.m0002, s.food, 1.3, 4.16),
      local(s.f0003, s.food, 0.7, 4.16),
      local(s.c0001, s.oreFer, 1.2, 12.6),
      local(s.m0002, s.oreFer, 0.8, 12.6),
    ],
    mintEvents: [
      {
        id: 'a7e50000-0000-4000-8000-000000000401',
        federationId: s.federation,
        amount: 1_000_000,
        reason: 'treasury below floor',
        createdAt: ago(6),
      },
      {
        id: 'a7e50000-0000-4000-8000-000000000402',
        federationId: s.federation,
        amount: 5_000_000,
        reason: 'initial treasury',
        createdAt: ago(40),
      },
    ],
    simulation: {
      state: {
        paused: false,
        lastTickAt: ago(0.01),
        tickCount: 1_440,
        lastTickDurationMs: 182,
        lastError: null,
        lastPoliticalRefresh: ago(0.5),
      },
      enabled: true,
      tickSeconds: 60,
      timeScale: 1,
      externalMode: 'live',
    },
    treasuryBalance: 1_204_560,
  };
}

/**
 * `reads.rs` › `village_stocks`: per village and resource, the sum of its warehouses' levels,
 * with every resource it has a policy or a flow for; its policy, net flow and autonomy.
 * Sorted by village then resource id, like the service's `BTreeMap`.
 */
export function villageStocksOf(data: UniversesimulatorDataset): Map<string, VillageStock[]> {
  const villageOf = new Map(data.warehouses.map((w) => [w.id, w.villageId]));
  const sums = new Map<string, { quantity: number; held: number }>();
  const key = (v: string, r: string) => `${v}|${r}`;
  const entry = (v: string, r: string) => {
    let sum = sums.get(key(v, r));
    if (!sum) sums.set(key(v, r), (sum = { quantity: 0, held: 0 }));
    return sum;
  };
  for (const l of data.levels) {
    const v = villageOf.get(l.warehouseId);
    if (!v) continue;
    const sum = entry(v, l.resourceId);
    sum.quantity += l.quantity;
    sum.held += l.held;
  }
  for (const p of data.policies) entry(p.villageId, p.resourceId);
  const net = new Map<string, number>();
  for (const f of data.flows) {
    entry(f.villageId, f.resourceId);
    net.set(
      key(f.villageId, f.resourceId),
      (net.get(key(f.villageId, f.resourceId)) ?? 0) + f.ratePerHour,
    );
  }
  const out = new Map<string, VillageStock[]>();
  for (const k of [...sums.keys()].sort()) {
    const [v = '', r = ''] = k.split('|');
    const { quantity, held } = sums.get(k) ?? { quantity: 0, held: 0 };
    const p = data.policies.find((p) => p.villageId === v && p.resourceId === r);
    const rate = net.get(k) ?? 0;
    const available = quantity - held;
    const rows = out.get(v) ?? [];
    rows.push({
      resourceId: r,
      quantity,
      held,
      available,
      minThreshold: p?.minThreshold ?? null,
      targetLevel: p?.targetLevel ?? null,
      netFlowPerHour: rate,
      autonomyHours: rate < 0 ? Math.max(available, 0) / -rate : null,
    });
    out.set(v, rows);
  }
  return out;
}

/**
 * `history::stock_history`: one snapshot per hour over the last day, around today's level, of a
 * village (its warehouses summed) or of one warehouse; the village's policy for a village.
 */
function stockHistoryOf(
  data: UniversesimulatorDataset,
  target: { village?: string | null; warehouse?: string | null },
  resourceId: string,
  since: number,
  now: number,
): StockHistory {
  const villageId =
    target.village ?? data.warehouses.find((w) => w.id === target.warehouse)?.villageId;
  const warehouses = target.warehouse
    ? [target.warehouse]
    : data.warehouses.filter((w) => w.villageId === target.village).map((w) => w.id);
  const levels = data.levels.filter(
    (l) => warehouses.includes(l.warehouseId) && l.resourceId === resourceId,
  );
  const current = levels.reduce(
    (sum, l) => ({ quantity: sum.quantity + l.quantity, held: sum.held + l.held }),
    { quantity: 0, held: 0 },
  );
  const policy = target.village
    ? data.policies.find((p) => p.villageId === villageId && p.resourceId === resourceId)
    : undefined;
  const rate = data.flows
    .filter((f) => f.villageId === villageId && f.resourceId === resourceId)
    .reduce((sum, f) => sum + f.ratePerHour, 0);
  const points = levels.length
    ? Array.from({ length: 24 }, (_, i) => 23 - i).map((hoursAgo) => ({
        quantity: Math.max(0, Math.round(current.quantity - rate * hoursAgo)),
        held: hoursAgo < 2 ? current.held : 0,
        tickAt: new Date(now - hoursAgo * HOUR).toISOString(),
      }))
    : [];
  return {
    minThreshold: policy?.minThreshold ?? null,
    targetLevel: policy?.targetLevel ?? null,
    points: points.filter((p) => Date.parse(p.tickAt) >= since),
  };
}

/** `history::price_history`: one index per hour over the last day, drifting to today's. */
function priceHistoryOf(
  data: UniversesimulatorDataset,
  resourceId: string,
  since: number,
  now: number,
): PriceHistory {
  const index = data.prices.find((p) => p.resourceId === resourceId);
  if (!index) return { points: [] };
  return {
    points: Array.from({ length: 24 }, (_, i) => 23 - i)
      .map((hoursAgo) => ({
        supply: index.supply + hoursAgo * 10,
        demand: index.demand,
        unitPrice: Number(
          (index.unitPrice * (1 - hoursAgo * 0.008 + (hoursAgo % 3) * 0.01)).toFixed(2),
        ),
        computedAt: new Date(now - hoursAgo * HOUR).toISOString(),
      }))
      .filter((p) => Date.parse(p.computedAt) >= since),
  };
}

export interface UniversesimulatorMock {
  handlers: ReturnType<typeof http.get>[];
  data: UniversesimulatorDataset;
  /** Authorization headers received, newest last. */
  tokens: (string | null)[];
  /** Writes received (method, path and JSON body when there is one), oldest first. */
  writes: { call: string; body?: unknown }[];
}

/** Ids as the contract takes them: hex groups, no RFC version bits (persistence POI UUIDs). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_ORDER = ['planned', 'in_progress'];
const ACTIVE_LEG = ['pending', 'held', 'published', 'waiting'];

/**
 * MSW handlers reproducing the parts of `universesimulator`'s Admin API the panel uses
 * (`src/routes/views.rs`, `reads.rs`, `admin.rs`, `simulation/reconciler.rs`), villages being the
 * nodes (its ADR 0013): one federation (the default one); village stocks summed over their
 * warehouses; alerts for village policies whose available stock is under the threshold; active
 * legs of open orders (`waiting` included); local prices by spread; orders newest first with the
 * `village` filter matching the destination or any village of the path; a cancel refused
 * (409 `ORDER_CLOSED`) once an order is closed; village policies (`0 ≤ min ≤ target`, else 400),
 * warehouse capacities (`null` for none), flows (a `null` or empty label clears it) and a
 * village's main warehouse (one of its own, else 400). Roles are not checked here.
 */
export function createUniversesimulatorMock(
  data: UniversesimulatorDataset = createUniversesimulatorDataset(),
  baseUrl: string = UNIVERSESIMULATOR_URL,
): UniversesimulatorMock {
  const tokens: (string | null)[] = [];
  const writes: { call: string; body?: unknown }[] = [];
  const admin = `${baseUrl}/api/admin`;
  const seen = (request: Request) => tokens.push(request.headers.get('Authorization'));
  const wrote = (request: Request, body?: unknown) =>
    writes.push({
      call: `${request.method} ${new URL(request.url).pathname.replace(/^\/api\/admin/, '')}`,
      ...(body === undefined ? {} : { body }),
    });
  /** A write's JSON body, recorded; null when it is not a JSON object. */
  const bodyOf = async (request: Request): Promise<Record<string, unknown> | null> => {
    const body: unknown = await request.json().catch(() => null);
    wrote(request, body);
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  };
  const failure = (status: number, error: string, message: string) =>
    HttpResponse.json({ error, message }, { status });
  const badRequest = (message: string) => failure(400, 'BAD_REQUEST', message);
  const notFound = (what: string) => failure(404, 'NOT_FOUND', what);
  /** A foreign key or check constraint refused by PostgreSQL (`error.rs`). */
  const invalidReference = (message: string) => failure(400, 'INVALID_REFERENCE', message);
  const isInt = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;
  const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const isVillage = (id: unknown) => data.villages.some((v) => v.id === id);
  const isWarehouse = (id: unknown) => data.warehouses.some((w) => w.id === id);
  const isResource = (id: unknown) => data.resources.some((r) => r.id === id);
  const activeLegs = (): ActiveLeg[] =>
    data.orders
      .filter((o) => OPEN_ORDER.includes(o.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .flatMap((o) =>
        (o.legs ?? [])
          .filter((l) => ACTIVE_LEG.includes(l.status))
          .map((l) => ({
            legId: l.id,
            orderId: o.id,
            kind: o.kind,
            resourceId: o.resourceId,
            fromVillageId: l.fromVillageId ?? null,
            toVillageId: l.toVillageId,
            fromWarehouseId: l.fromWarehouseId ?? null,
            toWarehouseId: l.toWarehouseId ?? null,
            quantity: l.quantity,
            status: l.status,
            rewardAmount: l.rewardAmount ?? null,
            missionId: l.missionId ?? null,
          })),
      );
  /** A warehouse's own stock rows: resources it holds or has a capacity for (`reads.rs`). */
  const warehouseStocks = (warehouseId: string): WarehouseStock[] =>
    data.resources.flatMap((r) => {
      const l = data.levels.find((l) => l.warehouseId === warehouseId && l.resourceId === r.id);
      const capacity =
        data.capacities.find((c) => c.warehouseId === warehouseId && c.resourceId === r.id)
          ?.capacity ?? null;
      if (!l?.quantity && capacity === null) return [];
      const quantity = l?.quantity ?? 0;
      const held = l?.held ?? 0;
      return [
        { resourceId: r.id, code: r.code, quantity, held, available: quantity - held, capacity },
      ];
    });
  /** Required query parameters that must be UUIDs (axum's `Query` refuses the rest). */
  const uuidParams = (url: URL, names: string[]) => {
    for (const name of names) {
      if (!UUID.test(url.searchParams.get(name) ?? '')) return `${name}: invalid or missing UUID`;
    }
    return null;
  };
  const sinceOf = (url: URL, now: number) => {
    const from = url.searchParams.get('from');
    return from ? Date.parse(from) : now - 24 * HOUR;
  };
  const listed = <T>(items: T[]) => HttpResponse.json({ items });

  const handlers = [
    http.get(`${admin}/dashboard`, ({ request }) => {
      seen(request);
      const alerts: Alert[] = [...villageStocksOf(data)].flatMap(([villageId, stocks]) =>
        stocks
          .filter((s) => s.minThreshold != null && s.available < s.minThreshold)
          .map((s) => ({
            villageId,
            resourceId: s.resourceId,
            available: s.available,
            minThreshold: s.minThreshold ?? 0,
            targetLevel: s.targetLevel ?? null,
            netFlowPerHour: s.netFlowPerHour,
            autonomyHours: s.autonomyHours ?? null,
          })),
      );
      const published = activeLegs().filter((l) => l.status === 'published');
      const dayAgo = Date.now() - 24 * HOUR;
      return HttpResponse.json({
        simulation: data.simulation.state,
        federation: data.federation,
        treasury: {
          balance: data.treasuryBalance,
          currency: data.federation.currency,
          floor: data.federation.treasuryFloor,
          minted24h: data.mintEvents
            .filter((m) => Date.parse(m.createdAt) >= dayAgo)
            .reduce((sum, m) => sum + m.amount, 0),
          escrowed: published.reduce((sum, l) => sum + (l.rewardAmount ?? 0), 0),
        },
        openOrders: data.orders.filter((o) => o.status === 'in_progress').length,
        activeMissions: published.length,
        alerts,
      });
    }),
    http.get(`${admin}/network`, ({ request }) => {
      seen(request);
      const stocks = villageStocksOf(data);
      return HttpResponse.json({
        federationId: data.federation.id,
        villages: data.villages.map((v) => ({
          ...v,
          stocks: stocks.get(v.id) ?? [],
          warehouses: data.warehouses.filter((w) => w.villageId === v.id),
        })),
        routes: data.routes,
        activeLegs: activeLegs(),
      });
    }),
    http.get(`${admin}/villages`, ({ request }) => {
      seen(request);
      const entity = new URL(request.url).searchParams.get('entity');
      const stocks = villageStocksOf(data);
      return listed(
        data.villages
          .filter((v) => !entity || v.politicalEntityId === entity)
          .map((v) => ({
            ...v,
            warehouseCount: data.warehouses.filter((w) => w.villageId === v.id && w.active).length,
            stocks: stocks.get(v.id) ?? [],
          })),
      );
    }),
    http.get(`${admin}/villages/:id`, ({ request, params }) => {
      seen(request);
      const village = data.villages.find((v) => v.id === params.id);
      if (!village) return notFound(`village ${String(params.id)}`);
      const own = data.warehouses.filter((w) => w.villageId === village.id);
      return HttpResponse.json({
        village,
        stocks: villageStocksOf(data).get(village.id) ?? [],
        warehouses: own.map((w) => ({
          warehouse: w,
          main: w.id === village.mainWarehouseId,
          stocks: warehouseStocks(w.id),
        })),
        policies: data.policies.filter((p) => p.villageId === village.id),
        flows: data.flows.filter((f) => f.villageId === village.id),
        capacities: data.capacities.filter((c) => own.some((w) => w.id === c.warehouseId)),
        mineralSources: data.mineralSources.filter((m) => m.villageId === village.id),
        localPrices: data.localPrices.filter((p) => p.villageId === village.id),
        incoming: activeLegs().filter((l) => l.toVillageId === village.id),
      });
    }),
    http.get(`${admin}/warehouses/:id`, ({ request, params }) => {
      seen(request);
      const warehouse = data.warehouses.find((w) => w.id === params.id);
      if (!warehouse) return notFound(`warehouse ${String(params.id)}`);
      return HttpResponse.json({
        warehouse,
        village: data.villages.find((v) => v.id === warehouse.villageId) ?? null,
        stocks: warehouseStocks(warehouse.id),
        capacities: data.capacities.filter((c) => c.warehouseId === warehouse.id),
      });
    }),
    http.get(`${admin}/orders`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const q = (name: string) => url.searchParams.get(name);
      const limit = Math.min(Math.max(Number(q('limit') ?? 50), 1), 200);
      const offset = Math.max(Number(q('offset') ?? 0), 0);
      const rows = data.orders
        .filter((o) => !q('status') || o.status === q('status'))
        .filter((o) => !q('kind') || o.kind === q('kind'))
        .filter((o) => !q('resource') || o.resourceId === q('resource'))
        .filter(
          (o) =>
            !q('village') ||
            o.destinationVillageId === q('village') ||
            o.path.includes(q('village') ?? ''),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      return HttpResponse.json({
        items: rows.slice(offset, offset + limit),
        total: rows.length,
        limit,
        offset,
      });
    }),
    http.get(`${admin}/orders/:id`, ({ request, params }) => {
      seen(request);
      const order = data.orders.find((o) => o.id === params.id);
      return order ? HttpResponse.json(order) : notFound(`order ${String(params.id)}`);
    }),
    http.get(`${admin}/prices`, ({ request }) => {
      seen(request);
      return HttpResponse.json({ federationId: data.federation.id, items: data.prices });
    }),
    http.get(`${admin}/price-history`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const invalid = uuidParams(url, ['resource']);
      if (invalid) return badRequest(invalid);
      const now = Date.now();
      return HttpResponse.json(
        priceHistoryOf(data, url.searchParams.get('resource') ?? '', sinceOf(url, now), now),
      );
    }),
    http.get(`${admin}/local-prices`, ({ request }) => {
      seen(request);
      const resource = new URL(request.url).searchParams.get('resource');
      return listed(
        data.localPrices
          .filter((p) => !resource || p.resourceId === resource)
          .sort((a, b) => b.sellPrice - b.buyPrice - (a.sellPrice - a.buyPrice)),
      );
    }),
    http.get(`${admin}/stock-history`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const invalid = uuidParams(url, ['resource']);
      if (invalid) return badRequest(invalid);
      const village = url.searchParams.get('village');
      const warehouse = url.searchParams.get('warehouse');
      if (!village && !warehouse) return badRequest('village or warehouse is required');
      const now = Date.now();
      return HttpResponse.json(
        stockHistoryOf(
          data,
          { village, warehouse },
          url.searchParams.get('resource') ?? '',
          sinceOf(url, now),
          now,
        ),
      );
    }),
    http.get(`${admin}/incoming`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const invalid = uuidParams(url, ['village']);
      if (invalid) return badRequest(invalid);
      const id = url.searchParams.get('village');
      if (!isVillage(id)) return notFound(`village ${id}`);
      return listed(activeLegs().filter((l) => l.toVillageId === id));
    }),
    http.get(`${admin}/mint-events`, ({ request }) => {
      seen(request);
      const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100);
      return listed(
        [...data.mintEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
      );
    }),
    http.get(`${admin}/resources`, ({ request }) => {
      seen(request);
      return listed(data.resources);
    }),
    http.get(`${admin}/entities`, ({ request }) => {
      seen(request);
      return listed(data.entities);
    }),
    http.get(`${admin}/simulation`, ({ request }) => {
      seen(request);
      return HttpResponse.json(data.simulation);
    }),
    // Writes (`admin` or `supervisor` in the service).
    http.post(`${admin}/simulation/tick`, ({ request }) => {
      seen(request);
      wrote(request);
      const state = data.simulation.state;
      state.tickCount += 1;
      state.lastTickAt = new Date().toISOString();
      const report: TickReport = {
        skipped: null,
        federations: 1,
        elapsedGameHours: data.simulation.tickSeconds / 3600,
        flowsApplied: data.flows.length,
        shortages: 0,
        legsCompleted: 0,
        legsRetried: 0,
        ordersFailed: 0,
        ordersCreated: 0,
        legsPublished: 0,
        minted: 0,
        errors: [],
      };
      return HttpResponse.json(report);
    }),
    http.post(`${admin}/simulation/:action`, ({ request, params }) => {
      if (params.action !== 'pause' && params.action !== 'resume') return undefined;
      seen(request);
      wrote(request);
      data.simulation.state.paused = params.action === 'pause';
      return HttpResponse.json(data.simulation.state);
    }),
    http.post(`${admin}/orders/:id/cancel`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const order = data.orders.find((o) => o.id === params.id);
      if (!order) return notFound(`order ${String(params.id)}`);
      if (!OPEN_ORDER.includes(order.status)) {
        return failure(409, 'ORDER_CLOSED', `order is ${order.status}`);
      }
      order.status = 'cancelled';
      order.updatedAt = new Date().toISOString();
      for (const leg of order.legs ?? []) {
        if (ACTIVE_LEG.includes(leg.status)) leg.status = 'cancelled';
      }
      return new HttpResponse(null, { status: 204 });
    }),
    // Configuration (`admin.rs`, `db/world.rs`).
    // `update_village`: the main warehouse must be one of the village's own.
    http.put(`${admin}/villages/:id`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      const village = data.villages.find((v) => v.id === params.id);
      if (!village) return notFound(`village ${String(params.id)}`);
      if (!body) return badRequest('body: expected an object');
      if (body.mainWarehouseId !== undefined) {
        const own = data.warehouses.find(
          (w) => w.id === body.mainWarehouseId && w.villageId === village.id,
        );
        if (!own) return badRequest('mainWarehouseId is not a warehouse of this village');
        village.mainWarehouseId = own.id;
      }
      if (typeof body.active === 'boolean') village.active = body.active;
      return HttpResponse.json(village);
    }),
    http.get(`${admin}/village-policies`, ({ request }) => {
      seen(request);
      const village = new URL(request.url).searchParams.get('village');
      return listed(data.policies.filter((p) => !village || p.villageId === village));
    }),
    http.put(`${admin}/village-policies`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body || !isInt(body.minThreshold, Number.MIN_SAFE_INTEGER) || !isInt(body.targetLevel)) {
        return badRequest('minThreshold and targetLevel: whole numbers');
      }
      const min = body.minThreshold as number;
      const target = body.targetLevel as number;
      if (min < 0 || target < min) return badRequest('expected 0 <= minThreshold <= targetLevel');
      if (!isVillage(body.villageId) || !isResource(body.resourceId)) {
        return invalidReference('village policy refused by the database');
      }
      const saved: VillagePolicy = {
        villageId: body.villageId as string,
        resourceId: body.resourceId as string,
        minThreshold: min,
        targetLevel: target,
      };
      const existing = data.policies.find(
        (p) => p.villageId === saved.villageId && p.resourceId === saved.resourceId,
      );
      if (existing) Object.assign(existing, saved);
      else data.policies.push(saved);
      return HttpResponse.json(saved);
    }),
    http.delete(`${admin}/village-policies/:village/:resource`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const index = data.policies.findIndex(
        (p) => p.villageId === params.village && p.resourceId === params.resource,
      );
      if (index < 0) return notFound('village policy');
      data.policies.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${admin}/warehouse-capacities`, ({ request }) => {
      seen(request);
      const url = new URL(request.url);
      const village = url.searchParams.get('village');
      const warehouse = url.searchParams.get('warehouse');
      const villageOf = new Map(data.warehouses.map((w) => [w.id, w.villageId]));
      return listed(
        data.capacities.filter(
          (c) =>
            (!warehouse || c.warehouseId === warehouse) &&
            (!village || villageOf.get(c.warehouseId) === village),
        ),
      );
    }),
    // `upsert_capacity`: `null` for no limit, a negative one refused; the initial stock kept.
    http.put(`${admin}/warehouse-capacities`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body) return badRequest('body: expected an object');
      const value = body.capacity ?? null;
      if (value !== null && !isInt(value)) return badRequest('capacity must be positive or null');
      if (!isWarehouse(body.warehouseId) || !isResource(body.resourceId)) {
        return invalidReference('warehouse capacity refused by the database');
      }
      let saved = data.capacities.find(
        (c) => c.warehouseId === body.warehouseId && c.resourceId === body.resourceId,
      );
      if (saved) saved.capacity = value as number | null;
      else {
        saved = {
          warehouseId: body.warehouseId as string,
          resourceId: body.resourceId as string,
          capacity: value as number | null,
          initialStock: 0,
          initialStockApplied: false,
        };
        data.capacities.push(saved);
      }
      return HttpResponse.json(saved);
    }),
    http.delete(`${admin}/warehouse-capacities/:warehouse/:resource`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const index = data.capacities.findIndex(
        (c) => c.warehouseId === params.warehouse && c.resourceId === params.resource,
      );
      if (index < 0) return notFound('warehouse capacity');
      data.capacities.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${admin}/flows`, ({ request }) => {
      seen(request);
      const village = new URL(request.url).searchParams.get('village');
      return listed(data.flows.filter((f) => !village || f.villageId === village));
    }),
    http.post(`${admin}/flows`, async ({ request }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body || !isNumber(body.ratePerHour)) return badRequest('ratePerHour: a number');
      const source = body.source ?? 'manual';
      if (source !== 'population' && source !== 'industry' && source !== 'manual') {
        return badRequest('source: population, industry or manual');
      }
      if (!isVillage(body.villageId) || !isResource(body.resourceId)) {
        return invalidReference('flow refused by the database');
      }
      const flow: Flow = {
        id: crypto.randomUUID(),
        villageId: body.villageId as string,
        resourceId: body.resourceId as string,
        ratePerHour: body.ratePerHour as number,
        carry: 0,
        source,
        label: typeof body.label === 'string' && body.label ? body.label : null,
      };
      data.flows.push(flow);
      return HttpResponse.json(flow, { status: 201 });
    }),
    // `update_flow`: absent fields kept, a `null` or empty label cleared, others refused.
    http.put(`${admin}/flows/:id`, async ({ request, params }) => {
      seen(request);
      const body = await bodyOf(request);
      if (!body || Object.keys(body).some((k) => k !== 'ratePerHour' && k !== 'label')) {
        return badRequest('body: ratePerHour and label only');
      }
      if (body.ratePerHour !== undefined && !isNumber(body.ratePerHour)) {
        return badRequest('ratePerHour: a number');
      }
      const flow = data.flows.find((f) => f.id === params.id);
      if (!flow) return notFound(`flow ${String(params.id)}`);
      if (body.ratePerHour !== undefined) flow.ratePerHour = body.ratePerHour as number;
      if ('label' in body)
        flow.label = typeof body.label === 'string' && body.label ? body.label : null;
      return HttpResponse.json(flow);
    }),
    http.delete(`${admin}/flows/:id`, ({ request, params }) => {
      seen(request);
      wrote(request);
      const index = data.flows.findIndex((f) => f.id === params.id);
      if (index < 0) return notFound(`flow ${String(params.id)}`);
      data.flows.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];

  return { handlers, data, tokens, writes };
}
