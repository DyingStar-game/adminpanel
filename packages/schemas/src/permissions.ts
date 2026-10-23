/**
 * What a signed-in user may do in the panel, derived from their Keycloak roles (ADR 0023). The
 * BFF enforces it on every route; the SPA only hides what the user may not do.
 */
export const Permission = {
  persistenceRead: 'persistence.read',
  persistenceCheck: 'persistence.check',
  persistenceWrite: 'persistence.write',
  persistenceDelete: 'persistence.delete',
  /** `social` moderation: stats, log, reports, player sheets, sanctions, warnings and mutes. */
  socialModerate: 'social.moderate',
  /** Suspensions and bans. */
  socialSanctionSevere: 'social.sanctionSevere',
  /** Reputation adjustments. */
  socialReputation: 'social.reputation',
  /** Acting on reports escalated to the `admin` level (the panel's rule, ADR 0024). */
  socialReportsAdmin: 'social.reportsAdmin',
  /** Acting on reports escalated to the `supervisor` level. */
  socialReportsSupervisor: 'social.reportsSupervisor',
  /** Managing corporations through `social`'s internal API (ADR 0023 › Social — management). */
  socialCorporationWrite: 'social.corporationWrite',
  /** Managing political entities, likewise. */
  socialPoliticsWrite: 'social.politicsWrite',
  /** `economie`'s dashboard (its Admin API, ADR 0023 › Economie). */
  economieDashboard: 'economie.dashboard',
  /** Wallets of players, NPCs and corporations (its Interne API, as `svc-admin`). */
  economieWalletRead: 'economie.walletRead',
  /** Political treasuries and their settings, likewise. */
  economiePoliticsRead: 'economie.politicsRead',
  /** A political entity's tax rates, minting policy and tax assessments, likewise. */
  economiePoliticsManage: 'economie.politicsManage',
  /** A corporation's economic settings (internal tax, donations, fiscal home), likewise. */
  economieCorporationRead: 'economie.corporationRead',
  /** Changing them, likewise. */
  economieCorporationManage: 'economie.corporationManage',
  /** Crediting a player's, an NPC's or a corporation's wallet, likewise. */
  economieWalletCredit: 'economie.walletCredit',
  /** Debiting one, likewise. */
  economieWalletDebit: 'economie.walletDebit',
  /** Issuing money into a political treasury, likewise. */
  economieMoneyIssue: 'economie.moneyIssue',
  /** `universesimulator`'s views: dashboard, network, stocks, orders, prices (ADR 0026). */
  simulationView: 'simulation.view',
  /** Pausing, resuming or ticking the simulation, cancelling an order (its Admin writes). */
  simulationManage: 'simulation.manage',
  /** The `npc` service's views: roster, an NPC's routine, tasks, logs and events (ADR 0026). */
  npcView: 'npc.view',
  /** Its Admin writes: global switch, create, spawn, edit, tasks, schedules, workplaces. */
  npcManage: 'npc.manage',
  /** `mission`'s catalogue and a mission's page (its Interne API, as `svc-admin`). */
  missionRead: 'mission.read',
  /** `inventory`'s POIs, named on a mission's objectives (its Interne API, as `svc-admin`). */
  inventoryRead: 'inventory.read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Roles granting each permission (realm roles, or client roles of the panel's client).
 *
 * **Interim, while the panel is in test** (maintainer, 2026-10-08): the draft matrix of ADR 0023
 * with its undecided cells (🟡) allowed. Only the `persistence:*` roles open persistence: the
 * moderation roles (`moderator`, `admin`, `supervisor`) add nothing to it.
 */
export const PERMISSION_ROLES: Record<Permission, readonly string[]> = {
  [Permission.persistenceRead]: ['persistence:read', 'persistence:write', 'persistence:delete'],
  [Permission.persistenceCheck]: ['persistence:read', 'persistence:write', 'persistence:delete'],
  [Permission.persistenceWrite]: ['persistence:write', 'persistence:delete'],
  [Permission.persistenceDelete]: ['persistence:write', 'persistence:delete'],
  // Mirror of `social`'s own roles (`moderator` < `admin` < `supervisor`), which `social` checks
  // itself on every call (ADR 0024): these only decide what the SPA shows.
  [Permission.socialModerate]: ['moderator', 'admin', 'supervisor'],
  [Permission.socialSanctionSevere]: ['admin', 'supervisor'],
  [Permission.socialReputation]: ['admin', 'supervisor'],
  // The panel's own rule, stricter than `social` (which lets any moderator act at any level):
  // a report is handled at its escalation level (ADR 0024 › Update 2026-10-08).
  [Permission.socialReportsAdmin]: ['admin', 'supervisor'],
  [Permission.socialReportsSupervisor]: ['supervisor'],
  // The capability roles of `social`'s README (› Interne), held by the person as client roles
  // on `dyingstar-admin`; the panel then calls as `svc-admin` (ADR 0023 › Social — management).
  [Permission.socialCorporationWrite]: ['social:corporation:write'],
  [Permission.socialPoliticsWrite]: ['social:politics:write'],
  // `economie`, same rule (ADR 0023 › Economie): its Admin API checks the moderation roles; its
  // Interne API is opened by the capability roles of its README held by the person.
  [Permission.economieDashboard]: ['moderator', 'admin', 'supervisor'],
  [Permission.economieWalletRead]: ['economie:wallet:read'],
  // Changing a setting needs to read it first: `:manage` opens the matching reads too.
  [Permission.economiePoliticsRead]: ['economie:politics:read', 'economie:politics:manage'],
  [Permission.economiePoliticsManage]: ['economie:politics:manage'],
  [Permission.economieCorporationRead]: [
    'economie:corporation:read',
    'economie:corporation:manage',
  ],
  [Permission.economieCorporationManage]: ['economie:corporation:manage'],
  // Money movements (step O.3); a political treasury's are `economie:politics:manage`'s.
  [Permission.economieWalletCredit]: ['economie:wallet:credit'],
  [Permission.economieWalletDebit]: ['economie:wallet:debit'],
  [Permission.economieMoneyIssue]: ['economie:money:issue'],
  // Mirror of `universesimulator`'s Admin API (ADR 0026): its reads need a moderation role, its
  // writes `admin` or `supervisor` (`src/auth/mod.rs` › `MODERATION`, `require_admin`); it checks
  // them itself on the person's token.
  [Permission.simulationView]: ['moderator', 'admin', 'supervisor'],
  [Permission.simulationManage]: ['admin', 'supervisor'],
  // Mirror of the `npc` service's Admin API (ADR 0026), same model as universesimulator's
  // (`src/auth/mod.rs` › `MODERATION`, `Caller::require_admin`), checked on the person's token.
  [Permission.npcView]: ['moderator', 'admin', 'supervisor'],
  [Permission.npcManage]: ['admin', 'supervisor'],
  // `mission`, same rule (ADR 0023 › Mission): its README has no Admin section; its Interne API
  // is opened by the capability role of its README held by the person.
  [Permission.missionRead]: ['mission:read'],
  // `inventory`, same rule (ADR 0023 › Inventory, ADR 0026).
  [Permission.inventoryRead]: ['inventory:read'],
};

/** Permission needed to change the status of, or escalate, a report at each escalation level. */
export const REPORT_LEVEL_PERMISSION: Record<'moderator' | 'admin' | 'supervisor', Permission> = {
  moderator: Permission.socialModerate,
  admin: Permission.socialReportsAdmin,
  supervisor: Permission.socialReportsSupervisor,
};

/** Whose wallet: `economie` keeps players, NPCs, corporations and political entities apart. */
export type WalletHolder = 'players' | 'npcs' | 'corporations' | 'politics';

/**
 * Permission to credit or debit a holder's wallet (step O.3): `economie`'s README asks
 * `economie:wallet:credit` / `:debit`, and `economie:politics:manage` for a political treasury.
 */
export const movementPermission = (
  holder: WalletHolder,
  direction: 'credit' | 'debit',
): Permission =>
  holder === 'politics'
    ? Permission.economiePoliticsManage
    : direction === 'credit'
      ? Permission.economieWalletCredit
      : Permission.economieWalletDebit;

export const ALL_PERMISSIONS = Object.values(Permission);

/** Permissions held through `roles`; none means the panel stays closed. */
export const permissionsOf = (roles: readonly string[]): Permission[] =>
  ALL_PERMISSIONS.filter((permission) =>
    PERMISSION_ROLES[permission].some((role) => roles.includes(role)),
  );
