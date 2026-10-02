import { planet } from './planet';
import { player } from './player';
import { TypeProfileSchema, type TypeProfile } from './schema';
import { star } from './star';
import { vehicle } from './vehicle';

export type { Renderer, TypeProfile } from './schema';

/** Validated profiles; a typo in a profile file fails at load time (and in tests). */
const PROFILES: Map<string, TypeProfile> = new Map(
  [vehicle, player, planet, star].map((raw) => {
    const profile = TypeProfileSchema.parse(raw);
    return [profile.type, profile];
  }),
);

/** Profile of a type, or null: such types use the generic renderer only. */
export const profileFor = (objectType: string | undefined): TypeProfile | null =>
  (objectType && PROFILES.get(objectType)) || null;

const NO_COLUMNS: string[] = [];

/** Extra table columns of a type; a stable empty array when it has none (memo-friendly). */
export const tableColumnsFor = (objectType: string | undefined): string[] =>
  profileFor(objectType)?.columns ?? NO_COLUMNS;

/** Matches a reference path (`seats.SeatDriver`) against a profile pattern (`seats.*`). */
export function matchesPath(pattern: string, path: string): boolean {
  const a = pattern.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((segment, i) => segment === '*' || segment === b[i]);
}

/** Profile relation describing a reference path, if any. */
export const relationFor = (profile: TypeProfile | null, path: string) =>
  profile?.relations.find((r) => matchesPath(r.path, path)) ?? null;

/** Orders child types: profile's preferred types first, then alphabetically. */
export function orderChildTypes(profile: TypeProfile | null, types: string[]): string[] {
  const first = profile?.childrenFirst ?? [];
  const rank = (type: string) => {
    const index = first.indexOf(type);
    return index === -1 ? first.length : index;
  };
  return [...types].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
