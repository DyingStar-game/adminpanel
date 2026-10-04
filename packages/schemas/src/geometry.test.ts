import { describe, expect, it } from 'vitest';
import {
  azimuthalEquidistant,
  azimuthalEquidistantInverse,
  directionOf,
  latLonOf,
} from './geometry';

describe('azimuthal equidistant projection', () => {
  it('maps a point back to the direction it came from', () => {
    const center = directionOf(19.23, 132.64);
    const radius = 6_360_275;
    const project = azimuthalEquidistant(center, radius);
    const inverse = azimuthalEquidistantInverse(center, radius);
    for (const [lat, lon] of [
      [19.23, 132.64],
      [24.9, 140.7],
      [10.8, 129.4],
    ] as const) {
      const { x, y } = project(directionOf(lat, lon));
      const back = latLonOf(inverse(x, y));
      expect(back.lat).toBeCloseTo(lat, 9);
      expect(back.lon).toBeCloseTo(lon, 9);
    }
  });
});
