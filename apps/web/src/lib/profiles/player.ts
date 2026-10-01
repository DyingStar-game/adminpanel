import type { z } from 'zod';
import type { TypeProfileSchema } from './schema';

export const player: z.input<typeof TypeProfileSchema> = {
  type: 'player',
  columns: ['is_npc', 'action', 'seat'],
  headline: [['name'], ['is_npc'], ['action'], ['seat'], ['carrying']],
  relations: [{ path: 'spawn_appartment_id', target: 'spawnbuilding', label: 'spawn apartment' }],
  childrenFirst: [],
  renderers: { head: 'angle', head_yaw: 'angle' },
};
