/**
 * Activity types `social` records for a player (its services' `recordActivity` calls, checked
 * 2026-10-08), by family. The game may record its own types too (internal route): shown as is.
 */
export const ACTIVITY_FAMILIES = {
  profile: ['profile_created', 'npc_profile_created', 'profile_updated'],
  sanction: ['sanction_received', 'sanction_revoked'],
  report: ['report_filed', 'report_reviewing', 'report_resolved', 'report_dismissed'],
  reputation: ['reputation_rehabilitated'],
  friends: [
    'friend_request_sent',
    'friend_request_received',
    'friend_request_declined',
    'friend_request_cancelled',
    'friend_added',
    'friend_removed',
    'player_blocked',
    'player_unblocked',
  ],
  corporation: [
    'corporation_created',
    'corporation_disbanded',
    'corporation_joined',
    'corporation_left',
    'corporation_kicked',
    'corporation_rank_changed',
    'corporation_ceo_received',
    'corporation_application_sent',
    'corporation_application_declined',
    'corporation_application_withdrawn',
    'corporation_invitation_received',
    'corporation_invitation_declined',
  ],
  group: ['group_joined', 'group_left', 'group_disbanded', 'group_invitation_received'],
  politics: [
    'political_entity_created',
    'political_entity_disbanded',
    'political_member_appointed',
    'political_member_removed',
    'political_member_left',
    'political_office_changed',
    'political_head_received',
  ],
} as const;

export type ActivityFamily = keyof typeof ACTIVITY_FAMILIES;
export type KnownActivity = (typeof ACTIVITY_FAMILIES)[ActivityFamily][number];

const FAMILY_OF = new Map<string, ActivityFamily>(
  Object.entries(ACTIVITY_FAMILIES).flatMap(([family, types]) =>
    types.map((type) => [type, family as ActivityFamily] as const),
  ),
);

/** Family of a known activity type, or null for a type the game recorded itself. */
export const activityFamily = (type: string): ActivityFamily | null => FAMILY_OF.get(type) ?? null;

/** Badge colour per family. */
export const FAMILY_TONE: Record<ActivityFamily, string> = {
  profile: 'border-border text-fg-2',
  sanction: 'border-amber-500/50 bg-amber-500/10 text-amber-500',
  report: 'border-link/40 bg-link-bg text-link',
  reputation: 'border-success/40 bg-success/10 text-success',
  friends: 'border-border text-foreground',
  corporation: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  group: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  politics: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
};
