import type {
  MissionAsServed,
  MissionCatalogue,
  MissionCatalogueQuery,
  MissionSort,
  PanelMissionCatalogueQuery,
} from '@dyingstar-admin/contracts/mission';

/** Rows `mission` serves in one call at most (its `limit`). */
export const CATALOGUE_BATCH = 100;
/** Missions read at most for a search or a sort: past it, the oldest are left out and said so. */
export const CATALOGUE_CAP = 5_000;

/** The credits a mission pays, 0 when it pays none (items, standing). */
export const creditsOf = (mission: Pick<MissionAsServed, 'rewards'>): number =>
  (mission.rewards ?? []).reduce(
    (sum, reward) => sum + (reward.type === 'credits' ? reward.amount : 0),
    0,
  );

/** Whether a mission's title holds the words searched, whatever their case. */
export const titleMatches = (mission: Pick<MissionAsServed, 'title'>, q: string): boolean =>
  mission.title.toLowerCase().includes(q.trim().toLowerCase());

const byCreation = (a: MissionAsServed, b: MissionAsServed) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * The missions in the order asked, on a copy. Equal titles and equal rewards keep the newest
 * first, as the catalogue's own order does.
 */
export function sortMissions(missions: MissionAsServed[], sort: MissionSort): MissionAsServed[] {
  const newest = (a: MissionAsServed, b: MissionAsServed) => byCreation(b, a);
  const order: Record<MissionSort, (a: MissionAsServed, b: MissionAsServed) => number> = {
    newest,
    oldest: byCreation,
    // Numbers in a title in their own order: "zone M0002" before "zone M0010".
    title: (a, b) =>
      a.title.localeCompare(b.title, 'en', { numeric: true, sensitivity: 'base' }) || newest(a, b),
    rewardHigh: (a, b) => creditsOf(b) - creditsOf(a) || newest(a, b),
    rewardLow: (a, b) => creditsOf(a) - creditsOf(b) || newest(a, b),
  };
  return [...missions].sort(order[sort]);
}

/**
 * The catalogue's page as the panel asks for it (ADR 0024 step O). Without a search nor an order
 * it is `mission`'s own page. With one, `mission` having neither, the whole filtered catalogue is
 * read (by calls of CATALOGUE_BATCH, CATALOGUE_CAP missions at most), searched, sorted, and the
 * page cut here: `total` is then what the search found.
 */
export async function missionCataloguePage(
  read: (query: MissionCatalogueQuery) => Promise<MissionCatalogue>,
  { q, sort, ...query }: PanelMissionCatalogueQuery,
): Promise<MissionCatalogue> {
  if (!q && !sort) return read(query);
  const all: MissionAsServed[] = [];
  for (let offset = 0; offset < CATALOGUE_CAP; offset += CATALOGUE_BATCH) {
    const page = await read({ ...query, limit: CATALOGUE_BATCH, offset });
    all.push(...page.missions);
    if (page.missions.length < CATALOGUE_BATCH || all.length >= page.total) break;
  }
  const found = q ? all.filter((mission) => titleMatches(mission, q)) : all;
  const sorted = sortMissions(found, sort ?? 'newest');
  return {
    missions: sorted.slice(query.offset, query.offset + query.limit),
    total: sorted.length,
    limit: query.limit,
    offset: query.offset,
  };
}
