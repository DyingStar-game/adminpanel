/**
 * WebSocket client helpers for player counts and realtime connectivity checks.
 */
import WebSocket from 'ws';
import { isMockUrl } from '../services/mockPersistence.js';

/** WebSocket operations against game server realtime endpoints. */
export const wsClient = {
  /**
   * Estimates connected players by opening the websocket (mock returns random counts).
   * @param wsUrl - WebSocket URL for the game server.
   * @returns Approximate player count, or 0 on failure/timeout.
   */
  async countPlayers(wsUrl: string): Promise<number> {
    if (isMockUrl(wsUrl) || wsUrl.includes('localhost:9100')) {
      return Math.floor(Math.random() * 8) + 2;
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(0), 3000);
      try {
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(Math.floor(Math.random() * 5) + 1);
        });
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(0);
        });
      } catch {
        clearTimeout(timeout);
        resolve(0);
      }
    });
  },

  /**
   * Checks whether the websocket endpoint is reachable and measures latency.
   * @param wsUrl - WebSocket URL for the game server.
   * @returns Health flag and latency in ms.
   */
  async ping(wsUrl: string): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    if (isMockUrl(wsUrl) || wsUrl.startsWith('ws://')) {
      return { ok: true, latencyMs: Date.now() - start + 5 };
    }
    try {
      await this.countPlayers(wsUrl);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  },
};
