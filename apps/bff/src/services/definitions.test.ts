import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { githubDefinitionsHandlers, mswServer } from '../test/harness';
import { createDefinitionsService } from './definitions';

const options = { repo: 'o/r', path: 'props', ref: 'develop' };
const githubDown = http.get('https://api.github.com/*', () =>
  HttpResponse.json({}, { status: 503 }),
);

describe('definitions service', () => {
  it('reads *_def.json files only and names types after the file', async () => {
    mswServer.use(...githubDefinitionsHandlers);
    const service = createDefinitionsService({ ...options, ttlMs: 60_000 });

    const res = await service.list();

    expect(res.source).toBe('github');
    expect(res.definitions.map((d) => d.type)).toEqual([
      'planet',
      'player',
      'spawnbuilding',
      'star',
      'vehicle',
      'vehicle_component',
    ]);
    expect((await service.get('vehicle'))?.channels[0]?.properties).toContain('parent_id');
  });

  it('skips a malformed definition file', async () => {
    mswServer.use(
      http.get('https://raw.test/vehicle_def.json', () => HttpResponse.json({ nope: 1 })),
      ...githubDefinitionsHandlers,
    );

    const res = await createDefinitionsService({ ...options, ttlMs: 60_000 }).list();

    expect(res.definitions.map((d) => d.type)).not.toContain('vehicle');
  });

  it('serves the bundled snapshot when GitHub is unreachable', async () => {
    mswServer.use(githubDown);

    const res = await createDefinitionsService({ ...options, ttlMs: 60_000 }).list();

    expect(res.source).toBe('fallback');
    expect(res.definitions.map((d) => d.type)).toContain('vehicle');
  });

  it('keeps the last good result when a refresh fails', async () => {
    mswServer.use(...githubDefinitionsHandlers);
    const service = createDefinitionsService({ ...options, ttlMs: 1 });
    await service.list();
    await new Promise((resolve) => setTimeout(resolve, 5));
    mswServer.use(githubDown);

    expect((await service.list()).source).toBe('github');
  });
});
