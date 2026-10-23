import type { z } from 'zod';
import type { SchematicSchema } from './schema';

/**
 * A crate seen from above (ADR 0029): its load beside it, as a truck's bed shows its rocks. Two
 * models share `crate_container.gd`: the crate a mining depot packs one mineral into
 * (`hauling_box`) and the crates laid by the world (`crate_container`, empty so far).
 */
const base = {
  title: 'crate',
  size: [6, 6],
  shapes: [{ kind: 'cargo', at: [1, 1], size: [4, 4], label: 'crate', goods: 'content' }],
} satisfies Omit<z.input<typeof SchematicSchema>, 'id' | 'scenename'>;

export const haulingBox: z.input<typeof SchematicSchema> = {
  ...base,
  id: 'hauling_box',
  scenename: 'scenes/_universe/props/containers/hauling_box.tscn',
  // The depot writes the packed crate's weight; the world's crates have none.
  readouts: [{ kind: 'value', path: 'weight', label: 'mass', unit: 'kg' }],
};

export const crate: z.input<typeof SchematicSchema> = {
  ...base,
  id: 'crate_container',
  scenename: 'scenes/_universe/props/containers/crate_container.tscn',
};
