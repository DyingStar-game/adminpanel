import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@dyingstar-admin/schemas';
import { createApp } from './app';

describe('BFF app', () => {
  it('answers the healthcheck', async () => {
    const res = await createApp().request('/health');

    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(await res.json()).status).toBe('ok');
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await createApp().request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('serves the SPA with an index.html fallback when a static dir is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(dir, 'index.html'), '<div id="root"></div>');
    const app = createApp({ staticDir: dir });

    const res = await app.request('/explorer/some/deep/link');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id="root"');
  });

  it('never answers unknown API routes with the SPA', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(dir, 'index.html'), '<div id="root"></div>');

    const res = await createApp({ staticDir: dir }).request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('does not serve the SPA in development', async () => {
    const res = await createApp().request('/');

    expect(res.status).toBe(404);
  });
});
