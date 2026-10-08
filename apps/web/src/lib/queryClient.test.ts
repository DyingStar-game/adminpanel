import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { QueryObserver } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MeResponseSchema, ServersResponseSchema } from '@dyingstar-admin/schemas';
import { server } from '@/test/server';
import { apiGet } from './api';
import { createQueryClient, SESSION_QUERY_KEY } from './queryClient';

const unauthenticated = () =>
  HttpResponse.json({ error: 'UNAUTHENTICATED', message: 'Sign in first' }, { status: 401 });

/** Counts `/api/me` calls, answered by `answer`. */
const countMe = (answer: () => Response) => {
  const calls = { me: 0 };
  server.use(
    http.get('*/api/me', () => {
      calls.me += 1;
      return answer();
    }),
  );
  return calls;
};

/** Watches `/api/me` as the session gate does. */
const watchSession = (client: ReturnType<typeof createQueryClient>) =>
  new QueryObserver(client, {
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiGet('/api/me', MeResponseSchema),
    retry: false,
  }).subscribe(() => {});

describe('createQueryClient', () => {
  it('asks /api/me again when another request finds the session ended', async () => {
    const calls = countMe(() => HttpResponse.json({ user: null, roles: [], access: true }));
    server.use(http.get('*/api/servers', unauthenticated));
    const client = createQueryClient();
    const stop = watchSession(client);
    await waitFor(() => expect(calls.me).toBe(1));

    await client
      .fetchQuery({
        queryKey: ['servers'],
        queryFn: () => apiGet('/api/servers', ServersResponseSchema),
      })
      .catch(() => {});

    await waitFor(() => expect(calls.me).toBe(2));
    stop();
  });

  it('never loops on the 401 of /api/me itself', async () => {
    const calls = countMe(unauthenticated);
    const client = createQueryClient();
    const stop = watchSession(client);

    await waitFor(() => expect(client.getQueryState(SESSION_QUERY_KEY)?.status).toBe('error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(calls.me).toBe(1);
    stop();
  });
});
