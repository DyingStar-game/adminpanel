import { describe, expect, it } from 'vitest';
import { PlaceNamesSearchSchema } from './placeNamesSearch';

describe('PlaceNamesSearchSchema (ADR 0032)', () => {
  it('opens on the names to review, first page', () => {
    expect(PlaceNamesSearchSchema.parse({})).toEqual({ status: 'pending', page: 1 });
  });

  it('keeps a status and a kind, and drops what is not one', () => {
    expect(PlaceNamesSearchSchema.parse({ status: 'refused', kind: 'lake', page: '3' })).toEqual({
      status: 'refused',
      kind: 'lake',
      page: 3,
    });
    expect(PlaceNamesSearchSchema.parse({ status: 'unnamed', kind: '', page: '-1' })).toEqual({
      status: 'pending',
      page: 1,
    });
  });
});
