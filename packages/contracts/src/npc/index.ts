/**
 * Contract of the `npc` service (ADR 0026): Zod schemas and types generated from the pinned
 * `openapi.yaml` (`source.json` says where it comes from; not on GitHub yet), plus the panel's
 * stricter input schemas (`code.ts`). Regenerate with `make contracts-update`.
 */
export * from './generated/zod.gen';
export type * from './generated/types.gen';
export * from './code';
