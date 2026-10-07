import type { ImportFinding } from '@dyingstar-admin/schemas';

/** Property row of a finding: `object_data.apartments[0].player_uuid` → `apartments`. */
export const findingKey = (finding: ImportFinding): string | null =>
  finding.path?.match(/^object_data\.([^.[]+)/)?.[1] ?? null;

/**
 * Findings by property row, and the others (no path, `object_type`, a key without row) shown
 * apart (ADR 0022).
 */
export function splitFindings(
  findings: ImportFinding[],
  keys: readonly string[],
): { byKey: Map<string, ImportFinding[]>; general: ImportFinding[] } {
  const byKey = new Map<string, ImportFinding[]>();
  const general: ImportFinding[] = [];
  for (const finding of findings) {
    const key = findingKey(finding);
    if (key && keys.includes(key)) byKey.set(key, [...(byKey.get(key) ?? []), finding]);
    else general.push(finding);
  }
  return { byKey, general };
}
