import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@dyingstar-admin/schemas';
import { buildApp } from './test/harness';

const spaDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'spa-'));
  writeFileSync(join(dir, 'index.html'), '<div id="root"></div>');
  return dir;
};

describe('BFF app', () => {
  it('answers the healthcheck', async () => {
    const res = await buildApp().app.request('/health');

    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(await res.json()).status).toBe('ok');
  });

  it('lists servers without any internal URL', async () => {
    const res = await buildApp().app.request('/api/servers');

    const body = await res.json();
    expect(body).toEqual({
      servers: [{ id: 'universe-testing', name: 'Universe Testing', environment: 'testing' }],
    });
    expect(JSON.stringify(body)).not.toContain('persistence');
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await buildApp().app.request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('serves the SPA with an index.html fallback when a static dir is set', async () => {
    const res = await buildApp({ staticDir: spaDir() }).app.request('/explorer/some/deep/link');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id="root"');
  });

  it('never answers unknown API routes with the SPA', async () => {
    const res = await buildApp({ staticDir: spaDir() }).app.request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('does not serve the SPA in development', async () => {
    expect((await buildApp().app.request('/')).status).toBe(404);
  });
});
