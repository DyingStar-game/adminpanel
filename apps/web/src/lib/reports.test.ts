import { describe, expect, it } from 'vitest';
import { nextEscalation } from './reports';

describe('report workflow', () => {
  it('escalates one level, never above the supervisors', () => {
    expect(nextEscalation('moderator')).toBe('admin');
    expect(nextEscalation('admin')).toBe('supervisor');
    expect(nextEscalation('supervisor')).toBeNull();
  });
});
