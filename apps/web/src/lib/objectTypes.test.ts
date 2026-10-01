import { describe, expect, it } from 'vitest';
import { typeColor } from './objectTypes';

describe('typeColor', () => {
  it('uses the mock-up colour for known types', () => {
    expect(typeColor('vehicle')).toBe('#e11d48');
  });

  it('gives unknown types a stable colour', () => {
    expect(typeColor('poi_village')).toBe(typeColor('poi_village'));
    expect(typeColor('poi_village')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
