import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { PERSISTENCE_URL } from '@dyingstar-admin/testing';
import { mswServer } from '../test/harness';
import { createPersistenceClient } from './persistence';

const client = createPersistenceClient({ baseUrl: `${PERSISTENCE_URL}/`, timeoutMs: 50 });

describe('persistence client', () => {
  it('maps a timeout to 504', async () => {
    mswServer.use(
      http.get(`${PERSISTENCE_URL}/items/:uuid`, async () => {
        await delay(200);
        return HttpResponse.json({});
      }),
    );

    await expect(client.get('x')).rejects.toMatchObject({ status: 504, code: 'UPSTREAM_TIMEOUT' });
  });

  it('maps a network failure to 502 unreachable', async () => {
    mswServer.use(http.get(`${PERSISTENCE_URL}/items/:uuid`, () => HttpResponse.error()));

    await expect(client.get('x')).rejects.toMatchObject({
      status: 502,
      code: 'UPSTREAM_UNREACHABLE',
    });
  });

  it('keeps the service message on 400 and 500', async () => {
    mswServer.use(
      http.post(`${PERSISTENCE_URL}/items`, () =>
        HttpResponse.json({ error: 'missing field `object_uuid`' }, { status: 400 }),
      ),
      http.delete(`${PERSISTENCE_URL}/items/:uuid`, () =>
        HttpResponse.json({ error: 'scylla down' }, { status: 500 }),
      ),
    );

    await expect(
      client.create({ object_type: 'box', object_uuid: 'x', object_data: {} } as never),
    ).rejects.toMatchObject({
      status: 400,
      code: 'UPSTREAM_REJECTED',
      message: 'missing field `object_uuid`',
    });
    // A failed DELETE is a 502, never a fake "not found".
    await expect(client.remove('x')).rejects.toMatchObject({ status: 502, message: 'scylla down' });
  });

  it('returns null for an unknown item and rejects unexpected payloads', async () => {
    mswServer.use(
      http.get(`${PERSISTENCE_URL}/items/missing`, () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
      http.get(`${PERSISTENCE_URL}/items/weird`, () => HttpResponse.json({ nope: true })),
    );

    expect(await client.get('missing')).toBeNull();
    await expect(client.get('weird')).rejects.toMatchObject({ status: 502 });
  });
});
