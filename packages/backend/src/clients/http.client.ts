/**
 * Lightweight HTTP reachability checks for upstream services.
 */
import fetch from 'node-fetch';
import { isMockUrl } from '../services/mockPersistence.js';

/**
 * Pings a URL with GET and measures round-trip time.
 * @param url - Target HTTP(S) endpoint.
 * @returns Whether the response is considered healthy and latency in ms.
 */
export async function pingHttp(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    if (isMockUrl(url)) {
      return { ok: true, latencyMs: Date.now() - start + 5 };
    }
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return { ok: res.ok || res.status < 500, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
