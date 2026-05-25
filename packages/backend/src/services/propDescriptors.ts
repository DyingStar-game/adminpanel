/**
 * Fetches Godot prop descriptor metadata from the horizonserver GitHub repository.
 */
import fetch from 'node-fetch';
import type { PropDescriptor } from '@dyingstar/shared';
import { env } from '../config/env.js';

const GITHUB_API =
  'https://api.github.com/repos/DyingStar-game/horizonserver/contents/ds_genericprops/props?ref=develop';

const FALLBACK_DESCRIPTORS: PropDescriptor[] = [
  { name: 'city', path: 'city.json' },
  { name: 'spawnbuilding', path: 'spawnbuilding.json' },
  { name: 'planet', path: 'planet.json' },
];

/**
 * Lists available prop descriptor JSON files from GitHub (or fallback list).
 * @returns Prop descriptor name/path entries.
 */
export async function listPropDescriptors(): Promise<PropDescriptor[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dyingstar-admin',
  };
  if (env.githubToken) headers.Authorization = `Bearer ${env.githubToken}`;

  try {
    const res = await fetch(GITHUB_API, { headers });
    if (!res.ok) return FALLBACK_DESCRIPTORS;
    const files = (await res.json()) as Array<{ name: string; path: string; download_url: string }>;
    return files
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => ({ name: f.name.replace('.json', ''), path: f.path }));
  } catch {
    return FALLBACK_DESCRIPTORS;
  }
}

/**
 * Downloads the JSON schema/content for a single prop type.
 * @param objectType - Prop type name (filename without `.json`).
 * @returns Parsed descriptor object, or null if missing or on error.
 */
export async function getPropDescriptor(objectType: string): Promise<Record<string, unknown> | null> {
  const rawUrl = `https://raw.githubusercontent.com/DyingStar-game/horizonserver/develop/ds_genericprops/props/${objectType}.json`;
  const headers: Record<string, string> = { 'User-Agent': 'dyingstar-admin' };
  if (env.githubToken) headers.Authorization = `Bearer ${env.githubToken}`;

  try {
    const res = await fetch(rawUrl, { headers });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
