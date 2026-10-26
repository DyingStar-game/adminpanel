import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { missionErrorKey } from './missionErrors';

describe('missionErrorKey', () => {
  it('tells a refusal from an unreachable service', () => {
    expect(missionErrorKey(new ApiError(403, null))).toBe('missions.forbidden');
    expect(missionErrorKey(new ApiError(502, null))).toBe('missions.unavailable');
    expect(missionErrorKey(new Error('offline'))).toBe('missions.unavailable');
  });
});
