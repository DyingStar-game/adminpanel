/** Game services whose contract the panel pins (ADR 0024), and where they come from. */
export const SERVICES = ['social'] as const;
export type Service = (typeof SERVICES)[number];

export const SOURCE_REPO = 'DyingStar-game/services';
export const SOURCE_REF = 'develop';
