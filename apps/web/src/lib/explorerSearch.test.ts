import { describe, expect, it } from 'vitest';
import { ExplorerSearchSchema, searchForItem } from './explorerSearch';

describe('ExplorerSearchSchema', () => {
  it('defaults to the roots and repairs invalid values', () => {
    expect(ExplorerSearchSchema.parse({})).toEqual({ parent: '', scope: 'level', page: 1 });
    expect(ExplorerSearchSchema.parse({ page: 'x', scope: 'nope', type: '' })).toEqual({
      parent: '',
      scope: 'level',
      page: 1,
    });
  });

  it('opens an item inside its level', () => {
    const item = { object_type: 'vehicle', object_uuid: 'v', object_data: { parent_id: 'p' } };
    expect(searchForItem(item)).toEqual({
      parent: 'p',
      type: 'vehicle',
      scope: 'level',
      page: 1,
      selected: 'v',
    });
  });
});
