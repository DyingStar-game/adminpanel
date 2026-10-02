/**
 * Radial layout of the orbit view (ADR 0008, mock-up 1a), computed by us; React Flow only
 * renders and makes it navigable. Pure function: easy to test and to tune.
 */
export interface OrbitEntity {
  uuid: string;
  label: string;
  objectType: string;
  /** Dangling reference: the item does not exist. */
  missing?: boolean;
}

export interface OrbitInput {
  center: OrbitEntity;
  parent: OrbitEntity | null;
  /** Children grouped by type, with their count. */
  clusters: { objectType: string; total: number }[];
  /** Clusters currently opened (several at once), with the page of children loaded for each. */
  open: OpenCluster[];
  /**
   * Outgoing references (pilot, seats, components…), already resolved. `role` names the
   * reference on the graph (e.g. `pilot`, `SeatDriver`).
   */
  refs: (OrbitEntity & { path: string; role: string })[];
}

export interface OpenCluster {
  objectType: string;
  items: OrbitEntity[];
  hasMore: boolean;
}

export type OrbitNode =
  | { id: string; kind: 'center'; x: number; y: number; entity: OrbitEntity }
  | {
      id: string;
      kind: 'parent' | 'child' | 'ref';
      x: number;
      y: number;
      entity: OrbitEntity;
      /** References only: every role under which the centre points to this entity. */
      roles?: string[];
    }
  | {
      id: string;
      kind: 'cluster';
      x: number;
      y: number;
      objectType: string;
      total: number;
      open: boolean;
    }
  | { id: string; kind: 'more'; x: number; y: number; objectType: string };

export interface OrbitEdge {
  id: string;
  source: string;
  target: string;
  kind: 'parent' | 'cluster' | 'child' | 'ref';
  /** References only: roles joined, e.g. `pilot · SeatDriver`. */
  label?: string;
}

export const ORBIT = {
  childRadius: 150,
  /** Children shown around an open cluster per page. */
  pageSize: 8,
} as const;

/** Gap kept between references and the first / last cluster or the parent, in degrees. */
const REF_MARGIN_DEG = 16;

/** Children of two open clusters closer than this would overlap (node and its label). */
const NODE_CLEARANCE = 70;

/** Below this many clusters, an open cluster has no neighbour to clear and stays on the ring. */
const CROWDED_CLUSTERS = 4;

/**
 * Distances adapted to the number of clusters: compact when there are few, wider when many
 * (adjacent clusters keep room for their label), so the fitted view has no large empty areas.
 */
export function orbitRadii(clusterCount: number) {
  const cluster = Math.min(260, 170 + 15 * Math.max(0, clusterCount - 3));
  const parent = 180;
  return {
    parent,
    cluster,
    /** An open cluster moves outwards only when neighbours would overlap its children. */
    openCluster: clusterCount >= CROWDED_CLUSTERS ? cluster + 160 : cluster,
    /** Second ring for an open cluster whose previous neighbour is open too (no overlap). */
    openClusterOuter:
      (clusterCount >= CROWDED_CLUSTERS ? cluster + 160 : cluster) + 2 * ORBIT.childRadius + 40,
    ref: Math.max(cluster, parent) + 120,
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: Math.round(cx + r * Math.cos(rad(deg))),
  y: Math.round(cy + r * Math.sin(rad(deg))),
});

/** `count` angles evenly spread over [from, to] (centred when there is a single one). */
function spread(count: number, from: number, to: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [(from + to) / 2];
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

/** Positions of `slots` children fanned outwards (±80°) around a cluster at `angle`. */
function fan(position: { x: number; y: number }, angle: number, slots: number) {
  return spread(slots, angle - 80, angle + 80).map((a) =>
    polar(position.x, position.y, ORBIT.childRadius, a),
  );
}

export function orbitLayout(input: OrbitInput): { nodes: OrbitNode[]; edges: OrbitEdge[] } {
  const radii = orbitRadii(input.clusters.length);
  const centerId = input.center.uuid;
  const nodes: OrbitNode[] = [{ id: centerId, kind: 'center', x: 0, y: 0, entity: input.center }];
  const edges: OrbitEdge[] = [];

  // Parent straight above the centre.
  if (input.parent) {
    nodes.push({
      id: input.parent.uuid,
      kind: 'parent',
      ...polar(0, 0, radii.parent, -90),
      entity: input.parent,
    });
    edges.push({
      id: `parent:${input.parent.uuid}`,
      source: input.parent.uuid,
      target: centerId,
      kind: 'parent',
    });
  }

  // Children clusters around the right, bottom and left sides (the top is the parent's).
  const clusterAngles = spread(input.clusters.length, -30, 210);
  const opened = new Map(input.open.map((o) => [o.objectType, o]));
  // Previous open cluster: an open cluster goes to the outer ring only when the children of the
  // previous one (on the inner ring) would overlap its own, so neighbours alternate.
  let previous: { fan: { x: number; y: number }[]; ring: 'inner' | 'outer' } | null = null;
  input.clusters.forEach((cluster, i) => {
    const angle = clusterAngles[i] ?? 0;
    const id = `cluster:${cluster.objectType}`;
    const openCluster = opened.get(cluster.objectType);
    const open = !!openCluster;
    const slots = openCluster
      ? Math.min(openCluster.items.length, ORBIT.pageSize) + (openCluster.hasMore ? 1 : 0)
      : 0;
    let ring: 'inner' | 'outer' | null = null;
    if (open) {
      const innerFan = fan(polar(0, 0, radii.openCluster, angle), angle, slots);
      const clash =
        previous?.ring === 'inner' &&
        innerFan.some((a) =>
          previous?.fan.some((b) => Math.hypot(a.x - b.x, a.y - b.y) < NODE_CLEARANCE),
        );
      ring = clash ? 'outer' : 'inner';
      previous = {
        ring,
        fan:
          ring === 'inner'
            ? innerFan
            : fan(polar(0, 0, radii.openClusterOuter, angle), angle, slots),
      };
    }
    const position = polar(
      0,
      0,
      ring === 'outer'
        ? radii.openClusterOuter
        : ring === 'inner'
          ? radii.openCluster
          : radii.cluster,
      angle,
    );
    nodes.push({
      id,
      kind: 'cluster',
      ...position,
      objectType: cluster.objectType,
      total: cluster.total,
      open,
    });
    edges.push({ id: `edge:${id}`, source: centerId, target: id, kind: 'cluster' });

    // An open cluster fans its children outwards, away from the centre.
    if (openCluster) {
      const items = openCluster.items.slice(0, ORBIT.pageSize);
      const points = fan(position, angle, slots);
      items.forEach((entity, j) => {
        nodes.push({
          id: entity.uuid,
          kind: 'child',
          ...(points[j] ?? position),
          entity,
        });
        edges.push({ id: `child:${entity.uuid}`, source: id, target: entity.uuid, kind: 'child' });
      });
      if (openCluster.hasMore) {
        nodes.push({
          id: `more:${cluster.objectType}`,
          kind: 'more',
          ...(points[slots - 1] ?? position),
          objectType: cluster.objectType,
        });
      }
    }
  });

  // References on the outer upper arcs, left and right of the parent's axis, skipping
  // entities already shown (the parent, children of the open cluster). An entity referenced
  // several times (pilot and driver seat) is one node whose edge lists every role.
  const shown = new Set(nodes.map((n) => n.id));
  const grouped = new Map<string, { entity: OrbitEntity; roles: string[] }>();
  for (const ref of input.refs) {
    if (shown.has(ref.uuid)) continue;
    const entry = grouped.get(ref.uuid) ?? { entity: ref, roles: [] };
    if (!entry.roles.includes(ref.role)) entry.roles.push(ref.role);
    grouped.set(ref.uuid, entry);
  }
  const refs = [...grouped.values()];
  const left = Math.ceil(refs.length / 2);
  // With two clusters or more, the first and last sit at -30° and 210°: references stay in the
  // free upper sector between them, on both sides of the parent's axis.
  type Arc = [from: number, to: number];
  const [leftArc, rightArc]: [Arc, Arc] =
    input.clusters.length >= 2
      ? [
          [-150 + REF_MARGIN_DEG, -90 - REF_MARGIN_DEG],
          [-90 + REF_MARGIN_DEG, -30 - REF_MARGIN_DEG],
        ]
      : [
          [-175, -112],
          [-68, -5],
        ];
  const refAngles = [...spread(left, ...leftArc), ...spread(refs.length - left, ...rightArc)];
  // Far enough for neighbouring references to keep apart on their narrow arc, and beyond the
  // children of open clusters that rise into the upper sector.
  const arc = rad(leftArc[1] - leftArc[0]);
  const spacing = left > 1 ? (NODE_CLEARANCE * (left - 1)) / arc : 0;
  const fanTop = nodes
    .filter((n) => n.kind === 'child' || n.kind === 'more')
    .filter((n) => {
      const deg = (Math.atan2(n.y, n.x) * 180) / Math.PI;
      return deg > -160 && deg < -20;
    })
    .reduce((max, n) => Math.max(max, Math.hypot(n.x, n.y) + NODE_CLEARANCE), 0);
  const refRadius = Math.max(radii.ref, spacing, fanTop);
  refs.forEach(({ entity, roles }, i) => {
    nodes.push({
      id: entity.uuid,
      kind: 'ref',
      ...polar(0, 0, refRadius, refAngles[i] ?? -120),
      entity,
      roles,
    });
    edges.push({
      id: `ref:${entity.uuid}`,
      source: centerId,
      target: entity.uuid,
      kind: 'ref',
      label: roles.join(' · '),
    });
  });

  return { nodes, edges };
}
