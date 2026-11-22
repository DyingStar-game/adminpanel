import { describe, expect, it } from 'vitest';
import { itemLabel, labelSuffixRef, labelWithSuffix } from './itemLabel';

const item = (object_data: Record<string, unknown>) => ({
  object_type: 'vehicle',
  object_uuid: '4e9a9ff9-2c69-408d-bd3f-bffd3afc316d',
  object_data,
});

describe('itemLabel', () => {
  it('prefers the name, then the slot, then type and short UUID', () => {
    expect(itemLabel(item({ name: 'SandBox' }))).toBe('SandBox');
    expect(itemLabel(item({ slot_id: 'slot_fl' }))).toBe('slot_fl');
    expect(itemLabel(item({ name: '' }))).toBe('vehicle 4e9a9ff9');
  });

  it('completes a depot with its village, and nothing else', () => {
    const village = '4d4cd92f-75c1-49d7-9aa9-462b4b486e2f';
    const depot = {
      ...item({ name: 'cargo_depot', poi_uuid: village }),
      object_type: 'cargo_depot',
    };
    expect(labelSuffixRef(depot)).toBe(village);
    expect(labelWithSuffix(itemLabel(depot), 'M0001')).toBe('cargo_depot (M0001)');
    // Not attached to a village, or the village not read yet: the name alone.
    expect(
      labelSuffixRef({ ...depot, object_data: { name: 'cargo_depot', poi_uuid: '' } }),
    ).toBeUndefined();
    expect(labelWithSuffix('cargo_depot', undefined)).toBe('cargo_depot');
    // A type without the rule keeps its name, whatever it references.
    expect(labelSuffixRef(item({ name: 'Truck', poi_uuid: village }))).toBeUndefined();
  });
});
