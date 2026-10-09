import { describe, expect, it } from 'vitest';
import { reportActions } from './reports';

describe('report workflow (ADR 0024)', () => {
  it('claims an open report before anything else', () => {
    expect(reportActions('open')).toEqual(['reviewing']);
  });

  it('then confirms, dismisses or escalates it', () => {
    expect(reportActions('reviewing')).toEqual(['resolved', 'dismissed', 'escalate']);
  });

  it('allows nothing on a closed report', () => {
    expect(reportActions('resolved')).toEqual([]);
    expect(reportActions('dismissed')).toEqual([]);
  });
});
