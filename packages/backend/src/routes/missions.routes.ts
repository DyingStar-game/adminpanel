/**
 * Mission CRUD routes (`/api/missions`, requires server context via parent router).
 */
import { Router, type IRouter } from 'express';
import type { Mission } from '@dyingstar/shared';
import * as missions from '../services/missions.js';
import { logActivity } from '../services/activityLog.js';

/** Router for mission list, create, update, and delete. */
export const missionsRoutes: IRouter = Router();

/** GET / — List all missions. */
missionsRoutes.get('/', (_req, res) => {
  res.json(missions.listMissions());
});

/** POST / — Create a mission. */
missionsRoutes.post('/', (req, res) => {
  const mission = missions.createMission(req.body as Omit<Mission, 'id' | 'createdAt' | 'updatedAt'>);
  logActivity('mission_created', 'admin', mission.title);
  res.status(201).json(mission);
});

/** PUT /:id — Update a mission by id. */
missionsRoutes.put('/:id', (req, res) => {
  const mission = missions.updateMission(req.params.id, req.body);
  if (!mission) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Mission not found' });
    return;
  }
  logActivity('mission_updated', 'admin', mission.title);
  res.json(mission);
});

/** DELETE /:id — Delete a mission by id. */
missionsRoutes.delete('/:id', (req, res) => {
  const ok = missions.deleteMission(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Mission not found' });
    return;
  }
  logActivity('mission_deleted', 'admin', req.params.id);
  res.status(204).send();
});
