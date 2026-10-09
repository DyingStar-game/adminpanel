import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Rules of the accepted ADRs that lint does not check (ADR 0010, 0013, 0014, 0020). An accepted
 * ADR is followed to the letter: when one of these fails, fix the code, never this file — except
 * to remove an entry from a debt list once it is paid.
 */

// Plain paths: jsdom's URL class is not the one `node:fs` accepts.
const SRC = dirname(fileURLToPath(import.meta.url));
const at = (path: string) => join(SRC, path);
const read = (path: string) => readFileSync(at(path), 'utf8');
const list = (dir: string, ext: string) =>
  readdirSync(at(dir))
    .filter((name) => name.endsWith(ext) && !name.includes('.test.'))
    .map((name) => `${dir}/${name}`);

const LEVELS = ['atoms', 'molecules', 'organisms', 'templates'].map((l) => `components/${l}`);
const COMPONENTS = LEVELS.flatMap((dir) => list(dir, '.tsx'));
const PAGES = list('pages', 'Page.tsx');

/**
 * Debt left by lot 1 (2026-10-08): components without their own test, pages without a
 * template. Frozen: it may only shrink. Anything new follows the rules.
 */
const UNTESTED_DEBT = new Set([
  'components/atoms/BrandMark.tsx',
  'components/atoms/CopyButton.tsx',
  'components/atoms/GithubMark.tsx',
  'components/atoms/LiveDot.tsx',
  'components/atoms/MonoText.tsx',
  'components/atoms/TypeDot.tsx',
  'components/molecules/CrumbTrail.tsx',
  'components/molecules/EntityPicker.tsx',
  'components/molecules/FindingView.tsx',
  'components/molecules/JsonDropField.tsx',
  'components/molecules/LiveToggle.tsx',
  'components/molecules/MapLegend.tsx',
  'components/molecules/PageHeading.tsx',
  'components/molecules/PropertyRow.tsx',
  'components/molecules/RawJson.tsx',
  'components/molecules/SceneCombobox.tsx',
  'components/molecules/SpawnOffsets.tsx',
  'components/molecules/UpdatedAt.tsx',
  'components/molecules/UuidLink.tsx',
  'components/molecules/WriteConfirm.tsx',
  'components/organisms/BodyMapCanvas.tsx',
  'components/organisms/CheckNotice.tsx',
  'components/organisms/ChildrenTabs.tsx',
  'components/organisms/DeleteItemDialog.tsx',
  'components/organisms/DuplicateDialog.tsx',
  'components/organisms/HeadlineFacts.tsx',
  'components/organisms/HierarchyTree.tsx',
  'components/organisms/ImportResults.tsx',
  'components/organisms/ItemCreateSheet.tsx',
  'components/organisms/ItemEditSheet.tsx',
  'components/organisms/ItemsTable.tsx',
  'components/organisms/OrbitGraph.tsx',
  'components/organisms/PropertiesEditor.tsx',
  'components/organisms/PropertySections.tsx',
  'components/organisms/RelationsList.tsx',
  'components/organisms/SchematicCard.tsx',
  'components/templates/AppShell.tsx',
  'components/templates/ExplorerLayout.tsx',
  'components/templates/ObjectPageLayout.tsx',
  'components/templates/OrbitLayout.tsx',
]);
const NO_TEMPLATE_DEBT = new Set(['pages/ImportPage.tsx']);

describe('conventions of the accepted ADRs', () => {
  it('ADR 0014: every component has its tests next to it', () => {
    const missing = COMPONENTS.filter(
      (file) => !UNTESTED_DEBT.has(file) && !existsSync(at(file.replace(/\.tsx$/, '.test.tsx'))),
    );
    expect(missing, 'components without a sibling .test.tsx').toEqual([]);
  });

  it('ADR 0014: the debt lists only hold files that still break the rule', () => {
    const paid = [...UNTESTED_DEBT].filter((file) =>
      existsSync(at(file.replace(/\.tsx$/, '.test.tsx'))),
    );
    const paidPages = [...NO_TEMPLATE_DEBT].filter((file) =>
      read(file).includes('@/components/templates/'),
    );
    expect([...paid, ...paidPages], 'remove these from the debt lists').toEqual([]);
  });

  it('ADR 0014: pages wire a template to data', () => {
    const missing = PAGES.filter(
      (file) => !NO_TEMPLATE_DEBT.has(file) && !read(file).includes('@/components/templates/'),
    );
    expect(missing, 'pages rendering no template').toEqual([]);
  });

  it('ADR 0014: component folders hold components only (helpers go to lib/)', () => {
    const stray = LEVELS.flatMap((dir) => list(dir, '.ts'));
    expect(stray, 'non-component files under components/').toEqual([]);
  });

  it('ADR 0014: tables are built on TanStack Table', () => {
    const raw = [...COMPONENTS, ...PAGES].filter(
      (file) => /<table[\s>]/.test(read(file)) && !read(file).includes('@tanstack/react-table'),
    );
    expect(raw, 'hand-made <table> elements').toEqual([]);
  });

  it('ADR 0010: forms of organisms and pages use React Hook Form', () => {
    const owners = [...COMPONENTS.filter((f) => f.includes('/organisms/')), ...PAGES];
    const unmanaged = owners.filter((file) => {
      const source = read(file);
      return /<(form|Textarea)[\s>]/.test(source) && !/useForm[<(]/.test(source);
    });
    expect(unmanaged, 'forms without useForm').toEqual([]);
  });

  it('ADR 0020: text sizes come from the scale, not arbitrary values', () => {
    const arbitrary = [...COMPONENTS, ...PAGES].filter((file) =>
      /\btext-\[[^\]]+\]/.test(read(file)),
    );
    expect(arbitrary, 'arbitrary text-[…] sizes').toEqual([]);
  });
});
