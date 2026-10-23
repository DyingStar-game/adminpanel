/**
 * Contract of the `inventory` service (ADR 0024): its `openapi.yaml` is pinned (`source.json`
 * says which commit) but not generated, being invalid YAML upstream (lot 2 plan, question 21):
 * the schemas the panel uses are written from its code in `code.ts`.
 */
export * from './code';
