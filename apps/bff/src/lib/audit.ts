import { createMiddleware } from 'hono/factory';
import type { Session, SessionContext } from '../auth/auth';

/** One line of the BFF's record of writes sent to a game service. */
export interface AuditEntry {
  audit: 'service-write';
  at: string;
  service: string;
  /** The signed-in person (`preferred_username`, Keycloak id); null without authentication. */
  user: string | null;
  userId: string | null;
  method: string;
  /** The panel's route, which names the action and its target. */
  path: string;
  /** The answer: what the service did, or why it was refused. */
  status: number;
}

/**
 * Records every write a person sends to a game service, as one JSON line on stdout (ADR 0023 ›
 * Calling the services): calls made as `svc-admin` carry no identity, so the service cannot tell
 * who acted, and this record is the only one. Bodies are left out (moderation data is personal,
 * ADR 0024); the path gives the action and its target.
 */
export const auditWrites = (service: string, write: (entry: AuditEntry) => void = logEntry) =>
  createMiddleware<SessionContext>(async (c, next) => {
    await next();
    if (c.req.method === 'GET' || c.req.method === 'HEAD') return;
    const session = c.var.session as Session | undefined;
    write({
      audit: 'service-write',
      at: new Date().toISOString(),
      service,
      user: session?.user.username ?? null,
      userId: session?.user.id ?? null,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
    });
  });

const logEntry = (entry: AuditEntry) => console.info(JSON.stringify(entry));
