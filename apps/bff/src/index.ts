import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { createOidcProvider } from './auth/oidc';
import { createServiceTokenSource } from './auth/serviceToken';
import { createSocialClient, registerStaffInSocial } from './clients/social';
import { authEnv, loadEnv } from './env';
import { createDefinitionsService } from './services/definitions';

const env = loadEnv();
const { issuer, discoveryUrl, clientId, clientSecret, ...session } = authEnv(env);
const social = env.SOCIAL_URL
  ? createSocialClient({
      baseUrl: env.SOCIAL_URL,
      timeoutMs: env.SERVICE_TIMEOUT_MS,
      serviceToken: env.SVC_ADMIN_CLIENT_SECRET
        ? createServiceTokenSource({
            issuer,
            discoveryUrl,
            clientId: env.SVC_ADMIN_CLIENT_ID,
            clientSecret: env.SVC_ADMIN_CLIENT_SECRET,
          })
        : undefined,
    })
  : undefined;
const app = createApp({
  environment: env.ENVIRONMENT,
  gameServerName: env.GAME_SERVER_NAME,
  persistenceUrl: env.PERSISTENCE_URL,
  social,
  auth: createAuth({
    provider: createOidcProvider({ issuer, discoveryUrl, clientId, clientSecret }),
    clientId,
    ...session,
    onSignIn: social && registerStaffInSocial(social),
  }),
  definitions: createDefinitionsService({
    repo: env.DEFINITIONS_REPO,
    path: env.DEFINITIONS_PATH,
    ref: env.DEFINITIONS_REF,
    ttlMs: env.DEFINITIONS_TTL_MS,
    githubToken: env.GITHUB_TOKEN,
  }),
  persistenceTimeoutMs: env.PERSISTENCE_TIMEOUT_MS,
  readCacheTtlMs: env.READ_CACHE_TTL_MS,
  staticDir: env.STATIC_DIR,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`DyingStar Admin BFF listening on http://localhost:${info.port}`);
  console.log(`Environment: ${env.ENVIRONMENT}`);
  console.log(`Game server: ${env.GAME_SERVER_NAME}`);
  console.log(`Persistence: ${env.PERSISTENCE_URL ?? 'not configured (items hidden)'}`);
  console.log(`Social: ${env.SOCIAL_URL ?? 'not configured (moderation hidden)'}`);
  console.log(
    `Organisation management: ${social?.manages ? env.SVC_ADMIN_CLIENT_ID : 'off (no SVC_ADMIN_CLIENT_SECRET)'}`,
  );
  console.log(`Keycloak: ${issuer} (client ${clientId})`);
});
