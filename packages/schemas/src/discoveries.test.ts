import { describe, expect, it } from 'vitest';
import {
  ApproveDiscoveryBodySchema,
  cleanPlaceName,
  DiscoveriesQuerySchema,
  DiscoveryDataSchema,
  placeNameProblem,
  RefuseDiscoveryBodySchema,
} from './discoveries';

describe("the place name rule (the game's PlaceNameRule, ADR 0032)", () => {
  it('tidies the spaces before anything else', () => {
    expect(cleanPlaceName('  Grotte   des   Ombres ')).toBe('Grotte des Ombres');
  });

  it('accepts letters of any alphabet, digits, apostrophes and hyphens', () => {
    for (const name of ["L'Antre-Noir 2", 'Écho des Sœurs', 'Пещера', '洞窟の奥', 'Ari']) {
      expect(placeNameProblem(name)).toBeNull();
    }
  });

  it('counts 3 to 40 characters once tidied, as Godot counts them', () => {
    expect(placeNameProblem('  Ab  ')).toBe('tooShort');
    expect(placeNameProblem('a'.repeat(41))).toBe('tooLong');
    expect(placeNameProblem('a'.repeat(40))).toBeNull();
    // One code point each, two UTF-16 units: 40 of them still fit.
    expect(placeNameProblem('𝒜'.repeat(40))).toBeNull();
  });

  it('refuses any other character', () => {
    for (const name of ['Cave!', 'Cave_1', 'Cave\tdeep', 'Cave <b>', 'Cave.']) {
      expect(placeNameProblem(name)).toBe('badCharacters');
    }
  });
});

describe('discovery schemas', () => {
  it("gives a discovery's missing fields the game's defaults and keeps the others", () => {
    const data = DiscoveryDataSchema.parse({ place_kind: 'cave', extra: 1, proposed_at: 'soon' });
    expect(data).toMatchObject({
      place_kind: 'cave',
      status: 'unnamed',
      proposed_name: '',
      proposed_at: 0,
      poi_id: '',
      extra: 1,
    });
  });

  it('lists the pending discoveries by default', () => {
    expect(DiscoveriesQuerySchema.parse({})).toEqual({ status: 'pending', page: 1, page_size: 20 });
    expect(DiscoveriesQuerySchema.safeParse({ status: 'lost' }).success).toBe(false);
    expect(DiscoveriesQuerySchema.safeParse({ page_size: '101' }).success).toBe(false);
  });

  it('cleans the approved name and checks it with the rule', () => {
    expect(ApproveDiscoveryBodySchema.parse({ base: {}, name: ' Le  Puits ' }).name).toBe(
      'Le Puits',
    );
    const refused = ApproveDiscoveryBodySchema.safeParse({ base: {}, name: 'No!' });
    expect(refused.error?.issues[0]?.message).toBe('badCharacters');
    expect(ApproveDiscoveryBodySchema.parse({ base: {} }).name).toBeUndefined();
  });

  it('requires a refusal reason of 1 to 500 characters', () => {
    expect(RefuseDiscoveryBodySchema.safeParse({ base: {}, reason: '   ' }).success).toBe(false);
    expect(RefuseDiscoveryBodySchema.safeParse({ base: {}, reason: 'x'.repeat(501) }).success).toBe(
      false,
    );
    expect(RefuseDiscoveryBodySchema.parse({ base: {}, reason: ' Insulting ' }).reason).toBe(
      'Insulting',
    );
  });
});
