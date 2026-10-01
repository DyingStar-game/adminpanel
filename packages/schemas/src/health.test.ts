import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health';

describe('HealthResponseSchema', () => {
  it('accepts a healthy response', () => {
    expect(HealthResponseSchema.parse({ status: 'ok', version: '0.1.0' })).toEqual({
      status: 'ok',
      version: '0.1.0',
    });
  });

  it('rejects an unknown status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'down', version: '0.1.0' }).success).toBe(
      false,
    );
  });
});
