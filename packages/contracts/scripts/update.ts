/**
 * Pins the OpenAPI contract of each game service from `DyingStar-game/services` (ADR 0024):
 * writes `src/<service>/openapi.yaml` and `src/<service>/source.json` (the commit it comes from).
 * `make contracts-update` then regenerates the Zod schemas (`openapi-ts`). Service names given
 * as arguments (`make contracts-update SERVICE=mission`) pin those only.
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  SERVICES,
  SOURCE_REFS,
  SOURCE_REPO,
  type ContractSource,
  type Service,
} from '../src/services';

const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const asked = process.argv.slice(2);
const unknown = asked.filter((name) => !(SERVICES as readonly string[]).includes(name));
if (unknown.length > 0) throw new Error(`Unknown service: ${unknown.join(', ')}`);
const services: readonly Service[] = asked.length > 0 ? (asked as Service[]) : SERVICES;

for (const service of services) {
  const ref = SOURCE_REFS[service];
  const path = `${service}/openapi.yaml`;
  const commits = await fetch(
    `https://api.github.com/repos/${SOURCE_REPO}/commits?sha=${ref}&path=${path}&per_page=1`,
    { headers },
  );
  if (!commits.ok) throw new Error(`GitHub answered ${commits.status} for ${path}`);
  const [last] = (await commits.json()) as {
    sha: string;
    commit: { committer: { date: string } };
  }[];
  const dir = new URL(`../src/${service}/`, import.meta.url);
  if (!last) {
    // A contract pinned before it was pushed (`commit: null`) keeps its local copy until then.
    const pinned = JSON.parse(
      await readFile(new URL('source.json', dir), 'utf8'),
    ) as ContractSource;
    if (pinned.commit === null) {
      console.warn(`${service}: ${path} not on ${ref} yet, pinned copy kept`);
      continue;
    }
    throw new Error(`No commit found for ${path} on ${ref}`);
  }
  const raw = await fetch(`https://raw.githubusercontent.com/${SOURCE_REPO}/${last.sha}/${path}`);
  if (!raw.ok) throw new Error(`GitHub answered ${raw.status} for ${path}@${last.sha}`);

  await writeFile(new URL('openapi.yaml', dir), await raw.text());
  await writeFile(
    new URL('source.json', dir),
    `${JSON.stringify({ repo: SOURCE_REPO, ref, path, commit: last.sha, date: last.commit.committer.date }, null, 2)}\n`,
  );
  console.log(
    `${service}: ${path} @ ${last.sha.slice(0, 7)} on ${ref} (${last.commit.committer.date})`,
  );
}
