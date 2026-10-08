import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { createOidcProvider } from './auth/oidc';
import { parseServers } from './config/servers';
import { authEnv, loadEnv } from './env';
import { createDefinitionsService } from './services/definitions';

const env = loadEnv();
const servers = parseServers(env.SERVERS, env.ENVIRONMENT);
const { issuer, discoveryUrl, clientId, clientSecret, ...session } = authEnv(env);
const app = createApp({
  environment: env.ENVIRONMENT,
  auth: createAuth({
    provider: createOidcProvider({ issuer, discoveryUrl, clientId, clientSecret }),
    clientId,
    ...session,
  }),
  servers,
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
  console.log(`Keycloak: ${issuer} (client ${clientId})`);
  console.log(`Game servers: ${servers.map((s) => s.id).join(', ') || 'none (set SERVERS)'}`);
});
