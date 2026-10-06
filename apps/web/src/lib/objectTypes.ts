/**
 * Colour of each object type, from the Claude Design mock-up. Types without an entry get a
 * stable colour derived from their name. Players, spawn buildings and villages stand side by
 * side on the planetary map (ADR 0018): green, blue and fuchsia, far apart.
 */
const TYPE_COLORS: Record<string, string> = {
  star: '#f59e0b',
  planet: '#0ea5e9',
  station: '#8b5cf6',
  city: '#6366f1',
  building: '#64748b',
  simple_building: '#06b6d4',
  spawnbuilding: '#2563eb',
  poi_village: '#c026d3',
  cargo_depot: '#f97316',
  storagewarehouse: '#a16207',
  storage_area: '#0d9488',
  mining_depot: '#ca8a04',
  miningzone: '#eab308',
  miningrock: '#78716c',
  shelf: '#94a3b8',
  crate_container: '#84cc16',
  box: '#ec4899',
  vehicle: '#e11d48',
  vehicle_component: '#fb923c',
  player: '#10b981',
};

/** Fallback palette for types the mock-up did not know. */
const FALLBACK_COLORS = ['#06b6d4', '#a855f7', '#22c55e', '#d946ef', '#0891b2', '#65a30d'];

/** FNV-1a hash, enough to spread type names over the fallback palette. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function typeColor(objectType: string): string {
  return (
    TYPE_COLORS[objectType] ??
    FALLBACK_COLORS[hash(objectType) % FALLBACK_COLORS.length] ??
    '#71717a'
  );
}
