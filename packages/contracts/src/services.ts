/** Game services whose contract the panel pins (ADR 0024, 0025, 0031), and where they come from. */
export const SERVICES = [
  'social',
  'economie',
  'universesimulator',
  'npc',
  'mission',
  'inventory',
] as const;
export type Service = (typeof SERVICES)[number];

export const SOURCE_REPO = 'DyingStar-game/services';

/**
 * The branch each contract is pinned from: `develop`, unless the panel builds on a route the
 * back team has not merged yet (`mission` was pinned from `fix-mission` until its PR #37 was
 * merged, 2026-10-22).
 */
export const SOURCE_REFS: Record<Service, string> = {
  social: 'develop',
  economie: 'develop',
  universesimulator: 'develop',
  npc: 'develop',
  mission: 'develop',
  inventory: 'develop',
};

/** Where a pinned contract comes from (`src/<service>/source.json`). */
export interface ContractSource {
  repo: string;
  ref: string;
  path: string;
  /**
   * Commit of the pinned copy; `null` while the file is not on GitHub yet (pinned from the back
   * team's working copy: `universesimulator` on 2026-10-11, `npc` on 2026-10-25): the sync test then skips it until
   * it appears there.
   */
  commit: string | null;
  date: string | null;
  note?: string;
}
