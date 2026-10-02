import { describe, expect, it } from 'vitest';
import { ORBIT, orbitLayout, orbitRadii, type OrbitEntity } from './orbitLayout';

const entity = (uuid: string, objectType = 'vehicle'): OrbitEntity => ({
  uuid,
  label: uuid,
  objectType,
});
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('orbitRadii', () => {
  it('stays compact with few clusters and widens with many', () => {
    expect(orbitRadii(1).cluster).toBeLessThan(orbitRadii(10).cluster);
    // A lone open cluster has no neighbour: it stays on the ring.
    expect(orbitRadii(1).openCluster).toBe(orbitRadii(1).cluster);
    expect(orbitRadii(10).openCluster).toBeGreaterThan(orbitRadii(10).cluster);
  });
});

describe('orbitLayout', () => {
  it('places the centre, the parent above and clusters around', () => {
    const { nodes, edges } = orbitLayout({
      center: entity('c'),
      parent: entity('p', 'planet'),
      clusters: [
        { objectType: 'vehicle_component', total: 4 },
        { objectType: 'box', total: 3 },
      ],
      open: [],
      refs: [],
    });

    expect(nodes.find((n) => n.id === 'c')).toMatchObject({ kind: 'center', x: 0, y: 0 });
    expect(nodes.find((n) => n.id === 'p')).toMatchObject({
      kind: 'parent',
      x: 0,
      y: -orbitRadii(2).parent,
    });
    for (const id of ['cluster:vehicle_component', 'cluster:box']) {
      const node = nodes.find((n) => n.id === id);
      expect(node && Math.round(distance(node, { x: 0, y: 0 }))).toBe(orbitRadii(2).cluster);
      // Clusters stay below the parent's direction.
      expect(node && node.y).toBeGreaterThan(-orbitRadii(2).cluster);
    }
    expect(edges.map((e) => e.kind).sort()).toEqual(['cluster', 'cluster', 'parent']);
  });

  it('fans the open cluster children and adds a "more" node', () => {
    const items = Array.from({ length: 8 }, (_, i) => entity(`k${i}`, 'box'));
    const { nodes } = orbitLayout({
      center: entity('c'),
      parent: null,
      clusters: [{ objectType: 'box', total: 20 }],
      open: [{ objectType: 'box', items, hasMore: true }],
      refs: [],
    });

    const cluster = nodes.find((n) => n.id === 'cluster:box');
    const kids = nodes.filter((n) => n.kind === 'child');
    expect(cluster).toMatchObject({ open: true });
    expect(cluster && Math.round(distance(cluster, { x: 0, y: 0 }))).toBe(orbitRadii(1).cluster);
    expect(kids).toHaveLength(8);
    if (!cluster) throw new Error('cluster missing');
    kids.forEach((kid) => expect(Math.round(distance(kid, cluster))).toBe(ORBIT.childRadius));
    expect(nodes.some((n) => n.kind === 'more')).toBe(true);
  });

  it('opens several clusters at once, neighbours on alternate rings without overlap', () => {
    const page = (type: string) => ({
      objectType: type,
      items: Array.from({ length: 8 }, (_, i) => entity(`${type}${i}`, type)),
      hasMore: false,
    });
    const types = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { nodes } = orbitLayout({
      center: entity('c0'),
      parent: null,
      clusters: types.map((objectType) => ({ objectType, total: 8 })),
      open: [page('b'), page('c'), page('d')],
      refs: [],
    });

    const radius = (type: string) => {
      const cluster = nodes.find((n) => n.id === `cluster:${type}`);
      return cluster ? Math.round(distance(cluster, { x: 0, y: 0 })) : 0;
    };
    const radii = orbitRadii(types.length);
    // Positions are rounded to the pixel.
    const near = (actual: number, expected: number) =>
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    near(radius('b'), radii.openCluster);
    near(radius('c'), radii.openClusterOuter);
    near(radius('d'), radii.openCluster);
    near(radius('a'), radii.cluster);
    const kids = nodes.filter((n) => n.kind === 'child');
    expect(kids).toHaveLength(24);
    // Children of different clusters keep apart (a node is about 40 px tall).
    const typeOf = (node: (typeof kids)[number]) =>
      'entity' in node ? node.entity.objectType : '';
    for (const kid of kids) {
      for (const other of kids) {
        if (typeOf(kid) !== typeOf(other)) {
          expect(distance(kid, other)).toBeGreaterThan(40);
        }
      }
    }
  });

  it('keeps two open clusters far apart on the inner ring', () => {
    const page = (type: string) => ({
      objectType: type,
      items: [entity(`${type}0`, type)],
      hasMore: false,
    });
    const { nodes } = orbitLayout({
      center: entity('c0'),
      parent: null,
      clusters: [
        { objectType: 'a', total: 1 },
        { objectType: 'b', total: 1 },
      ],
      open: [page('a'), page('b')],
      refs: [],
    });
    const radius = (type: string) => {
      const cluster = nodes.find((n) => n.id === `cluster:${type}`);
      return cluster ? distance(cluster, { x: 0, y: 0 }) : 0;
    };
    // 240° apart: no overlap possible, both stay close to the centre.
    expect(Math.abs(radius('a') - orbitRadii(2).openCluster)).toBeLessThanOrEqual(1);
    expect(Math.abs(radius('b') - orbitRadii(2).openCluster)).toBeLessThanOrEqual(1);
  });

  it('keeps references in the free upper sector, clear of open clusters', () => {
    const page = (type: string) => ({
      objectType: type,
      items: Array.from({ length: 3 }, (_, i) => entity(`${type}${i}`, type)),
      hasMore: false,
    });
    const { nodes } = orbitLayout({
      center: entity('c0'),
      parent: entity('p0', 'planet'),
      clusters: [
        { objectType: 'vehicle_component', total: 3 },
        { objectType: 'miningrock', total: 3 },
      ],
      open: [page('vehicle_component'), page('miningrock')],
      refs: [{ ...entity('pilot', 'player'), path: 'pilot_uuid', role: 'pilot' }],
    });

    const ref = nodes.find((n) => n.kind === 'ref');
    if (!ref) throw new Error('reference missing');
    const deg = (Math.atan2(ref.y, ref.x) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(-150);
    expect(deg).toBeLessThan(-30);
    for (const other of nodes.filter((n) => n.kind === 'child' || n.kind === 'cluster')) {
      expect(distance(ref, other)).toBeGreaterThan(70);
    }
  });

  it('draws an entity referenced several times once, with every role on its edge', () => {
    const { nodes, edges } = orbitLayout({
      center: entity('c'),
      parent: entity('p', 'planet'),
      clusters: [],
      open: [],
      refs: [
        { ...entity('pilot', 'player'), path: 'pilot_uuid', role: 'pilot' },
        { ...entity('pilot', 'player'), path: 'seats.SeatDriver', role: 'SeatDriver' },
        { ...entity('p', 'planet'), path: 'spawn', role: 'spawn' },
      ],
    });

    const refNodes = nodes.filter((n) => n.kind === 'ref');
    expect(refNodes.map((n) => n.id)).toEqual(['pilot']);
    expect(refNodes[0]).toMatchObject({ roles: ['pilot', 'SeatDriver'] });
    // Never on the parent's vertical axis.
    expect(refNodes[0]?.x).not.toBe(0);
    const refEdges = edges.filter((e) => e.kind === 'ref');
    expect(refEdges).toHaveLength(1);
    expect(refEdges[0]?.label).toBe('pilot · SeatDriver');
  });
});
