import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'bff',
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
