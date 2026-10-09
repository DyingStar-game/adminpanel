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

/** Amounts: whole units from 1 to 10¹³ (`routes/schemas.ts` › `amount`). */
const zAmount = z.int().gte(1).lte(10_000_000_000_000);

/**
 * Types a trusted service may give a credit or a debit: every type but `transfer`, `donation`,
 * `tax` and `issuance` (`INTERNAL_TYPES`); the OpenAPI takes any string.
 */
export const zInternalMovementType = z.enum([
  'deposit',
  'withdrawal',
  'fee',
  'mission_reward',
  'salary',
  'prime',
  'corporation_fund',
  'system',
]);
export type InternalMovementType = z.infer<typeof zInternalMovementType>;

/**
 * A credit or a debit as the panel sends it (`movementBody`), stricter than `economie`: in
 * credits, with a reference saying why and an `externalId`, so that sending it twice records it
 * once (409 `DUPLICATE_EXTERNAL_ID`).
 */
export const zPanelMovement = z
  .object({
    amount: zAmount,
    type: zInternalMovementType,
    reference: z.string().trim().min(1).max(128),
    externalId: z.string().trim().min(1).max(128),
  })
  .strict();
export type PanelMovement = z.infer<typeof zPanelMovement>;

/** Money issued as the panel sends it (`mintBody`): in credits, with a reason. */
export const zPanelMint = z
  .object({ amount: zAmount, reason: z.string().trim().min(1).max(128) })
  .strict();
export type PanelMint = z.infer<typeof zPanelMint>;
