/** Game services whose contract the panel pins (ADR 0024, 0025), and where they come from. */
export const SERVICES = ['social', 'economie', 'universesimulator'] as const;
export type Service = (typeof SERVICES)[number];

export const SOURCE_REPO = 'DyingStar-game/services';
export const SOURCE_REF = 'develop';

/** Where a pinned contract comes from (`src/<service>/source.json`). */
export interface ContractSource {
  repo: string;
  ref: string;
  path: string;
  /**
   * Commit of the pinned copy; `null` while the file is not on GitHub yet (pinned from the back
   * team's working copy, `universesimulator` on 2026-10-11): the sync test then skips it until
   * it appears there.
   */
  commit: string | null;
  date: string | null;
  note?: string;
}
