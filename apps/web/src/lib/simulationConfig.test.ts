import { describe, expect, it } from 'vitest';
import { createUniversesimulatorDataset, simulationIds as ids } from '@dyingstar-admin/testing';
import {
  capacityToSend,
  CapacityFormSchema,
  flowChange,
  FlowFormSchema,
  flowFormValues,
  flowToCreate,
  PolicyFormSchema,
  policyToSend,
} from './simulationConfig';

const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  (result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]);

describe('PolicyFormSchema', () => {
  it('accepts a target equal to the threshold', () => {
    expect(PolicyFormSchema.safeParse({ minThreshold: 100, targetLevel: 100 }).success).toBe(true);
  });

  it("mirrors the service's rule: 0 ≤ threshold ≤ target, whole numbers", () => {
    expect(issues(PolicyFormSchema.safeParse({ minThreshold: 300, targetLevel: 200 }))).toEqual([
      ['targetLevel', 'targetBelowThreshold'],
    ]);
    expect(issues(PolicyFormSchema.safeParse({ minThreshold: -1, targetLevel: 1.5 }))).toEqual([
      ['minThreshold', 'wholeNumber'],
      ['targetLevel', 'wholeNumber'],
    ]);
    expect(policyToSend('v', 'r', { minThreshold: 1, targetLevel: 2 })).toEqual({
      villageId: 'v',
      resourceId: 'r',
      minThreshold: 1,
      targetLevel: 2,
    });
  });
});

describe('capacities', () => {
  it('sends null for an empty capacity, refuses a negative one', () => {
    expect(capacityToSend('w', 'r', { capacity: Number.NaN })).toEqual({
      warehouseId: 'w',
      resourceId: 'r',
      capacity: null,
    });
    expect(issues(CapacityFormSchema.safeParse({ capacity: -3 }))).toEqual([
      ['capacity', 'wholeNumber'],
    ]);
  });
});

describe('flows', () => {
  it('refuses a zero or empty rate', () => {
    const form = { resourceId: ids.water, source: 'manual' as const, label: '' };
    expect(issues(FlowFormSchema.safeParse({ ...form, ratePerHour: 0 }))).toEqual([
      ['ratePerHour', 'zeroRate'],
    ]);
    expect(issues(FlowFormSchema.safeParse({ ...form, ratePerHour: Number.NaN }))).toEqual([
      ['ratePerHour', 'number'],
    ]);
  });

  it('sends the label when typed, only what changed, and null to clear it', () => {
    expect(
      flowToCreate('v', { resourceId: 'r', ratePerHour: -5, source: 'population', label: ' A ' }),
    ).toEqual({
      villageId: 'v',
      resourceId: 'r',
      ratePerHour: -5,
      source: 'population',
      label: 'A',
    });
    const flow = createUniversesimulatorDataset().flows[0];
    if (!flow) throw new Error('fixture missing');
    const values = flowFormValues(flow);
    expect(flowChange(flow, values)).toEqual({});
    expect(flowChange(flow, { ...values, ratePerHour: 300 })).toEqual({ ratePerHour: 300 });
    expect(flowChange(flow, { ...values, label: '  ' })).toEqual({ label: null });
    expect(flowChange(flow, { ...values, label: 'Wells' })).toEqual({ label: 'Wells' });
  });
});
