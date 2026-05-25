import type { ServerEnvironment, ServerPublic } from '@dyingstar/shared';
import type { MessageKey } from '@/hooks/useI18n';

/** i18n keys under `servers.env*`. */
export function serverEnvironmentLabel(
  environment: ServerEnvironment | undefined,
  t: (key: MessageKey) => string,
): string | null {
  if (environment === 'production') return t('servers.envProduction');
  if (environment === 'testing') return t('servers.envTesting');
  return null;
}

/** Label for selects: "Universe Testing (Testing)". */
export function serverSelectLabel(server: ServerPublic, t: (key: MessageKey) => string): string {
  const env = serverEnvironmentLabel(server.environment, t);
  return env ? `${server.name} (${env})` : server.name;
}
