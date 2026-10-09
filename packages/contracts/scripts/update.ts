/**
 * Pins the OpenAPI contract of each game service from `DyingStar-game/services` (ADR 0024):
 * writes `src/<service>/openapi.yaml` and `src/<service>/source.json` (the commit it comes from).
 * `make contracts-update` then regenerates the Zod schemas (`openapi-ts`).
 */
import { writeFile } from 'node:fs/promises';
import { SERVICES, SOURCE_REPO, SOURCE_REF } from '../src/services';

const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

for (const service of SERVICES) {
  const path = `${service}/openapi.yaml`;
  const commits = await fetch(
    `https://api.github.com/repos/${SOURCE_REPO}/commits?sha=${SOURCE_REF}&path=${path}&per_page=1`,
    { headers },
  );
  if (!commits.ok) throw new Error(`GitHub answered ${commits.status} for ${path}`);
  const [last] = (await commits.json()) as {
    sha: string;
    commit: { committer: { date: string } };
  }[];
  if (!last) throw new Error(`No commit found for ${path} on ${SOURCE_REF}`);
  const raw = await fetch(`https://raw.githubusercontent.com/${SOURCE_REPO}/${last.sha}/${path}`);
  if (!raw.ok) throw new Error(`GitHub answered ${raw.status} for ${path}@${last.sha}`);

  const dir = new URL(`../src/${service}/`, import.meta.url);
  await writeFile(new URL('openapi.yaml', dir), await raw.text());
  await writeFile(
    new URL('source.json', dir),
    `${JSON.stringify({ repo: SOURCE_REPO, ref: SOURCE_REF, path, commit: last.sha, date: last.commit.committer.date }, null, 2)}\n`,
  );
  console.log(`${service}: ${path} @ ${last.sha.slice(0, 7)} (${last.commit.committer.date})`);
}
