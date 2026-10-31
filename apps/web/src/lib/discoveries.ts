import { factsOfModel } from '@/lib/bodies';

/** What the panel decides on a proposed place name (ADR 0032). */
export type PlaceNameDecision = 'approve' | 'refuse';

/**
 * A discovery's planet (`planet_name`, the game's body key such as `tarsis_3`) by its wiki
 * designation and name when the panel knows the body, as stored otherwise.
 */
export function planetLabel(planetName: string): string {
  const facts = factsOfModel(planetName);
  if (!facts) return planetName;
  return facts.name ? `${facts.designation} (${facts.name})` : facts.designation;
}

/** A unix time in seconds as an ISO date, or null for 0 (not yet). */
export const isoOfUnix = (seconds: number): string | null =>
  seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
