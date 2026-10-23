import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SERVICES, SOURCE_REFS, SOURCE_REPO, type ContractSource } from './services';

/**
 * Alerts when a service's OpenAPI on GitHub (`DyingStar-game/services`, its branch in `SOURCE_REFS`) no longer
 * matches the contract pinned here (ADR 0024): look at what changed for the routes the panel
 * uses, then `make contracts-update` and adapt. Skipped when GitHub cannot be reached, and for a
 * contract pinned before it was pushed (`source.json` › `commit: null`) while GitHub does not
 * have it yet (404).
 */
describe.each(SERVICES)('%s contract on GitHub', (service) => {
  it('matches the pinned openapi.yaml', async (context) => {
    const source = JSON.parse(
      await readFile(new URL(`./${service}/source.json`, import.meta.url), 'utf8'),
    ) as ContractSource;
    const res = await fetch(
      `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_REFS[service]}/${service}/openapi.yaml`,
      { signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (res?.status === 404 && source.commit === null) {
      return context.skip(`${service}/openapi.yaml is not on GitHub yet: pinned from a local copy`);
    }
    if (!res?.ok) return context.skip('GitHub unreachable: contract not compared');

    const pinned = await readFile(new URL(`./${service}/openapi.yaml`, import.meta.url), 'utf8');
    expect(await res.text(), `${service}/openapi.yaml on GitHub vs pinned`).toBe(pinned);
  }, 30_000);
});
