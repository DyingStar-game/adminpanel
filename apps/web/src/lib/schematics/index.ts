import { SchematicSchema, type Schematic } from './schema';
import { truck } from './truck';

export type { Schematic } from './schema';

/** Every schematic, validated at load time: a typo in a file fails early (and in tests). */
export const SCHEMATICS: Schematic[] = [truck].map((raw) => SchematicSchema.parse(raw));

const matches = (pattern: string, scenename: string) => {
  const a = pattern.split('/');
  const b = scenename.split('/');
  return (
    a.length === b.length &&
    a.every((segment, i) => {
      const value = b[i] ?? '';
      if (!segment.includes('*')) return segment === value;
      const [prefix = '', suffix = ''] = segment.split('*');
      return value.startsWith(prefix) && value.endsWith(suffix);
    })
  );
};

/** Schematic of a model, if one is declared for its `scenename`. */
export const schematicFor = (scenename: unknown): Schematic | null =>
  typeof scenename === 'string'
    ? (SCHEMATICS.find((s) => matches(s.scenename, scenename)) ?? null)
    : null;

/** Reads a dotted path in `object_data` (`seats.SeatDriver`). */
export function valueAt(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

/** Model name from a `scenename`: `scenes/…/engine_t1.tscn` → `engine_t1`. */
export const sceneModel = (scenename: unknown): string | null =>
  typeof scenename === 'string'
    ? (scenename
        .split('/')
        .at(-1)
        ?.replace(/\.tscn$/, '') ?? null)
    : null;
