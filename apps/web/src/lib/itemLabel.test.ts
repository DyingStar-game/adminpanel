import { describe, expect, it } from 'vitest';
import { itemLabel } from './itemLabel';

const item = (object_data: Record<string, unknown>) => ({
  object_type: 'vehicle',
  object_uuid: '4e9a9ff9-2c69-408d-bd3f-bffd3afc316d',
  object_data,
});

describe('itemLabel', () => {
  it('prefers the name, then the slot, then type and short UUID', () => {
    expect(itemLabel(item({ name: 'SandBox' }))).toBe('SandBox');
    expect(itemLabel(item({ slot_id: 'Slot_FL' }))).toBe('Slot_FL');
    expect(itemLabel(item({ name: '' }))).toBe('vehicle 4e9a9ff9');
  });
});
