import { describe, expect, it } from 'vitest';
import type { ImportFinding } from '@dyingstar-admin/schemas';
import { findingKey, splitFindings } from './findings';

const at = (path?: string): ImportFinding => ({
  code: 'refNotFound',
  severity: 'warning',
  ...(path ? { path } : {}),
});

describe('findings of a form check', () => {
  it('finds the property row of a path', () => {
    expect(findingKey(at('object_data.apartments[0].player_uuid'))).toBe('apartments');
    expect(findingKey(at('object_data.components.slot_fl'))).toBe('components');
    expect(findingKey(at('object_uuid'))).toBeNull();
    expect(findingKey(at())).toBeNull();
  });

  it('keeps apart the findings without a row', () => {
    const { byKey, general } = splitFindings(
      [at('object_data.parent_id'), at('object_data.gone'), at('object_type')],
      ['parent_id', 'position'],
    );
    expect([...byKey.keys()]).toEqual(['parent_id']);
    expect(general.map((f) => f.path)).toEqual(['object_data.gone', 'object_type']);
  });
});
