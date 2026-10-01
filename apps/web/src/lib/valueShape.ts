import { QuaternionSchema, UuidSchema, Vec3Schema } from '@dyingstar-admin/schemas';

/**
 * Shape of a property value, driving the generic renderer (ADR 0008). Detection is
 * structural, so new properties render sensibly without any configuration.
 */
export type ValueShape =
  | { kind: 'null' }
  | { kind: 'empty' }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'timestamp'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'uuid'; value: string }
  | { kind: 'vec3'; value: { x: number; y: number; z: number } }
  | { kind: 'quaternion'; value: { w: number; x: number; y: number; z: number } }
  | { kind: 'array'; value: unknown[] }
  | { kind: 'object'; value: Record<string, unknown> };

const hasExactKeys = (value: object, keys: string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((k) => own.includes(k));
};

/** Keys holding Unix timestamps in seconds (e.g. `from_timestamp`). */
const isTimestampKey = (key: string | undefined) => !!key && /(^|_)timestamp$/.test(key);

export function valueShape(value: unknown, key?: string): ValueShape {
  if (value === null || value === undefined) return { kind: 'null' };
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') {
    return isTimestampKey(key) ? { kind: 'timestamp', value } : { kind: 'number', value };
  }
  if (typeof value === 'string') {
    if (value === '') return { kind: 'empty' };
    return UuidSchema.safeParse(value).success
      ? { kind: 'uuid', value }
      : { kind: 'string', value };
  }
  if (Array.isArray(value)) return { kind: 'array', value };
  if (typeof value === 'object') {
    if (hasExactKeys(value, ['w', 'x', 'y', 'z'])) {
      const q = QuaternionSchema.safeParse(value);
      if (q.success) return { kind: 'quaternion', value: q.data };
    }
    if (hasExactKeys(value, ['x', 'y', 'z'])) {
      const v = Vec3Schema.safeParse(value);
      if (v.success) return { kind: 'vec3', value: v.data };
    }
    return { kind: 'object', value: value as Record<string, unknown> };
  }
  return { kind: 'string', value: String(value) };
}

/** UUIDs referenced anywhere in a value (nested objects and arrays included). */
export function collectUuids(value: unknown, path = ''): { path: string; uuid: string }[] {
  const shape = valueShape(value);
  if (shape.kind === 'uuid') return [{ path, uuid: shape.value }];
  if (shape.kind === 'array') {
    return shape.value.flatMap((v, i) => collectUuids(v, `${path}[${i}]`));
  }
  if (shape.kind === 'object') {
    return Object.entries(shape.value).flatMap(([k, v]) =>
      collectUuids(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}
