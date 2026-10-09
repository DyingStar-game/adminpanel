import { describe, expect, it } from 'vitest';
import { http, passthrough } from 'msw';
import { mswServer } from '../test/harness';
import { createDefinitionsService } from '../services/definitions';
import fallback from './fallback.json';

/**
 * Alerts when the type definitions on GitHub (`*_def.json`, ADR 0006) no longer match the
 * snapshot bundled with the admin: a type added, removed or changed upstream must be looked at
 * (profiles, schematics, map…), then the snapshot updated with `make definitions-update`.
 * Reads the real repository (one GitHub API call); skipped when GitHub cannot be reached.
 */
describe('type definitions on GitHub', () => {
  it('match the bundled snapshot', async (context) => {
    mswServer.use(
      http.all('https://api.github.com/*', () => passthrough()),
      http.all('https://raw.githubusercontent.com/*', () => passthrough()),
    );
    const github = await createDefinitionsService({
      repo: process.env.DEFINITIONS_REPO ?? 'DyingStar-game/horizonserver',
      path: process.env.DEFINITIONS_PATH ?? 'ds_genericprops/props',
      ref: process.env.DEFINITIONS_REF ?? 'develop',
      ttlMs: 60_000,
      githubToken: process.env.GITHUB_TOKEN || undefined,
    }).list();
    if (github.source !== 'github') {
      context.skip('GitHub unreachable (offline or rate-limited): definitions not compared');
    }

    const types = (list: { type: string }[]) => list.map((d) => d.type);
    // Types first, for a short message when one is added or removed; then the full content.
    expect
      .soft(types(github.definitions), 'types on GitHub vs bundled snapshot')
      .toEqual(types(fallback.definitions));
    expect(github.definitions, 'definitions on GitHub vs bundled snapshot').toEqual(
      fallback.definitions,
    );
  }, 30_000);
});
