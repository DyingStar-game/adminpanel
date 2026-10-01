/**
 * Extra table columns per object type (ADR 0008, first profiles). Step 5 grows this into full
 * type profiles; types without an entry show the generic columns only.
 */
export const TABLE_COLUMNS: Record<string, string[]> = {
  vehicle: ['speed', 'engine', 'handbrake', 'odometer_km', 'pilot_uuid'],
  player: ['is_npc', 'action', 'seat'],
  planet: ['soi', 'from_timestamp'],
  star: [],
};

export const tableColumnsFor = (objectType: string | undefined) =>
  (objectType && TABLE_COLUMNS[objectType]) || [];
