import type { ObjectData, ObjectDefinition } from '@dyingstar-admin/schemas';

export interface PropertySection {
  /** Replication zone, or null for keys the definition does not declare. */
  zone: number | null;
  distance?: number;
  frequency?: number;
  keys: string[];
}

/**
 * Groups an item's keys by replication channel (ADR 0006). A property listed in several
 * channels belongs to the last one, as in horizonserver (its property → zone index is a plain
 * map). Keys absent from the definition come last: persistence keeps them, the game does not
 * replicate them.
 */
export function groupByChannel(
  data: ObjectData,
  definition: ObjectDefinition | null | undefined,
): PropertySection[] {
  const channels = definition?.channels ?? [];
  const zoneOf = new Map<string, number>();
  channels.forEach((channel, index) => channel.properties.forEach((p) => zoneOf.set(p, index)));

  const present = Object.keys(data);
  const sections: PropertySection[] = channels.flatMap((channel, index) => {
    const keys = present.filter((key) => zoneOf.get(key) === index);
    return keys.length > 0
      ? [{ zone: channel.zone, distance: channel.distance, frequency: channel.frequency, keys }]
      : [];
  });

  const undeclared = present.filter((key) => !zoneOf.has(key));
  if (undeclared.length > 0) sections.push({ zone: null, keys: undeclared });
  return sections;
}
