import { describe, expect, it } from 'vitest';
import { haulingCrate } from '@dyingstar-admin/testing';
import { formatGoods, goodsOf } from './goods';

describe('goods (ADR 0029)', () => {
  it('reads what a mining depot packs into a crate', () => {
    expect(goodsOf(haulingCrate.object_data.content)).toEqual({
      mineral: 'gold',
      units: 66,
      volume: 0.066,
    });
  });

  it('holds nothing without a mineral', () => {
    expect(goodsOf({})).toBeNull();
    expect(goodsOf({ units: 66 })).toBeNull();
    expect(goodsOf('gold')).toBeNull();
    expect(goodsOf(undefined)).toBeNull();
  });

  it('says what goods amount to, the quantities given', () => {
    expect(formatGoods({ mineral: 'gold', units: 66, volume: 0.066 }, 'Or', 'fr')).toBe(
      'Or · 66 L · 0,066 m³',
    );
    expect(formatGoods({ mineral: 'gold', units: null, volume: null }, 'Gold', 'en')).toBe('Gold');
  });
});
