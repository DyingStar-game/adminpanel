import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toMatchObject({
      PORT: 3000,
      SERVERS: '[]',
      PERSISTENCE_TIMEOUT_MS: 5000,
      READ_CACHE_TTL_MS: 500,
      DEFINITIONS_REF: 'develop',
    });
  });

  it('coerces numbers and treats an empty token as unset', () => {
    const env = loadEnv({ PORT: '4000', STATIC_DIR: '/app/public', GITHUB_TOKEN: '' });
    expect(env).toMatchObject({ PORT: 4000, STATIC_DIR: '/app/public' });
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow();
  });
});
