import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDefinitionsService } from '../services/definitions';

/**
 * Updates the bundled snapshot of type definitions (`definitions/fallback.json`) from GitHub,
 * once a change reported by `definitions/github-sync.test.ts` has been looked at.
 * Run: `make definitions-update`.
 */
const repo = process.env.DEFINITIONS_REPO ?? 'DyingStar-game/horizonserver';
const path = process.env.DEFINITIONS_PATH ?? 'ds_genericprops/props';
const ref = process.env.DEFINITIONS_REF ?? 'develop';

const result = await createDefinitionsService({
  repo,
  path,
  ref,
  ttlMs: 60_000,
  githubToken: process.env.GITHUB_TOKEN || undefined,
}).list();
if (result.source !== 'github') throw new Error('GitHub unreachable: snapshot left unchanged');

// The commit the snapshot comes from, for the record.
const commits = await fetch(
  `https://api.github.com/repos/${repo}/commits?path=${path}&sha=${encodeURIComponent(ref)}&per_page=1`,
  { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dyingstar-admin' } },
);
const sha = commits.ok
  ? ((await commits.json()) as { sha: string }[])[0]?.sha.slice(0, 7)
  : undefined;

const target = fileURLToPath(new URL('../definitions/fallback.json', import.meta.url));
const snapshot = {
  source: `${repo} ${path} @ ${ref}${sha ? ` ${sha}` : ''}`,
  definitions: result.definitions,
};
await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`${result.definitions.length} definitions written to ${target} (${snapshot.source})`);
