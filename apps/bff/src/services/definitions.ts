import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import { z } from 'zod';
import {
  DefinitionFileSchema,
  ObjectDefinitionSchema,
  typeFromDefinitionFile,
  type DefinitionsResponse,
  type ObjectDefinition,
} from '@dyingstar-admin/schemas';
import fallback from '../definitions/fallback.json';

export interface DefinitionsOptions {
  repo: string;
  path: string;
  ref: string;
  ttlMs: number;
  githubToken?: string | undefined;
  fetch?: typeof fetch;
}

const ContentsSchema = z.array(
  z.object({ name: z.string(), type: z.string(), download_url: z.string().nullable() }),
);

const FALLBACK: DefinitionsResponse = {
  definitions: z.array(ObjectDefinitionSchema).parse(fallback.definitions),
  source: 'fallback',
};
/** How long the bundled snapshot is served before GitHub is tried again. */
const FALLBACK_TTL_MS = 60_000;
const KEY = 'definitions';

/**
 * Object type definitions (`<type>_def.json`) read from GitHub and cached (ADR 0006).
 * When a refresh fails the last good result is kept; without one, the bundled snapshot is
 * served for a minute. A malformed definition file is skipped, never fatal.
 */
export function createDefinitionsService({
  repo,
  path,
  ref,
  ttlMs,
  githubToken,
  fetch: fetchImpl,
}: DefinitionsOptions) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dyingstar-admin',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };
  // Resolved per call so a fetch patched later (tests, instrumentation) is honoured.
  const get = (url: string) =>
    (fetchImpl ?? globalThis.fetch)(url, { headers, signal: AbortSignal.timeout(10_000) });
  const limit = pLimit(6);

  async function readFile(type: string, url: string): Promise<ObjectDefinition | null> {
    try {
      const res = await get(url);
      if (!res.ok) return null;
      const parsed = DefinitionFileSchema.safeParse(await res.json());
      return parsed.success ? { type, ...parsed.data } : null;
    } catch {
      return null;
    }
  }

  async function readFromGitHub(): Promise<DefinitionsResponse> {
    const res = await get(
      `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const files = ContentsSchema.parse(await res.json()).flatMap((file) => {
      const type = typeFromDefinitionFile(file.name);
      return type && file.type === 'file' && file.download_url
        ? [{ type, url: file.download_url }]
        : [];
    });
    const definitions = await Promise.all(files.map((f) => limit(() => readFile(f.type, f.url))));
    return {
      definitions: definitions
        .filter((d): d is ObjectDefinition => d !== null)
        .sort((a, b) => a.type.localeCompare(b.type)),
      source: 'github',
    };
  }

  const cache = new LRUCache<string, DefinitionsResponse>({
    max: 1,
    ttl: ttlMs,
    allowStaleOnFetchRejection: true,
    noDeleteOnFetchRejection: true,
    fetchMethod: readFromGitHub,
  });

  return {
    async list(): Promise<DefinitionsResponse> {
      try {
        const value = await cache.fetch(KEY);
        if (value) return value;
      } catch {
        // No previous good result: fall through to the bundled snapshot.
      }
      cache.set(KEY, FALLBACK, { ttl: FALLBACK_TTL_MS });
      return FALLBACK;
    },

    async get(type: string): Promise<ObjectDefinition | null> {
      return (await this.list()).definitions.find((d) => d.type === type) ?? null;
    },
  };
}

export type DefinitionsService = ReturnType<typeof createDefinitionsService>;
