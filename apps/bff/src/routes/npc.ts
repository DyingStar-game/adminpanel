import { Hono, type Context } from 'hono';
import {
  zCancelNpcTaskPath,
  zDeletePatternPath,
  zGetNpcEventsQuery,
  zGetNpcLogsQuery,
  zGetNpcPath,
  zListEventsQuery,
  zPanelActivityActions,
  zPanelBulk,
  zPanelCreateNpcs,
  zPanelCreatePattern,
  zPanelImportSchedules,
  zPanelListNpcsQuery,
  zPanelNewTask,
  zPanelNpcPatch,
  zPanelSettings,
  zPanelUpdatePattern,
  zPanelWorkplace,
  zSetVillageWorkplacePath,
} from '@dyingstar-admin/contracts/npc';
import { requirePermission, type SessionContext } from '../auth/auth';
import type { NpcClient } from '../clients/npc';
import { fromQuery, jsonSafe, validate } from '../lib/validate';

/** A pattern's name, as the service's path takes it. */
const PatternPath = zDeletePatternPath;
/** An NPC's id (its Keycloak user id). */
const NpcPath = zGetNpcPath;

/**
 * The `npc` service (ADR 0026): its Admin API, always with the person's token, which it checks
 * itself (reads `moderator`+, writes `admin` or `supervisor`). The panel's `npc.view` opens the
 * section (checked where it is mounted), `npc.manage` its writes; inputs are validated with the
 * pinned contract (and `code.ts`) before any call. Task, event and current-action ids are `int64`:
 * answers go through `jsonSafe`.
 */
export function npcRoutes(npc: NpcClient) {
  const token = (c: Context) => (c.var as SessionContext['Variables']).session?.tokens.accessToken;
  const manage = requirePermission('npc.manage');
  const json = (c: Context, data: unknown, status: 200 | 201 = 200) =>
    c.json(jsonSafe(data), status);

  return (
    new Hono<SessionContext>()
      .get('/settings', async (c) => json(c, await npc.settings(token(c))))
      .get('/npcs', validate('query', fromQuery(zPanelListNpcsQuery)), async (c) =>
        json(c, await npc.npcs(token(c), c.req.valid('query'))),
      )
      .get('/npcs/:id', validate('param', NpcPath), async (c) =>
        json(c, await npc.npc(token(c), c.req.valid('param').id)),
      )
      .get(
        '/npcs/:id/logs',
        validate('param', NpcPath),
        validate('query', fromQuery(zGetNpcLogsQuery)),
        async (c) =>
          json(c, await npc.logs(token(c), c.req.valid('param').id, c.req.valid('query'))),
      )
      .get(
        '/npcs/:id/events',
        validate('param', NpcPath),
        validate('query', fromQuery(zGetNpcEventsQuery)),
        async (c) =>
          json(c, await npc.npcEvents(token(c), c.req.valid('param').id, c.req.valid('query'))),
      )
      .get('/npcs/:id/tasks', validate('param', NpcPath), async (c) =>
        json(c, await npc.tasks(token(c), c.req.valid('param').id)),
      )
      .get('/events', validate('query', fromQuery(zListEventsQuery)), async (c) =>
        json(c, await npc.events(token(c), c.req.valid('query'))),
      )
      .get('/task-kinds', async (c) => json(c, await npc.taskKinds(token(c))))
      .get('/schedule/patterns', async (c) => json(c, await npc.patterns(token(c))))
      .get('/schedule/patterns/:name', validate('param', PatternPath), async (c) =>
        json(c, await npc.pattern(token(c), c.req.valid('param').name)),
      )
      .get('/schedule/activity-actions', async (c) => json(c, await npc.activityActions(token(c))))
      .get('/schedule/legend', async (c) => json(c, await npc.legend(token(c))))
      .get('/villages', async (c) => json(c, await npc.villages(token(c))))
      // Writes: `admin` or `supervisor` (`npc.manage`), recorded where mounted.
      .put('/settings', manage, validate('json', zPanelSettings), async (c) =>
        json(c, await npc.saveSettings(token(c), c.req.valid('json'))),
      )
      .post('/npcs', manage, validate('json', zPanelCreateNpcs), async (c) =>
        json(c, await npc.createNpcs(token(c), c.req.valid('json')), 201),
      )
      .post('/npcs/bulk', manage, validate('json', zPanelBulk), async (c) =>
        json(c, await npc.bulk(token(c), c.req.valid('json'))),
      )
      .patch(
        '/npcs/:id',
        manage,
        validate('param', NpcPath),
        validate('json', zPanelNpcPatch),
        async (c) =>
          json(c, await npc.patchNpc(token(c), c.req.valid('param').id, c.req.valid('json'))),
      )
      .delete('/npcs/:id', manage, validate('param', NpcPath), async (c) => {
        await npc.deleteNpc(token(c), c.req.valid('param').id);
        return c.body(null, 204);
      })
      .post('/npcs/:id/spawn', manage, validate('param', NpcPath), async (c) =>
        json(c, await npc.spawn(token(c), c.req.valid('param').id)),
      )
      .post('/npcs/:id/despawn', manage, validate('param', NpcPath), async (c) =>
        json(c, await npc.despawn(token(c), c.req.valid('param').id)),
      )
      .post('/npcs/:id/reassign', manage, validate('param', NpcPath), async (c) =>
        json(c, await npc.reassign(token(c), c.req.valid('param').id)),
      )
      .post('/npcs/:id/reset-credentials', manage, validate('param', NpcPath), async (c) => {
        await npc.resetCredentials(token(c), c.req.valid('param').id);
        return c.body(null, 204);
      })
      .post(
        '/npcs/:id/tasks',
        manage,
        validate('param', NpcPath),
        validate('json', zPanelNewTask),
        async (c) =>
          json(
            c,
            await npc.createTask(token(c), c.req.valid('param').id, c.req.valid('json')),
            201,
          ),
      )
      .delete(
        '/npcs/:id/tasks/:taskId',
        manage,
        validate('param', zCancelNpcTaskPath),
        async (c) => {
          const { id, taskId } = c.req.valid('param');
          return json(c, await npc.cancelTask(token(c), id, taskId));
        },
      )
      .post('/schedule/patterns', manage, validate('json', zPanelCreatePattern), async (c) =>
        json(c, await npc.createPattern(token(c), c.req.valid('json')), 201),
      )
      .put(
        '/schedule/patterns/:name',
        manage,
        validate('param', PatternPath),
        validate('json', zPanelUpdatePattern),
        async (c) =>
          json(
            c,
            await npc.updatePattern(token(c), c.req.valid('param').name, c.req.valid('json')),
          ),
      )
      .delete('/schedule/patterns/:name', manage, validate('param', PatternPath), async (c) => {
        await npc.deletePattern(token(c), c.req.valid('param').name);
        return c.body(null, 204);
      })
      .post('/schedule/import', manage, validate('json', zPanelImportSchedules), async (c) =>
        json(c, await npc.importSchedules(token(c), c.req.valid('json'))),
      )
      .put(
        '/schedule/activity-actions',
        manage,
        validate('json', zPanelActivityActions),
        async (c) => json(c, await npc.saveActivityActions(token(c), c.req.valid('json'))),
      )
      .put(
        '/villages/:code/workplace',
        manage,
        validate('param', zSetVillageWorkplacePath),
        validate('json', zPanelWorkplace),
        async (c) =>
          json(c, await npc.setWorkplace(token(c), c.req.valid('param').code, c.req.valid('json'))),
      )
      .delete(
        '/villages/:code/workplace',
        manage,
        validate('param', zSetVillageWorkplacePath),
        async (c) => {
          await npc.deleteWorkplace(token(c), c.req.valid('param').code);
          return c.body(null, 204);
        },
      )
  );
}
