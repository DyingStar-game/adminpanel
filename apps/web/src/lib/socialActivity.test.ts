import { describe, expect, it } from 'vitest';
import { activityFamily, activityPlayerId, eventTone } from './socialActivity';

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

  it('names the other player of an activity, the target of a report included', () => {
    const id = '5b1d3c1e-0000-4000-8000-0000000000b2';
    expect(activityPlayerId({ playerId: id })).toBe(id);
    expect(activityPlayerId({ reportId: 3, targetType: 'player', targetId: id })).toBe(id);
    expect(activityPlayerId({ reportId: 4, targetType: 'corporation', targetId: id })).toBeNull();
    expect(activityPlayerId(null)).toBeNull();
  });
});
