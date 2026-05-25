/**
 * Express request type augmentation for per-request server context.
 */
import type { ServerConfig } from '../domain/server.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Active game server resolved from `X-Server-Id` (set by server context middleware). */
      server?: ServerConfig;
    }
  }
}

export {};
