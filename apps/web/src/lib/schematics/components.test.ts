import { describe, expect, it } from 'vitest';
import { autonomy, batteryLevel, componentModel } from './components';

describe('vehicle components', () => {
  it('reads kind and tier from the scene', () => {
    expect(componentModel('scenes/_universe/props/vehicles/engine_t1.tscn')).toEqual({
      kind: 'engine',
      tier: 1,
    });
    expect(componentModel('scenes/_universe/props/vehicles/battery_t2.tscn')).toEqual({
      kind: 'battery',
      tier: 2,
    });
    expect(componentModel('scenes/_universe/vehicles/components/wheel.tscn')).toBeNull();
    expect(componentModel(undefined)).toBeNull();
  });

  it('gives a battery level against its tier capacity (T1: 180 MJ)', () => {
    expect(batteryLevel(1, 90e6)).toBe(0.5);
    expect(batteryLevel(1, 0)).toBe(0);
    // Unknown tier or value: no level rather than a wrong one.
    expect(batteryLevel(9, 90e6)).toBeNull();
    expect(batteryLevel(1, null)).toBeNull();
  });

  it('estimates the autonomy from the game team figures', () => {
    // 180 MJ, one T1 engine: about 30 min and 50 km.
    expect(autonomy(180e6, [1])).toEqual({ seconds: 1800, metres: 50_000 });
    // Two batteries, one engine: 1 h; one battery, three engines: 10 min.
    expect(autonomy(360e6, [1])?.seconds).toBe(3600);
    expect(autonomy(180e6, [1, 1, 1])?.seconds).toBe(600);
    expect(autonomy(180e6, [])).toBeNull();
  });
});
