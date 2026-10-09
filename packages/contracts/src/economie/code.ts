import { z } from 'zod';
import {
  zCorporationSettings,
  zCorporationSettingsBody,
  zPutApiInternalPoliticsByEntityIdSettingsBody,
} from './generated/zod.gen';

/**
 * Where `economie`'s code differs from its OpenAPI (`routes/schemas.ts`, `db/schema/`, read
 * 2026-10-09): the panel follows the code (ADR 0024). Hand-written, kept apart from the
 * generated files.
 */

/** Its code answers the fiscal home too (`corporation_settings.political_entity_id`). */
export const zCorporationSettingsAsServed = zCorporationSettings.extend({
  politicalEntityId: z.uuid().nullable(),
});
export type CorporationSettingsAsServed = z.infer<typeof zCorporationSettingsAsServed>;

const atLeastOneField = (value: object) => Object.keys(value).length > 0;
const atLeastOne = { message: 'At least one field is required' };

/** A change of a corporation's settings: at least one field. */
export const zCorporationSettingsChange = zCorporationSettingsBody
  .strict()
  .refine(atLeastOneField, atLeastOne);
export type CorporationSettingsChange = z.infer<typeof zCorporationSettingsChange>;

/** A change of a political entity's settings: at least one field, a ceiling up to 10¹³. */
export const zPoliticalSettingsChange = zPutApiInternalPoliticsByEntityIdSettingsBody
  .extend({ mintCeiling: z.int().gte(0).lte(10_000_000_000_000).optional() })
  .strict()
  .refine(atLeastOneField, atLeastOne);
export type PoliticalSettingsChange = z.infer<typeof zPoliticalSettingsChange>;

/**
 * A corporation's fiscal home: a political entity, or none (`null` detaches it; the generated
 * schema lost the OpenAPI's `nullable`).
 */
export const zCorporationAffiliation = z
  .object({ politicalEntityId: z.uuid().nullable() })
  .strict();
export type CorporationAffiliation = z.infer<typeof zCorporationAffiliation>;
