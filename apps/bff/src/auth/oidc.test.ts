import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { generateKeyPair, SignJWT } from 'jose';
import { mswServer } from '../test/harness';
import { createOidcProvider } from './oidc';

// The browser reaches Keycloak on localhost, the BFF by its compose service name.
const ISSUER = 'http://localhost:8080/realms/dyingstar';
const INTERNAL = 'http://keycloak:8080/realms/dyingstar';
const CLIENT_ID = 'dyingstar-admin';

const { privateKey } = await generateKeyPair('RS256');

const sign = (claims: Record<string, unknown>) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

/** A Keycloak stand-in: discovery on the internal name, token endpoint, the last form it got. */
const keycloak = ({ issuer = ISSUER, idToken = true } = {}) => {
  const received: URLSearchParams[] = [];
  mswServer.use(
    http.get(`${INTERNAL}/.well-known/openid-configuration`, () =>
      HttpResponse.json({
        issuer,
        authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
        token_endpoint: `${INTERNAL}/protocol/openid-connect/token`,
        end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
        jwks_uri: `${INTERNAL}/protocol/openid-connect/certs`,
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      }),
    ),
    http.post(`${INTERNAL}/protocol/openid-connect/token`, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      received.push(form);
      const nonce = 'nonce-1';
      return HttpResponse.json({
        token_type: 'Bearer',
        expires_in: 300,
        refresh_token: form.get('grant_type') === 'refresh_token' ? 'refresh-2' : 'refresh-1',
        access_token: await sign({
          sub: 'user-1',
          aud: 'account',
          realm_access: { roles: ['player', 'moderator'] },
          resource_access: { [CLIENT_ID]: { roles: ['persistence:read'] } },
        }),
        ...(idToken
          ? {
              id_token: await sign({
                sub: 'user-1',
                aud: CLIENT_ID,
                nonce,
                preferred_username: 'dev-reader',
                name: 'Dev Reader',
              }),
            }
          : {}),
      });
    }),
  );
  return received;
};

const provider = () =>
  createOidcProvider({
    issuer: ISSUER,
    discoveryUrl: INTERNAL,
    clientId: CLIENT_ID,
    clientSecret: 'secret',
  });

describe('createOidcProvider', () => {
  it('builds the authorization URL on the browser-facing endpoint, with PKCE', async () => {
    keycloak();

    const url = await provider().authorizationUrl({
      redirectUri: 'http://localhost:5173/auth/callback',
      state: 'state-1',
      nonce: 'nonce-1',
      codeChallenge: 'challenge',
    });

    expect(url.origin + url.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: 'http://localhost:5173/auth/callback',
      state: 'state-1',
      nonce: 'nonce-1',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
  });

  it('exchanges the code and reads the user and its roles', async () => {
    const received = keycloak();

    const tokens = await provider().exchange(
      new URL('http://localhost:5173/auth/callback?code=abc&state=state-1'),
      { codeVerifier: 'verifier', state: 'state-1', nonce: 'nonce-1' },
    );

    expect(Object.fromEntries(received[0] ?? [])).toMatchObject({
      grant_type: 'authorization_code',
      code: 'abc',
      code_verifier: 'verifier',
      redirect_uri: 'http://localhost:5173/auth/callback',
      client_id: CLIENT_ID,
      client_secret: 'secret',
    });
    expect(tokens).toMatchObject({
      refreshToken: 'refresh-1',
      user: { id: 'user-1', username: 'dev-reader', name: 'Dev Reader' },
      realmRoles: ['player', 'moderator'],
      clientRoles: { [CLIENT_ID]: ['persistence:read'] },
    });
    expect(tokens.expiresAt).toBeGreaterThan(Date.now() + 290_000);
  });

  it('refuses a state that does not match', async () => {
    keycloak();

    await expect(
      provider().exchange(new URL('http://localhost:5173/auth/callback?code=abc&state=other'), {
        codeVerifier: 'verifier',
        state: 'state-1',
        nonce: 'nonce-1',
      }),
    ).rejects.toThrow();
  });

  it('keeps the user and the ID token when a refresh returns none', async () => {
    keycloak({ idToken: false });
    const previous = {
      accessToken: 'old',
      refreshToken: 'refresh-1',
      idToken: 'id-1',
      expiresAt: 0,
      user: { id: 'user-1', username: 'dev-reader', name: null },
      realmRoles: [],
      clientRoles: {},
    };

    const tokens = await provider().refresh(previous);

    expect(tokens).toMatchObject({
      refreshToken: 'refresh-2',
      idToken: 'id-1',
      user: previous.user,
      realmRoles: ['player', 'moderator'],
    });
  });

  it('refuses a discovery document of another issuer, and tries again later', async () => {
    keycloak({ issuer: 'http://elsewhere/realms/dyingstar' });
    const oidc = provider();
    const input = { redirectUri: 'x', state: 's', nonce: 'n', codeChallenge: 'c' };

    await expect(oidc.authorizationUrl(input)).rejects.toThrow(/issuer mismatch/);

    keycloak();
    await expect(oidc.authorizationUrl(input)).resolves.toBeInstanceOf(URL);
  });

  it('ends the Keycloak session with the ID token as hint', async () => {
    keycloak();

    const url = await provider().endSessionUrl({
      idToken: 'id-1',
      postLogoutRedirectUri: 'http://localhost:5173/',
    });

    expect(url.origin + url.pathname).toBe(`${ISSUER}/protocol/openid-connect/logout`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      id_token_hint: 'id-1',
      post_logout_redirect_uri: 'http://localhost:5173/',
      client_id: CLIENT_ID,
    });
  });
});
