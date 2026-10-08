import { describe, expect, it } from 'vitest';
import { authEnv, loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toMatchObject({
      PORT: 3000,
      GAME_SERVER_NAME: 'Game server',
      PERSISTENCE_TIMEOUT_MS: 5000,
      READ_CACHE_TTL_MS: 500,
      DEFINITIONS_REF: 'develop',
      ENVIRONMENT: 'testing',
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

  it('requires the Keycloak settings', () => {
    expect(() =>
      authEnv(loadEnv({ OIDC_ISSUER: 'http://localhost:8080/realms/dyingstar' })),
    ).toThrow(/OIDC_CLIENT_ID, OIDC_CLIENT_SECRET/);
    const auth = authEnv(
      loadEnv({
        OIDC_ISSUER: 'http://localhost:8080/realms/dyingstar',
        OIDC_CLIENT_ID: 'dyingstar-admin',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_DISCOVERY_URL: '',
        PUBLIC_URL: 'https://admin.test/',
      }),
    );
    expect(auth).toMatchObject({
      discoveryUrl: undefined,
      publicUrl: 'https://admin.test',
    });
  });

  it('reads the game server and its service URLs', () => {
    expect(
      loadEnv({
        GAME_SERVER_NAME: 'Universe Testing',
        PERSISTENCE_URL: 'http://46.231.240.213:31001',
        SOCIAL_URL: '',
      }),
    ).toMatchObject({
      GAME_SERVER_NAME: 'Universe Testing',
      PERSISTENCE_URL: 'http://46.231.240.213:31001',
      SOCIAL_URL: undefined,
    });
    expect(loadEnv({ PERSISTENCE_URL: '' }).PERSISTENCE_URL).toBeUndefined();
    expect(() => loadEnv({ PERSISTENCE_URL: 'not a url' })).toThrow();
  });

  it('refuses the former SERVERS, saying what replaces it', () => {
    expect(() => loadEnv({ SERVERS: '[{"id":"universe-testing"}]' })).toThrow(
      /GAME_SERVER_NAME and PERSISTENCE_URL/,
    );
  });
});
