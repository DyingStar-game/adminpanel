import { sceneModel } from './index';

/**
 * Vehicle component models (ADR 0016): what a component is, read from its `scenename`
 * (`…/engine_t1.tscn` is an engine of tier 1), and what a tier gives. Data only: a new tier or
 * kind is one entry here.
 *
 * Design figures from the game team (2026-10-03, still to be validated in game): a battery
 * discharges with the torque the engines draw (127 J per N·m); 180 MJ last about 30 min and
 * 50 km on flat ground with one T1 engine (100 kW / 600 N·m); lights and dashboard draw nothing
 * while energy remains.
 */
export type ComponentKind = 'engine' | 'battery';

const KINDS: { kind: ComponentKind; model: RegExp }[] = [
  { kind: 'engine', model: /^engine_t(\d+)$/ },
  { kind: 'battery', model: /^battery_t(\d+)$/ },
];

/** Energy stored by a full battery, per tier, in joules. */
export const BATTERY_CAPACITY_J: Record<number, number> = { 1: 180e6 };

/** Power of an engine, per tier, in watts (T1: 100 kW / 600 N·m). */
export const ENGINE_POWER_W: Record<number, number> = { 1: 100e3 };

/** Distance on flat ground per joule with engines totalling 100 kW (180 MJ ≈ 50 km). */
const METRES_PER_J_AT_100_KW = 50_000 / 180e6;

export interface ComponentModel {
  kind: ComponentKind;
  tier: number;
}

/** Kind and tier of a component from its scene, or null for an unknown model. */
export function componentModel(scenename: unknown): ComponentModel | null {
  const model = sceneModel(scenename);
  if (!model) return null;
  for (const { kind, model: pattern } of KINDS) {
    const match = pattern.exec(model);
    if (match) return { kind, tier: Number(match[1]) };
  }
  return null;
}

/** Charge of a battery as a share of its tier's capacity (0–1), or null when unknown. */
export function batteryLevel(tier: number, chargeJ: unknown): number | null {
  const capacity = BATTERY_CAPACITY_J[tier];
  if (!capacity || typeof chargeJ !== 'number' || !Number.isFinite(chargeJ)) return null;
  return Math.min(1, Math.max(0, chargeJ / capacity));
}

/**
 * Estimated autonomy on flat ground, engines drawing their full power: the remaining energy
 * divided by the engines' total power, and the matching distance. Null without engine.
 */
export function autonomy(
  chargeJ: number,
  engineTiers: number[],
): { seconds: number; metres: number } | null {
  const power = engineTiers.reduce((sum, tier) => sum + (ENGINE_POWER_W[tier] ?? 0), 0);
  if (power <= 0) return null;
  return {
    seconds: chargeJ / power,
    metres: (chargeJ * METRES_PER_J_AT_100_KW * 100e3) / power,
  };
}
