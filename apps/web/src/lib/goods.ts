import { z } from 'zod';

/**
 * What a crate holds (ADR 0029), as a mining depot packs it (`mining_depot.gd` ›
 * `handle_extract`): one mineral, its quantity in litres (`units`) and in m³ (`ore_volume`).
 */
export interface Goods {
  /** Mineral id (`gold`), named from `schematic.minerals.*`. */
  mineral: string;
  /** Litres; null when not given. */
  units: number | null;
  /** Cubic metres; null when not given. */
  volume: number | null;
}

const GoodsSchema = z.object({
  mineral: z.string().min(1),
  units: z.number().nonnegative().optional(),
  ore_volume: z.number().nonnegative().optional(),
});

/** The goods of a `content` value; null when it holds none (`{}`, no mineral, anything else). */
export function goodsOf(value: unknown): Goods | null {
  const parsed = GoodsSchema.safeParse(value);
  if (!parsed.success) return null;
  const { mineral, units, ore_volume } = parsed.data;
  return { mineral, units: units ?? null, volume: ore_volume ?? null };
}

/** "Gold · 66 L · 0.066 m³": the mineral named by the caller, quantities in the locale. */
export function formatGoods(goods: Goods, mineral: string, locale: string): string {
  const format = (n: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  return [
    mineral,
    ...(goods.units === null ? [] : [`${format(goods.units, 1)} L`]),
    ...(goods.volume === null ? [] : [`${format(goods.volume, 3)} m³`]),
  ].join(' · ');
}
