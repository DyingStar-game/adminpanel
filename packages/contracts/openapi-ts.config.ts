import { defineConfig } from '@hey-api/openapi-ts';

// Zod schemas and types generated from each pinned contract (ADR 0024). Output is committed.
// `inventory` is pinned but not generated: its OpenAPI is not valid YAML (`src/inventory/code.ts`).
export default defineConfig([
  {
    input: './src/social/openapi.yaml',
    output: { path: './src/social/generated', postProcess: ['prettier'] },
    plugins: ['@hey-api/typescript', 'zod'],
  },
  {
    input: './src/economie/openapi.yaml',
    output: { path: './src/economie/generated', postProcess: ['prettier'] },
    plugins: ['@hey-api/typescript', 'zod'],
  },
  {
    input: './src/universesimulator/openapi.yaml',
    output: { path: './src/universesimulator/generated', postProcess: ['prettier'] },
    plugins: ['@hey-api/typescript', 'zod'],
  },
  {
    input: './src/npc/openapi.yaml',
    output: { path: './src/npc/generated', postProcess: ['prettier'] },
    plugins: ['@hey-api/typescript', 'zod'],
  },
  {
    input: './src/mission/openapi.yaml',
    output: { path: './src/mission/generated', postProcess: ['prettier'] },
    plugins: ['@hey-api/typescript', 'zod'],
  },
]);
