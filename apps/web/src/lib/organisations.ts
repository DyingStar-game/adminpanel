import type {
  CorporationMember,
  CorporationRank,
  PoliticalMember,
  PoliticalOffice,
  PresenceStatus,
} from '@dyingstar-admin/contracts/social';

/** A member of a corporation (with a rank) or a political entity (with an office). */
export interface OrganisationMember {
  playerId: string;
  displayName: string;
  /** Their rank or office. */
  role: string;
  /** CEO or head office. */
  head: boolean;
  status: PresenceStatus;
  joinedAt: string;
}

/** A corporation's rank or a political entity's office. */
export interface OrganisationRole {
  id: number;
  name: string;
  /** Higher wins: a member acts only on roles strictly below their own. */
  priority: number;
  permissions: string[];
  /** CEO rank or head office: unique, every permission. */
  head: boolean;
  /** Given to new members. */
  isDefault: boolean;
}

const member = (
  m: CorporationMember | PoliticalMember,
  role: CorporationRank | PoliticalOffice,
) => ({
  playerId: m.playerId,
  displayName: m.displayName,
  role: role.name,
  head: 'isCeo' in role ? role.isCeo : role.isHead,
  status: m.status,
  joinedAt: m.joinedAt,
});

export const corporationMembers = (members: CorporationMember[]): OrganisationMember[] =>
  members.map((m) => member(m, m.rank));

export const politicalMembers = (members: PoliticalMember[]): OrganisationMember[] =>
  members.map((m) => member(m, m.office));

/** Ranks or offices, highest first (as `social` lists them). */
export const organisationRoles = (
  roles: (CorporationRank | PoliticalOffice)[],
): OrganisationRole[] =>
  roles
    .map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      permissions: r.permissions,
      head: 'isCeo' in r ? r.isCeo : r.isHead,
      isDefault: r.isDefault,
    }))
    .sort((a, b) => b.priority - a.priority);
