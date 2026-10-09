import { describe, expect, it } from 'vitest';
import { UuidSchema } from './common';
import { createListItemsQuerySchema, createObjectTypeSchema, ItemSchema } from './persistence';

describe('UuidSchema', () => {
  it('accepts UUIDs outside RFC 4122 variants, as found in live data', () => {
    expect(UuidSchema.safeParse('35ac67f7-c1cf-20c0-1424-af07889a5c77').success).toBe(true);
    expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('ItemSchema', () => {
  it('accepts roots with an empty parent_id and arbitrary extra data', () => {
    const item = {
      object_type: 'planet',
      object_uuid: 'c0379c08-1d5b-4ca2-8876-230908141b68',
      object_data: { parent_id: '', rotations: [{ w: 1, x: 0, y: 0, z: 0 }], soi: 1 },
    };
    expect(ItemSchema.parse(item)).toEqual(item);
  });
});

describe('allowed object types', () => {
  const allowed = ['planet', 'vehicle'];

  it('accepts only the allowed types', () => {
    const schema = createObjectTypeSchema(allowed);
    expect(schema.safeParse('vehicle').success).toBe(true);
    const result = schema.safeParse('spaceship');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Unknown object_type "spaceship"');
  });

  it('does not restrict when no type is known', () => {
    expect(createObjectTypeSchema([]).safeParse('anything').success).toBe(true);
  });

  it('restricts the list filter and keeps it optional', () => {
    const schema = createListItemsQuerySchema(allowed);
    expect(schema.parse({})).toEqual({ page: 1, page_size: 100 });
    expect(schema.safeParse({ object_type: 'spaceship' }).success).toBe(false);
  });
});
