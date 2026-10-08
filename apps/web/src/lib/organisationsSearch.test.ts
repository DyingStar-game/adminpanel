import { describe, expect, it } from 'vitest';
import { OrganisationSearchSchema, OrganisationsSearchSchema } from './organisationsSearch';

describe('organisations search params', () => {
  it('opens the corporations, first page, by default', () => {
    expect(OrganisationsSearchSchema.parse({})).toEqual({ tab: 'corporations', q: '', page: 1 });
  });

  it('keeps a valid political level and drops a wrong one', () => {
    expect(OrganisationsSearchSchema.parse({ tab: 'politics', type: 'country' })).toMatchObject({
      tab: 'politics',
      type: 'country',
    });
    expect(OrganisationsSearchSchema.parse({ type: 'empire', page: '-2' })).toMatchObject({
      type: undefined,
      page: 1,
    });
  });

  it("pages an organisation's members and children apart", () => {
    expect(OrganisationSearchSchema.parse({ members: '3' })).toEqual({ members: 3, children: 1 });
  });
});
