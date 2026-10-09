import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    // Capped: with minikube and the dev servers running, one worker per core starved the jsdom
    // tests into 5 s timeouts (2026-10-09); eight keep the suite fast and stable.
    maxWorkers: 8,
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**', 'packages/*/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/test/**', 'apps/web/src/routeTree.gen.ts'],
    },
  },
});
