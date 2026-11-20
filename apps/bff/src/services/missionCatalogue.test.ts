import { describe, expect, it, vi } from 'vitest';
import type { MissionAsServed, MissionCatalogueQuery } from '@dyingstar-admin/contracts/mission';
import {
  CATALOGUE_BATCH,
  creditsOf,
  missionCataloguePage,
  sortMissions,
  titleMatches,
} from './missionCatalogue';

/** A mission as far as the catalogue's search and order read it. */
const mission = (n: number, title: string, credits: number): MissionAsServed =>
  ({
    id: `3a55105e-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title,
    rewards: credits ? [{ type: 'credits', currency: 'credits', amount: credits }] : null,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString(),
  }) as MissionAsServed;

const titles = (missions: MissionAsServed[]) => missions.map((m) => m.title);

describe('mission catalogue (ADR 0024 step O)', () => {
  const a = mission(1, 'Inspect zone M0010-A', 3_000);
  const b = mission(2, 'Inspect zone M0002-B', 12_000);
  const c = mission(3, 'Repair the dispenser of M0002', 0);

  it('searches the titles whatever the case', () => {
    expect(titleMatches(a, 'm0010')).toBe(true);
    expect(titleMatches(c, ' Dispenser ')).toBe(true);
    expect(titleMatches(a, 'M0002')).toBe(false);
  });

  it('counts the credits a mission pays, none for another reward', () => {
    expect(creditsOf(b)).toBe(12_000);
    expect(creditsOf(c)).toBe(0);
  });

  it('sorts by date, by title with its numbers in order, by reward', () => {
    const all = [a, b, c];
    expect(titles(sortMissions(all, 'newest'))).toEqual(titles([c, b, a]));
    expect(titles(sortMissions(all, 'oldest'))).toEqual(titles([a, b, c]));
    expect(titles(sortMissions(all, 'title'))).toEqual(titles([b, a, c]));
    expect(titles(sortMissions(all, 'rewardHigh'))).toEqual(titles([b, a, c]));
    expect(titles(sortMissions(all, 'rewardLow'))).toEqual(titles([c, a, b]));
    expect(all).toEqual([a, b, c]);
  });

  it("leaves the service's own page alone without a search nor an order", async () => {
    const read = vi.fn(async (query: MissionCatalogueQuery) => ({
      missions: [a],
      total: 240,
      limit: query.limit,
      offset: query.offset,
    }));
    const page = await missionCataloguePage(read, { limit: 20, offset: 40, status: 'available' });
    expect(read).toHaveBeenCalledExactlyOnceWith({ limit: 20, offset: 40, status: 'available' });
    expect(page.total).toBe(240);
  });

  it('reads the whole filtered catalogue to search and sort it, then cuts the page', async () => {
    const stored = Array.from({ length: 230 }, (_, i) =>
      mission(
        i,
        i % 2 ? `Inspect zone M${String(i).padStart(4, '0')}` : `Repair lift ${i}`,
        i * 10,
      ),
    );
    const read = vi.fn(async (query: MissionCatalogueQuery) => ({
      missions: stored.slice(query.offset, query.offset + query.limit),
      total: stored.length,
      limit: query.limit,
      offset: query.offset,
    }));
    const page = await missionCataloguePage(read, {
      limit: 20,
      offset: 20,
      category: 'exploration',
      q: 'inspect',
      sort: 'rewardHigh',
    });
    // Three calls of 100 for 230 missions, each with the service's own filters.
    expect(read.mock.calls.map(([query]) => query)).toEqual(
      [0, 100, 200].map((offset) => ({
        limit: CATALOGUE_BATCH,
        offset,
        category: 'exploration',
      })),
    );
    expect(page.total).toBe(115);
    expect(page.missions).toHaveLength(20);
    // The second page of the best paid: 229, 227… then 189 down to 151.
    expect(page.missions[0]?.title).toBe('Inspect zone M0189');
    expect(page.missions.at(-1)?.title).toBe('Inspect zone M0151');
  });
});
