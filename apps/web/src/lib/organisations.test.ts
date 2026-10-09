import { describe, expect, it } from 'vitest';
import { createSocialDataset, organisationIds } from '@dyingstar-admin/testing';
import { corporationMembers, organisationRoles, politicalMembers } from './organisations';

const data = createSocialDataset();
const profile = (playerId: string) => {
  const found = data.players.find((p) => p.playerId === playerId);
  if (!found) throw new Error(`fixture player ${playerId} missing`);
  return found;
};

describe('organisation rows', () => {
  it('gives a corporation member their rank, the CEO marked as head', () => {
    const [m] = data.corporationMembers;
    const rank = data.ranks.find((r) => r.id === m?.rankId);
    if (!m || !rank) throw new Error('fixture membership missing');
    const row = {
      ...profile(m.playerId),
      joinedAt: m.joinedAt,
      rank,
      status: 'online' as const,
      location: null,
    };

    expect(corporationMembers([row])).toEqual([
      {
        playerId: m.playerId,
        displayName: 'griefer42',
        role: 'CEO',
        head: true,
        status: 'online',
        joinedAt: m.joinedAt,
      },
    ]);
  });

  it('gives a political member their office', () => {
    const m = data.politicalMembers.find((p) => p.officeId === 5);
    const office = data.offices.find((o) => o.id === 5);
    if (!m || !office) throw new Error('fixture membership missing');
    const row = {
      ...profile(m.playerId),
      joinedAt: m.joinedAt,
      office,
      status: 'offline' as const,
      location: null,
    };

    expect(politicalMembers([row])[0]).toMatchObject({ role: 'Citizen', head: false });
  });

  it('lists ranks and offices highest first, flagging head and default', () => {
    const offices = data.offices.filter((o) => o.entityId === organisationIds.commune).reverse();
    expect(organisationRoles(offices).map((r) => [r.name, r.head, r.isDefault])).toEqual([
      ['Mayor', true, false],
      ['Councilor', false, false],
      ['Citizen', false, true],
    ]);
  });
});
