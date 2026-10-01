import { describe, expect, it } from 'vitest';
import { ORBIT, orbitLayout, type OrbitEntity } from './orbitLayout';

const entity = (uuid: string, objectType = 'vehicle'): OrbitEntity => ({
  uuid,
  label: uuid,
  objectType,
});
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('orbitLayout', () => {
  it('places the centre, the parent above and clusters around', () => {
    const { nodes, edges } = orbitLayout({
      center: entity('c'),
      parent: entity('p', 'planet'),
      clusters: [
        { objectType: 'vehicle_component', total: 4 },
        { objectType: 'box', total: 3 },
      ],
      open: null,
      refs: [],
    });

    expect(nodes.find((n) => n.id === 'c')).toMatchObject({ kind: 'center', x: 0, y: 0 });
    expect(nodes.find((n) => n.id === 'p')).toMatchObject({
      kind: 'parent',
      x: 0,
      y: -ORBIT.parentRadius,
    });
    for (const id of ['cluster:vehicle_component', 'cluster:box']) {
      const node = nodes.find((n) => n.id === id);
      expect(node && Math.round(distance(node, { x: 0, y: 0 }))).toBe(ORBIT.clusterRadius);
      // Clusters stay below the parent's direction.
      expect(node && node.y).toBeGreaterThan(-ORBIT.clusterRadius);
    }
    expect(edges.map((e) => e.kind).sort()).toEqual(['cluster', 'cluster', 'parent']);
  });

  it('fans the open cluster children and adds a "more" node', () => {
    const items = Array.from({ length: 8 }, (_, i) => entity(`k${i}`, 'box'));
    const { nodes } = orbitLayout({
      center: entity('c'),
      parent: null,
      clusters: [{ objectType: 'box', total: 20 }],
      open: { objectType: 'box', items, hasMore: true },
      refs: [],
    });

    const cluster = nodes.find((n) => n.id === 'cluster:box');
    const kids = nodes.filter((n) => n.kind === 'child');
    expect(cluster).toMatchObject({ open: true });
    expect(cluster && Math.round(distance(cluster, { x: 0, y: 0 }))).toBe(ORBIT.openClusterRadius);
    expect(kids).toHaveLength(8);
    if (!cluster) throw new Error('cluster missing');
    kids.forEach((kid) => expect(Math.round(distance(kid, cluster))).toBe(ORBIT.childRadius));
    expect(nodes.some((n) => n.kind === 'more')).toBe(true);
  });

  it('adds references once, without duplicating entities already shown', () => {
    const { nodes, edges } = orbitLayout({
      center: entity('c'),
      parent: entity('p', 'planet'),
      clusters: [],
      open: null,
      refs: [
        { ...entity('pilot', 'player'), path: 'pilot_uuid' },
        { ...entity('pilot', 'player'), path: 'seats.SeatDriver' },
        { ...entity('p', 'planet'), path: 'spawn' },
      ],
    });

    const refNodes = nodes.filter((n) => n.kind === 'ref');
    expect(refNodes.map((n) => n.id)).toEqual(['pilot']);
    // Never on the parent's vertical axis.
    expect(refNodes[0]?.x).not.toBe(0);
    expect(edges.filter((e) => e.kind === 'ref')).toHaveLength(1);
  });
});
