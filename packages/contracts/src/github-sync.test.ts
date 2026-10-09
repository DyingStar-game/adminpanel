import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SERVICES, SOURCE_REF, SOURCE_REPO } from './services';

/**
 * Alerts when a service's OpenAPI on GitHub (`DyingStar-game/services`, `develop`) no longer
 * matches the contract pinned here (ADR 0024): look at what changed for the routes the panel
 * uses, then `make contracts-update` and adapt. Skipped when GitHub cannot be reached.
 */
describe.each(SERVICES)('%s contract on GitHub', (service) => {
  it('matches the pinned openapi.yaml', async (context) => {
    const res = await fetch(
      `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_REF}/${service}/openapi.yaml`,
      { signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (!res?.ok) return context.skip('GitHub unreachable: contract not compared');

    const pinned = await readFile(new URL(`./${service}/openapi.yaml`, import.meta.url), 'utf8');
    expect(await res.text(), `${service}/openapi.yaml on GitHub vs pinned`).toBe(pinned);
  }, 30_000);
});
