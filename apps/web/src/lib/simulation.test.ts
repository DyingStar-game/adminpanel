import { describe, expect, it } from 'vitest';
import {
  entityScope,
  formatAutonomy,
  formatRate,
  legWeight,
  lineChartGeometry,
  networkLayers,
  niceTicks,
  stockHealth,
} from './simulation';

describe('stockHealth', () => {
  it('tells empty, below the threshold, full and fine apart', () => {
    expect(stockHealth(undefined)).toBe('none');
    expect(stockHealth({ quantity: 600, available: 0, minThreshold: 300 })).toBe('empty');
    expect(stockHealth({ quantity: 120, available: 120, minThreshold: 300 })).toBe('below');
    expect(stockHealth({ quantity: 2_000, available: 2_000, capacity: 2_000 })).toBe('full');
    expect(stockHealth({ quantity: 900, available: 900, minThreshold: 200 })).toBe('ok');
  });
});

describe('formats', () => {
  it('signs rates and turns long autonomies into days', () => {
    expect(formatRate(250, 'en')).toBe('+250/h');
    expect(formatRate(-30, 'en')).toBe('-30/h');
    expect(formatAutonomy(4, 'en')).toBe('4 h');
    expect(formatAutonomy(72, 'en')).toBe('3 d');
  });

  it('thickens legs with their quantity', () => {
    expect(legWeight(0, 600)).toBe(2);
    expect(legWeight(600, 600)).toBe(8);
    expect(legWeight(150, 600)).toBe(5);
  });
});

describe('entityScope', () => {
  it('holds the entity and everything under it', () => {
    const entities = [
      { id: 'city', type: 'agglomeration', name: 'City' },
      { id: 'a', type: 'commune', name: 'A', parentId: 'city' },
      { id: 'b', type: 'commune', name: 'B', parentId: 'a' },
      { id: 'c', type: 'commune', name: 'C', parentId: null },
    ];
    expect([...entityScope(entities, 'city')].sort()).toEqual(['a', 'b', 'city']);
  });
});

describe('lineChartGeometry', () => {
  it('scales time and value into the box, references included', () => {
    const g = lineChartGeometry(
      [
        { t: 0, v: 100 },
        { t: 10, v: 200 },
      ],
      [300],
      { width: 200, height: 100, padding: { left: 20, right: 0, top: 0, bottom: 20 } },
    );
    expect(g.x(0)).toBe(20);
    expect(g.x(10)).toBe(200);
    expect(g.y(0)).toBe(80);
    expect(g.y(300)).toBeGreaterThan(0);
    expect(g.path.startsWith('M20 ')).toBe(true);
    expect(g.ticks[0]).toBe(0);
  });

  it('picks round ticks', () => {
    expect(niceTicks(0, 1_000, 4)).toEqual([0, 500, 1_000]);
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe('networkLayers', () => {
  const village = (
    id: string,
    stocks: {
      resourceId: string;
      quantity: number;
      held: number;
      available: number;
      minThreshold?: number;
      netFlowPerHour: number;
    }[] = [],
    warehouses: string[] = [],
  ) => ({
    id,
    code: id,
    name: `V ${id}`,
    federationId: 'f',
    politicalEntityId: 'e',
    population: 10,
    active: true,
    mainWarehouseId: warehouses[0] ?? null,
    stocks,
    warehouses: warehouses.map((w) => ({
      id: w,
      villageId: id,
      code: w,
      name: `W ${w}`,
      active: true,
    })),
  });
  const network = {
    federationId: 'f',
    villages: [
      village(
        'a',
        [
          {
            resourceId: 'water',
            quantity: 10,
            held: 0,
            available: 10,
            minThreshold: 50,
            netFlowPerHour: 0,
          },
        ],
        ['a1', 'a2'],
      ),
      village('b'),
      village('c'),
    ],
    routes: [
      {
        id: 'r1',
        fromVillageId: 'a',
        toVillageId: 'b',
        distanceM: 1,
        cost: 1,
        bidirectional: true,
        active: true,
      },
      {
        id: 'r2',
        fromVillageId: 'b',
        toVillageId: 'c',
        distanceM: 1,
        cost: 1,
        bidirectional: true,
        active: true,
      },
    ],
    activeLegs: [
      {
        legId: 'l1',
        orderId: 'o',
        kind: 'transport' as const,
        resourceId: 'water',
        fromVillageId: 'a',
        toVillageId: 'b',
        quantity: 100,
        status: 'published' as const,
      },
      {
        legId: 'l2',
        orderId: 'o',
        kind: 'transport' as const,
        resourceId: 'water',
        fromVillageId: 'b',
        toVillageId: 'a',
        quantity: 25,
        status: 'waiting' as const,
      },
      {
        legId: 'l3',
        orderId: 'm',
        kind: 'mining' as const,
        resourceId: 'water',
        fromVillageId: null,
        toVillageId: 'a',
        quantity: 500,
        status: 'published' as const,
      },
    ],
    projection: {
      body: { object_uuid: 'p', name: 'P' },
      referenceRadius: 1,
      center: { lat: 0, lon: 0 },
    },
    projectionIssue: null,
    positions: [
      { id: 'a', kind: 'village' as const, lat: 0, lon: 0, altitude: 0, x: 10, y: 20 },
      { id: 'b', kind: 'village' as const, lat: 0, lon: 0, altitude: 0, x: 30, y: 40 },
      { id: 'a1', kind: 'warehouse' as const, lat: 0, lon: 0, altitude: 0, x: 11, y: 21 },
    ],
  };

  it('draws the placed villages, their depots, the routes and legs between them, weighted', () => {
    const layers = networkLayers(network, 'water');
    expect(layers.villages.map((v) => [v.id, v.at, v.health])).toEqual([
      ['a', [20, 10], 'below'],
      ['b', [40, 30], 'none'],
    ]);
    expect(layers.warehouses.map((w) => [w.id, w.villageId, w.main])).toEqual([['a1', 'a', true]]);
    expect(layers.routes.map((r) => r.id)).toEqual(['r1']);
    expect(layers.legs.map((l) => [l.legId, l.weight])).toEqual([
      ['l1', 8],
      ['l2', 5],
    ]);
    expect(layers.unplaced).toBe(1);
  });
});
