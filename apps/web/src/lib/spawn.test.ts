import { describe, expect, it } from 'vitest';
import { spawnNextTo } from './spawn';

const player = (data: Record<string, unknown>) => ({
  object_type: 'player',
  object_uuid: 'p',
  object_data: { parent_id: 'building', ...data },
});

describe('spawnNextTo', () => {
  it('shares the parent, since positions are relative to it', () => {
    expect(spawnNextTo(player({ position: { x: 0, y: 0, z: 0 } }))?.parentId).toBe('building');
  });

  it('places the item 2 m in front (−Z) when the entity faces the default direction', () => {
    const preset = spawnNextTo(
      player({ position: { x: 1, y: 0.5, z: 10 }, rotation: { x: 0, y: 0, z: 0 } }),
    );
    expect(preset).toEqual({
      parentId: 'building',
      position: { x: 1, y: 0.5, z: 8 },
      rotation: { x: 0, y: 0, z: 0 },
    });
  });

  it('follows the yaw', () => {
    const preset = spawnNextTo(
      player({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } }),
    );
    expect(preset?.position).toEqual({ x: -2, y: 0, z: -0 });
    expect(preset?.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('needs a position', () => {
    expect(spawnNextTo(player({}))).toBeNull();
  });
});
