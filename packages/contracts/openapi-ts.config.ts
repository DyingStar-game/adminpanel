import { defineConfig } from '@hey-api/openapi-ts';

// Zod schemas and types generated from each pinned contract (ADR 0024). Output is committed.
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
]);
