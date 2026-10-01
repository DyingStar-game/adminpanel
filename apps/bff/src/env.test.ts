import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toEqual({ PORT: 3000 });
  });

  it('coerces the port and keeps the static dir', () => {
    expect(loadEnv({ PORT: '4000', STATIC_DIR: '/app/public' })).toEqual({
      PORT: 4000,
      STATIC_DIR: '/app/public',
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow();
  });
});
