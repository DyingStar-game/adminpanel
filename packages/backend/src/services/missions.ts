/**
 * File-backed mission storage under `packages/backend/data/missions.json`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { Mission } from '@dyingstar/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const MISSIONS_PATH = join(DATA_DIR, 'missions.json');

/**
 * Ensures the data directory exists before read/write.
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Loads all missions from disk.
 * @returns Mission array, or empty if file missing.
 */
function loadMissions(): Mission[] {
  ensureDataDir();
  if (!existsSync(MISSIONS_PATH)) return [];
  return JSON.parse(readFileSync(MISSIONS_PATH, 'utf-8')) as Mission[];
}

/**
 * Persists the full mission list to disk.
 * @param missions - Missions to write.
 */
function saveMissions(missions: Mission[]): void {
  ensureDataDir();
  writeFileSync(MISSIONS_PATH, JSON.stringify(missions, null, 2));
}

/**
 * Lists all missions.
 * @returns All missions from storage.
 */
export function listMissions(): Mission[] {
  return loadMissions();
}

/**
 * Finds a mission by id.
 * @param id - Mission id.
 * @returns Mission if found.
 */
export function getMission(id: string): Mission | undefined {
  return loadMissions().find((m) => m.id === id);
}

/**
 * Creates a mission with generated id and timestamps.
 * @param data - Mission fields without id and timestamps.
 * @returns Created mission.
 */
export function createMission(data: Omit<Mission, 'id' | 'createdAt' | 'updatedAt'>): Mission {
  const missions = loadMissions();
  const now = new Date().toISOString();
  const mission: Mission = {
    ...data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  missions.push(mission);
  saveMissions(missions);
  return mission;
}

/**
 * Partially updates a mission and bumps `updatedAt`.
 * @param id - Mission id.
 * @param data - Fields to merge.
 * @returns Updated mission, or null if not found.
 */
export function updateMission(id: string, data: Partial<Mission>): Mission | null {
  const missions = loadMissions();
  const idx = missions.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  missions[idx] = { ...missions[idx], ...data, updatedAt: new Date().toISOString() };
  saveMissions(missions);
  return missions[idx];
}

/**
 * Deletes a mission by id.
 * @param id - Mission id.
 * @returns True if a mission was removed.
 */
export function deleteMission(id: string): boolean {
  const missions = loadMissions();
  const filtered = missions.filter((m) => m.id !== id);
  if (filtered.length === missions.length) return false;
  saveMissions(filtered);
  return true;
}
