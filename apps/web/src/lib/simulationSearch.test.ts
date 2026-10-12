import { describe, expect, it } from 'vitest';
import { SimulationSearchSchema } from './simulationSearch';

describe('SimulationSearchSchema', () => {
  it('opens the overview by default and drops what is not valid', () => {
    expect(SimulationSearchSchema.parse({})).toEqual({ tab: 'overview' });
    expect(SimulationSearchSchema.parse({ tab: 'nope', resource: 'x', status: 'lost' })).toEqual({
      tab: 'overview',
    });
  });

  it('keeps a tab, ids and a status', () => {
    const resource = '00000000-0000-4000-8000-000000000001';
    expect(
      SimulationSearchSchema.parse({ tab: 'orders', resource, status: 'in_progress' }),
    ).toEqual({ tab: 'orders', resource, status: 'in_progress' });
  });
});
