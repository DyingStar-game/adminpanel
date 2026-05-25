import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  keycloak: {
    baseUrl: process.env.KEYCLOAK_BASE_URL ?? 'http://keycloak:8080',
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli',
    secret: process.env.KEYCLOAK_ADMIN_SECRET ?? '',
  },
  githubToken: process.env.GITHUB_TOKEN ?? '',
  /** Default mesh service base (service-resourcesdynamic in dyingstar-dev-local). */
  resourcesDynamic: {
    baseUrl: process.env.RESOURCES_DYNAMIC_URL ?? 'http://service-resourcesdynamic:3001',
    /**
     * Path template to list active Horizon instances for a game server.
     * `{serverId}` is replaced with the admin server id.
     */
    activeHorizonsPath:
      process.env.RESOURCES_DYNAMIC_HORIZONS_PATH ?? '/api/servers/{serverId}/horizons/active',
  },
};
