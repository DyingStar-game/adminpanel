import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_ITEMS } from '@dyingstar-admin/schemas';
import {
  importSummary,
  itemRanges,
  normalizeImport,
  overwriteRequest,
  parseImportText,
  sendWaves,
} from './importInput';

describe('parseImportText', () => {
  it('reads an array, or a single item as an array of one', () => {
    expect(parseImportText('[{"object_type":"box"}]')).toEqual({
      ok: true,
      items: [{ object_type: 'box' }],
    });
    expect(parseImportText('{"object_type":"box"}')).toEqual({
      ok: true,
      items: [{ object_type: 'box' }],
    });
  });

  it('gives the line and column of a syntax error, strict JSON only', () => {
    const result = parseImportText('[\n  {"a": 1},\n  {"b": 2,}\n]');
    expect(result).toMatchObject({ ok: false, reason: 'syntax', line: 3 });
    expect(parseImportText('// comment\n[]')).toMatchObject({
      ok: false,
      reason: 'syntax',
      line: 1,
    });
  });

  it('refuses empty input, scalars and too many items', () => {
    expect(parseImportText('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseImportText('42')).toEqual({ ok: false, reason: 'notArray' });
    const many = JSON.stringify(Array.from({ length: IMPORT_MAX_ITEMS + 1 }, () => ({})));
    expect(parseImportText(many)).toMatchObject({ ok: false, reason: 'tooMany' });
  });
});

describe('normalizeImport', () => {
  it('generates missing UUIDs and gives the default parent to items without one', () => {
    let n = 0;
    const { items, generated, parented } = normalizeImport(
      [
        { object_type: 'box', object_data: {} },
        { object_type: 'box', object_uuid: 'u', object_data: { parent_id: '' } },
        'not an item',
        { object_type: 'box', object_uuid: null, object_data: { parent_id: '' } },
      ],
      { defaultParentId: 'level', newUuid: () => `gen-${++n}` },
    );
    expect(items).toEqual([
      { object_type: 'box', object_uuid: 'gen-1', object_data: { parent_id: 'level' } },
      { object_type: 'box', object_uuid: 'u', object_data: { parent_id: '' } },
      'not an item',
      { object_type: 'box', object_uuid: 'gen-2', object_data: { parent_id: '' } },
    ]);
    // Business rule: a `null` UUID is generated too.
    expect([...generated]).toEqual([0, 3]);
    expect([...parented]).toEqual([0]);
  });

  it('leaves parents alone without a default level', () => {
    const { items } = normalizeImport([{ object_uuid: 'u', object_data: {} }], {
      defaultParentId: null,
      newUuid: () => 'x',
    });
    expect(items).toEqual([{ object_uuid: 'u', object_data: {} }]);
  });
});

describe('sendWaves', () => {
  it('sends parents in an earlier wave than their children, input order inside a wave', () => {
    const items = [
      { object_uuid: 'wheel', object_data: { parent_id: 'truck' } },
      { object_uuid: 'other', object_data: { parent_id: '' } },
      { object_uuid: 'truck', object_data: { parent_id: 'planet' } },
      { object_uuid: 'planet', object_data: { parent_id: '' } },
    ];
    expect(sendWaves(items, [0, 1, 2, 3])).toEqual([[1, 3], [2], [0]]);
    // A parent that is not sent (skipped) does not delay its children.
    expect(sendWaves(items, [0, 1])).toEqual([[0, 1]]);
  });
});

describe('importSummary and overwriteRequest', () => {
  it('counts statuses and rows with warnings', () => {
    const warning = { code: 'sceneUnknown' as const, severity: 'warning' as const };
    expect(
      importSummary([
        { index: 0, object_uuid: 'a', object_type: 'box', status: 'new', findings: [warning] },
        { index: 1, object_uuid: 'b', object_type: 'box', status: 'conflict', findings: [] },
        { index: 2, object_uuid: null, object_type: null, status: 'invalid', findings: [] },
      ]),
    ).toEqual({ invalid: 1, new: 1, conflict: 1, warnings: 1 });
  });

  it('replaces every stored key by the imported ones', () => {
    expect(overwriteRequest({ a: 1, b: 2 }, 'box', { b: 3, c: 4 })).toEqual({
      object_type: 'box',
      base: { a: 1, b: 2 },
      changes: { b: 3, c: 4 },
      removed: ['a'],
      force: true,
    });
  });
});

describe('itemRanges', () => {
  it('gives the lines of every item of the array, or of the single item', () => {
    const text = '[\n  {"a": 1},\n  {\n    "b": 2\n  }\n]';
    expect(itemRanges(text)).toEqual([
      { offset: 4, fromLine: 2, toLine: 2 },
      { offset: 16, fromLine: 3, toLine: 5 },
    ]);
    expect(itemRanges('{"a": 1}')).toEqual([{ offset: 0, fromLine: 1, toLine: 1 }]);
  });
});
