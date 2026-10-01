import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';

/**
 * Atomic design levels of the web app (ADR 0014), lowest first.
 * A level may only import from lower levels; `ui` holds the shadcn/ui primitives.
 */
const LEVELS = ['ui', 'atoms', 'molecules', 'organisms', 'templates', 'pages', 'routes'];
const higherThan = (level) => LEVELS.slice(LEVELS.indexOf(level) + 1);
/** Levels that must stay pure: no data fetching, no API client. */
const PURE_LEVELS = ['ui', 'atoms', 'molecules'];

export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', 'apps/web/src/routeTree.gen.ts', 'docs/design'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['apps/bff/**/*.ts', 'packages/**/*.ts', '*.{js,ts}', 'apps/*/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, boundaries },
    settings: {
      'boundaries/elements': [
        ...['ui', 'atoms', 'molecules', 'organisms', 'templates'].map((type) => ({
          type,
          pattern: `apps/web/src/components/${type}`,
        })),
        { type: 'pages', pattern: 'apps/web/src/pages' },
        { type: 'routes', pattern: 'apps/web/src/routes' },
      ],
      'boundaries/files': [{ category: 'api', pattern: '**/src/lib/api.ts' }],
      'import/resolver': { typescript: { project: 'apps/web/tsconfig.json' } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            ...LEVELS.slice(0, -1).map((level) => ({
              from: { element: { type: level } },
              disallow: { to: { element: { types: { anyOf: higherThan(level) } } } },
            })),
            ...PURE_LEVELS.map((level) => ({
              from: { element: { type: level } },
              disallow: { to: { file: { categories: 'api' } } },
            })),
          ],
        },
      ],
    },
  },
  {
    // Pure levels: props in, events out. Data fetching starts at organisms (ADR 0014).
    files: PURE_LEVELS.map((level) => `apps/web/src/components/${level}/**/*.{ts,tsx}`),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@tanstack/react-query',
              message: 'Atoms and molecules must stay pure: fetch data in organisms or pages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
);
