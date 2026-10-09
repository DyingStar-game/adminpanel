import { describe, expect, it } from 'vitest';
import { typeColor } from './objectTypes';

describe('typeColor', () => {
  it('uses the mock-up colour for known types', () => {
    expect(typeColor('vehicle')).toBe('#e11d48');
  });

  it('gives unknown types a stable colour', () => {
    expect(typeColor('new_type')).toBe(typeColor('new_type'));
    expect(typeColor('new_type')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
