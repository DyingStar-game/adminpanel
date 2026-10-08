import * as oidc from 'openid-client';
import { decodeJwt } from 'jose';

/** What the BFF keeps of a token response (ADR 0023: tokens never leave the BFF). */
export interface OidcTokens {
  accessToken: string;
  refreshToken: string | undefined;
  idToken: string | undefined;
  /** Epoch ms after which the access token is no longer valid. */
  expiresAt: number;
  /** Who signed in, from the ID token (kept from the previous tokens on a refresh without one). */
  user: { id: string; username: string; name: string | null } | undefined;
  /** Realm roles, and client roles per client, read from the access token. */
  realmRoles: string[];
  clientRoles: Record<string, string[]>;
}

export interface AuthorizationInput {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface CallbackChecks {
  codeVerifier: string;
  state: string;
  nonce: string;
}

/** The OpenID Connect operations the BFF needs; faked in tests. */
export interface OidcProvider {
  authorizationUrl(input: AuthorizationInput): Promise<URL>;
  /** Exchanges the code of `callbackUrl` (the redirect URI plus Keycloak's query). */
  exchange(callbackUrl: URL, checks: CallbackChecks): Promise<OidcTokens>;
  /** New tokens from the refresh token of `previous`, keeping what the response leaves out. */
  refresh(previous: OidcTokens & { refreshToken: string }): Promise<OidcTokens>;
  endSessionUrl(input: {
    idToken: string | undefined;
    postLogoutRedirectUri: string;
  }): Promise<URL>;
}

export interface OidcProviderOptions {
  /** Issuer the tokens carry, as the browser sees Keycloak. */
  issuer: string;
  /**
   * Where the BFF reads the discovery document, when it reaches Keycloak by another name than
   * the browser (`http://keycloak:8080/realms/dyingstar` in compose). Defaults to the issuer.
   */
  discoveryUrl?: string | undefined;
  clientId: string;
  clientSecret: string;
}

type TokenResponse = Awaited<ReturnType<typeof oidc.refreshTokenGrant>>;

const SCOPE = 'openid profile email';

/** Reads the parts of a token response the BFF keeps. */
function toTokens(response: TokenResponse, previous?: OidcTokens): OidcTokens {
  const claims = response.claims();
  const access = decodeJwt(response.access_token);
  const realmAccess = access.realm_access as { roles?: string[] } | undefined;
  const resourceAccess = access.resource_access as Record<string, { roles?: string[] }> | undefined;
  const expiresIn = response.expiresIn() ?? (access.exp ? access.exp - Date.now() / 1000 : 300);
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previous?.refreshToken,
    idToken: response.id_token ?? previous?.idToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user: claims
      ? {
          id: claims.sub,
          username:
            typeof claims.preferred_username === 'string' ? claims.preferred_username : claims.sub,
          name: typeof claims.name === 'string' && claims.name ? claims.name : null,
        }
      : previous?.user,
    realmRoles: realmAccess?.roles ?? [],
    clientRoles: Object.fromEntries(
      Object.entries(resourceAccess ?? {}).map(([client, { roles = [] }]) => [client, roles]),
    ),
  };
}

/**
 * Keycloak through `openid-client`, as a confidential client (authorization code + PKCE). The
 * discovery document is read on first use and read again after a failure, so the BFF starts
 * even when Keycloak is not up yet.
 */
export function createOidcProvider(options: OidcProviderOptions): OidcProvider {
  let config: Promise<oidc.Configuration> | null = null;

  const load = async () => {
    const base = (options.discoveryUrl ?? options.issuer).replace(/\/$/, '');
    const res = await fetch(`${base}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status} at ${base}`);
    const metadata = (await res.json()) as oidc.ServerMetadata;
    // The issuer is checked by hand since the document may come from another host name.
    if (metadata.issuer !== options.issuer) {
      throw new Error(`OIDC issuer mismatch: expected ${options.issuer}, got ${metadata.issuer}`);
    }
    const configuration = new oidc.Configuration(metadata, options.clientId, options.clientSecret);
    // Local Keycloak only (http://localhost:8080): shared Keycloaks are served over HTTPS.
    if (new URL(options.issuer).protocol === 'http:') oidc.allowInsecureRequests(configuration);
    return configuration;
  };

  const configuration = () => {
    config ??= load().catch((error: unknown) => {
      config = null;
      throw error;
    });
    return config;
  };

  return {
    async authorizationUrl({ redirectUri, state, nonce, codeChallenge }) {
      return oidc.buildAuthorizationUrl(await configuration(), {
        redirect_uri: redirectUri,
        scope: SCOPE,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
    },
    async exchange(callbackUrl, { codeVerifier, state, nonce }) {
      const response = await oidc.authorizationCodeGrant(await configuration(), callbackUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce,
        idTokenExpected: true,
      });
      return toTokens(response);
    },
    async refresh(previous) {
      const response = await oidc.refreshTokenGrant(await configuration(), previous.refreshToken);
      return toTokens(response, previous);
    },
    async endSessionUrl({ idToken, postLogoutRedirectUri }) {
      return oidc.buildEndSessionUrl(await configuration(), {
        post_logout_redirect_uri: postLogoutRedirectUri,
        client_id: options.clientId,
        ...(idToken ? { id_token_hint: idToken } : {}),
      });
    },
  };
}
