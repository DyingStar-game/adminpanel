import { describe, expect, it } from 'vitest';
import { activityFamily, eventTone } from './socialActivity';

describe('social events', () => {
  it('gives the same event the same colour in the activity and the log', () => {
    // Received (activity) and given (log): the same sanction.
    expect(eventTone('sanction_received')).toBe(eventTone('sanction_issued'));
    expect(eventTone('sanction_revoked')).toContain('text-success');
    expect(eventTone('report_resolved')).toContain('text-success');
    expect(eventTone('report_escalated')).toBe(eventTone('auto_escalated'));
  });

  it("falls back on the family, then on neutral for the game's own types", () => {
    expect(activityFamily('corporation_joined')).toBe('corporation');
    expect(eventTone('corporation_joined')).toContain('violet');
    expect(activityFamily('mission_completed')).toBeNull();
    expect(eventTone('mission_completed')).toContain('text-fg-2');
  });
});
