import { z } from 'zod';
import {
  zPanelWorldFile,
  type MineralSource,
  type PanelMineralSource,
  type PanelRoute,
  type PanelWorldFile,
} from '@dyingstar-admin/contracts/universesimulator';

/**
 * The world of the simulation as the panel writes it (ADR 0025 › The world): a route between two
 * villages, typed in kilometres, and a world file read from the person's disk.
 */

/** Message codes of the forms, translated under `simulation.world.errors`. */
export type WorldError =
  'required' | 'number' | 'positive' | 'sameVillage' | 'wholeFromOne' | 'wholeFromZero';

/**
 * A mineral source's fields as typed: the most one mining order asks for (a whole number from 1)
 * and what is left to mine (a whole number from 0; empty for a source without an end).
 */
export const SourceFormSchema = z.object({
  maxUnitsPerMission: z.number({ error: 'wholeFromOne' }).int({ error: 'wholeFromOne' }).gte(1, {
    error: 'wholeFromOne',
  }),
  remainingUnits: z
    .number({ error: 'wholeFromZero' })
    .int({ error: 'wholeFromZero' })
    .gte(0, { error: 'wholeFromZero' })
    .or(z.nan()),
});
export type SourceForm = z.infer<typeof SourceFormSchema>;

/** A source as the form shows it: an endless one has an empty "left to mine". */
export const sourceFormValues = (source: MineralSource): SourceForm => ({
  maxUnitsPerMission: source.maxUnitsPerMission,
  remainingUnits: source.remainingUnits ?? Number.NaN,
});

/** The source to write: both values each time, `null` for a source without an end. */
export const sourceToWrite = (source: MineralSource, form: SourceForm): PanelMineralSource => ({
  villageId: source.villageId,
  resourceId: source.resourceId,
  maxUnitsPerMission: form.maxUnitsPerMission,
  remainingUnits: Number.isNaN(form.remainingUnits) ? null : form.remainingUnits,
});

/** A route's fields as typed: two different villages, a distance over 0 in kilometres. */
export const RouteFormSchema = z
  .object({
    fromVillageId: z.string().min(1, { error: 'required' }),
    toVillageId: z.string().min(1, { error: 'required' }),
    distanceKm: z.number({ error: 'number' }).gt(0, { error: 'positive' }),
  })
  .superRefine((route, ctx) => {
    if (route.fromVillageId && route.fromVillageId === route.toVillageId) {
      ctx.addIssue({ code: 'custom', path: ['toVillageId'], message: 'sameVillage' });
    }
  });
export type RouteForm = z.infer<typeof RouteFormSchema>;

export const EMPTY_ROUTE: RouteForm = {
  fromVillageId: '',
  toVillageId: '',
  distanceKm: Number.NaN,
};

/** The route to write: metres, as the service counts them. */
export const routeToWrite = (form: RouteForm): PanelRoute => ({
  fromVillageId: form.fromVillageId,
  toVillageId: form.toVillageId,
  distanceM: Math.round(form.distanceKm * 1000),
});

/** Kilometres of a distance in metres, one decimal under ten: "17.6", "232". */
export const formatKm = (metres: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: metres < 10_000 ? 1 : 0 }).format(
    metres / 1000,
  );

/** Why a picked file is no world file: not JSON, or without its federation. */
export type WorldFileIssue = 'notJson' | 'notWorld';

/**
 * A world file read from a text: the service's `WorldFile`, of which the panel only asks for the
 * federation's code, name and planet (the service checks the rest).
 */
export function parseWorldFile(
  text: string,
): { ok: true; file: PanelWorldFile } | { ok: false; issue: WorldFileIssue } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issue: 'notJson' };
  }
  const parsed = zPanelWorldFile.safeParse(raw);
  return parsed.success ? { ok: true, file: parsed.data } : { ok: false, issue: 'notWorld' };
}
