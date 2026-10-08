import * as oidc from 'openid-client';
import { oidcConfiguration, type OidcProviderOptions } from './oidc';

/** Renew the service token when it expires within this delay. */
const MARGIN_MS = 30_000;

/** Gives a valid access token of a service account. */
export type ServiceTokenSource = () => Promise<string>;

/**
 * Access tokens of a Keycloak service account (`client_credentials`), e.g. `svc-admin` for the
 * internal API of `social` (ADR 0023 › Social — management). Kept until shortly before they
 * expire; requests arriving meanwhile share the one in flight.
 */
export function createServiceTokenSource(options: OidcProviderOptions): ServiceTokenSource {
  const configuration = oidcConfiguration(options);
  let current: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  const fetchToken = async () => {
    const response = await oidc.clientCredentialsGrant(await configuration());
    const expiresIn = response.expiresIn() ?? 60;
    current = { token: response.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return response.access_token;
  };

  return () => {
    if (current && current.expiresAt - MARGIN_MS > Date.now())
      return Promise.resolve(current.token);
    pending ??= fetchToken().finally(() => {
      pending = null;
    });
    return pending;
  };
}
