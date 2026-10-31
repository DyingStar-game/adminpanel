import { z } from 'zod';
import { UuidSchema } from './common';
import { ItemSchema, ObjectDataSchema } from './persistence';

/**
 * Places players discover and name (ADR 0032): the `discovery` persistence items the game server
 * writes (DyingStar, `scenes/exploration/discovery.gd`, `server/discoveries.gd`), one per place,
 * and the panel's review of the names they propose.
 */

/** Persistence type of a discovery (`horizonserver` › `discovery_def.json`). */
export const DISCOVERY_TYPE = 'discovery';

/**
 * Where a discovery stands: found with nothing proposed, a name awaiting review, published, or
 * refused (the discoverer may then propose another one). The game only moves a discovery from
 * `unnamed` or `refused` to `pending`; the panel decides the rest.
 */
export const DiscoveryStatusSchema = z.enum(['unnamed', 'pending', 'approved', 'refused']);
export type DiscoveryStatus = z.infer<typeof DiscoveryStatusSchema>;
export const DISCOVERY_STATUSES = DiscoveryStatusSchema.options;

/**
 * Kinds of place the panel has a label for. `place_kind` stays an open string: a kind the game
 * adds later (lakes, planets, asteroids) is listed and reviewed as is, shown by its raw name.
 */
export const KNOWN_PLACE_KINDS = ['cave'] as const;

/** Bounds of a place name, counted in characters once its spaces are tidied (as the game). */
export const PLACE_NAME_MIN_LENGTH = 3;
export const PLACE_NAME_MAX_LENGTH = 40;
/** Letters of any alphabet, digits, spaces, apostrophes and hyphens (`PlaceNameRule`). */
const PLACE_NAME_ALLOWED = /^[\p{L}\p{N}' -]+$/u;

/** `raw` with its edges trimmed and every run of spaces made one (`PlaceNameRule.clean`). */
export const cleanPlaceName = (raw: string): string =>
  raw.trim().split(' ').filter(Boolean).join(' ');

/** Why a name breaks the game's rule, or null when it is fine. */
export type PlaceNameProblem = 'tooShort' | 'tooLong' | 'badCharacters';

/**
 * The game's rule on a proposed name (`PlaceNameRule.error_key`): 3 to 40 characters (code
 * points, as Godot counts them) once cleaned, letters of any alphabet, digits, spaces,
 * apostrophes and hyphens only.
 */
export function placeNameProblem(raw: string): PlaceNameProblem | null {
  const name = cleanPlaceName(raw);
  const length = [...name].length;
  if (length < PLACE_NAME_MIN_LENGTH) return 'tooShort';
  if (length > PLACE_NAME_MAX_LENGTH) return 'tooLong';
  if (!PLACE_NAME_ALLOWED.test(name)) return 'badCharacters';
  return null;
}

/** A place name, cleaned; its issue's message is the `PlaceNameProblem`. */
export const PlaceNameSchema = z
  .string()
  .transform(cleanPlaceName)
  .superRefine((name, ctx) => {
    const problem = placeNameProblem(name);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** Longest refusal reason the panel sends (what the discoverer reads, in their history). */
export const REFUSAL_REASON_MAX_LENGTH = 500;
export const RefusalReasonSchema = z.string().trim().min(1).max(REFUSAL_REASON_MAX_LENGTH);

/** A unix time in seconds; 0 = not yet (and for anything else stored). */
const UnixSeconds = z.number().nonnegative().catch(0);
/** A text field; "" when missing. */
const Text = z.string().catch('');

/**
 * `object_data` of a `discovery` item, as the game writes it (`Discovery.record`). Missing
 * fields take the game's defaults; any other key is kept. `parent_id` is the place's own item.
 */
export const DiscoveryDataSchema = z.looseObject({
  scenename: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  /** `cave` for now: an open string (`KNOWN_PLACE_KINDS` have a label). */
  place_kind: Text,
  /** The place's id in its kind (a cave's placement id). */
  place_id: Text,
  /** The place's persistence item. */
  place_uuid: Text,
  planet_name: Text,
  /** The discoverer's Keycloak `sub`, their `social` player id. */
  discoverer_id: Text,
  discoverer_name: Text,
  discovered_at: UnixSeconds,
  /** One of `DISCOVERY_STATUSES`; kept as stored. */
  status: z.string().catch('unnamed'),
  proposed_name: Text,
  proposed_at: UnixSeconds,
  approved_name: Text,
  refusal_reason: Text,
  decided_at: UnixSeconds,
  /** The discoverer's private point of interest in `inventory`; "" when none. */
  poi_id: Text,
});
export type DiscoveryData = z.infer<typeof DiscoveryDataSchema>;

/** One discovery of the list: its item's uuid and data (the `base` of a decision). */
export const DiscoveryRowSchema = z.object({
  uuid: UuidSchema,
  object_data: DiscoveryDataSchema,
});
export type DiscoveryRow = z.infer<typeof DiscoveryRowSchema>;

/** Rows per page by default, and at most. */
export const DISCOVERIES_PAGE_SIZE = 20;
export const DISCOVERIES_MAX_PAGE_SIZE = 100;

/** `GET /api/exploration/discoveries` query: one status (pending by default), a kind, a page. */
export const DiscoveriesQuerySchema = z.object({
  status: DiscoveryStatusSchema.default('pending'),
  kind: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(DISCOVERIES_MAX_PAGE_SIZE)
    .default(DISCOVERIES_PAGE_SIZE),
});
export type DiscoveriesQuery = z.input<typeof DiscoveriesQuerySchema>;

/**
 * `GET /api/exploration/discoveries`: a page of the discoveries of that status and kind (pending
 * ones oldest proposal first, others most recent decision first), and every kind met, whatever
 * the filter, for the kind filter.
 */
export const DiscoveriesResponseSchema = z.object({
  discoveries: z.array(DiscoveryRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
  kinds: z.array(z.string()),
});
export type DiscoveriesResponse = z.infer<typeof DiscoveriesResponseSchema>;

/**
 * `POST /api/exploration/discoveries/:uuid/approve`: `base` is the discovery's `object_data` as
 * read; `name` (the proposal by default) may correct it, under the game's rule.
 */
export const ApproveDiscoveryBodySchema = z.object({
  base: ObjectDataSchema,
  name: PlaceNameSchema.optional(),
});
export type ApproveDiscoveryBody = z.input<typeof ApproveDiscoveryBodySchema>;

/** `POST /api/exploration/discoveries/:uuid/refuse`: the reason the discoverer reads. */
export const RefuseDiscoveryBodySchema = z.object({
  base: ObjectDataSchema,
  reason: RefusalReasonSchema,
});
export type RefuseDiscoveryBody = z.input<typeof RefuseDiscoveryBodySchema>;

/**
 * The decision, saved, and what followed it, each best effort: the discoverer told live
 * (`notified`, false when offline too) and in their activity history (`recorded`).
 */
export const RefuseDiscoveryResponseSchema = z.object({
  item: ItemSchema,
  notified: z.boolean(),
  recorded: z.boolean(),
});
export type RefuseDiscoveryResponse = z.infer<typeof RefuseDiscoveryResponseSchema>;

/** The same, and the discoverer's point of interest renamed (`poiRenamed`). */
export const ApproveDiscoveryResponseSchema = RefuseDiscoveryResponseSchema.extend({
  poiRenamed: z.boolean(),
});
export type ApproveDiscoveryResponse = z.infer<typeof ApproveDiscoveryResponseSchema>;

/** Notification and activity types the game turns into ARES messages. */
export const PLACE_NAME_EVENTS = {
  approved: 'place_name_approved',
  refused: 'place_name_refused',
} as const;
