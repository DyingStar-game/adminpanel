import { describe, expect, it } from 'vitest';
import { Permission, permissionsOf, REPORT_LEVEL_PERMISSION } from './permissions';

describe('permissionsOf (interim matrix, ADR 0023)', () => {
  it('opens nothing to a player', () => {
    expect(permissionsOf(['player'])).toEqual([]);
  });

  it('lets persistence:read browse and run checks, not write', () => {
    expect(permissionsOf(['persistence:read'])).toEqual([
      Permission.persistenceRead,
      Permission.persistenceCheck,
    ]);
  });

  it('lets persistence:write and persistence:delete do everything on persistence', () => {
    for (const role of ['persistence:write', 'persistence:delete']) {
      expect(permissionsOf([role])).toEqual([
        Permission.persistenceRead,
        Permission.persistenceCheck,
        Permission.persistenceWrite,
        Permission.persistenceDelete,
      ]);
    }
  });

  it('opens nothing of persistence to the moderation roles alone', () => {
    for (const role of ['moderator', 'admin', 'supervisor']) {
      expect(permissionsOf([role]).filter((p) => p.startsWith('persistence.'))).toEqual([]);
    }
    // With a persistence role, that role decides persistence.
    const persistence = (roles: string[]) =>
      permissionsOf(roles).filter((p) => p.startsWith('persistence.'));
    expect(persistence(['moderator', 'persistence:read'])).toEqual(
      persistence(['persistence:read']),
    );
  });

  it("mirrors social's moderation roles (ADR 0024)", () => {
    expect(permissionsOf(['moderator'])).toEqual([
      Permission.socialModerate,
      Permission.economieDashboard,
      Permission.simulationView,
      Permission.npcView,
    ]);
    expect(permissionsOf(['admin'])).toEqual([
      Permission.socialModerate,
      Permission.socialSanctionSevere,
      Permission.socialReputation,
      Permission.socialReportsAdmin,
      Permission.economieDashboard,
      Permission.simulationView,
      Permission.simulationManage,
      Permission.npcView,
      Permission.npcManage,
    ]);
    expect(permissionsOf(['supervisor'])).toEqual([
      Permission.socialModerate,
      Permission.socialSanctionSevere,
      Permission.socialReputation,
      Permission.socialReportsAdmin,
      Permission.socialReportsSupervisor,
      Permission.economieDashboard,
      Permission.simulationView,
      Permission.simulationManage,
      Permission.npcView,
      Permission.npcManage,
    ]);
  });

  it("mirrors universesimulator's Admin API: reads moderator+, writes admin+ (ADR 0026)", () => {
    const simulation = (roles: string[]) =>
      permissionsOf(roles).filter((p) => p.startsWith('simulation.'));
    expect(simulation(['moderator'])).toEqual([Permission.simulationView]);
    expect(simulation(['admin'])).toEqual([Permission.simulationView, Permission.simulationManage]);
    expect(simulation(['supervisor'])).toEqual(simulation(['admin']));
    expect(simulation(['player', 'persistence:write', 'economie:money:issue'])).toEqual([]);
  });

  it("mirrors the npc service's Admin API: reads moderator+, writes admin+ (ADR 0026)", () => {
    const npc = (roles: string[]) => permissionsOf(roles).filter((p) => p.startsWith('npc.'));
    expect(npc(['moderator'])).toEqual([Permission.npcView]);
    expect(npc(['admin'])).toEqual([Permission.npcView, Permission.npcManage]);
    expect(npc(['supervisor'])).toEqual(npc(['admin']));
    expect(npc(['player', 'npc', 'persistence:write'])).toEqual([]);
  });

  it('handles a report at its escalation level, or above', () => {
    const handles = (role: string) =>
      (['moderator', 'admin', 'supervisor'] as const).filter((level) =>
        permissionsOf([role]).includes(REPORT_LEVEL_PERMISSION[level]),
      );
    expect(handles('moderator')).toEqual(['moderator']);
    expect(handles('admin')).toEqual(['moderator', 'admin']);
    expect(handles('supervisor')).toEqual(['moderator', 'admin', 'supervisor']);
  });

  it("opens organisation management with social's capability roles only (ADR 0023)", () => {
    expect(permissionsOf(['social:corporation:write'])).toEqual([
      Permission.socialCorporationWrite,
    ]);
    expect(permissionsOf(['social:politics:write'])).toEqual([Permission.socialPoliticsWrite]);
    for (const role of ['moderator', 'admin', 'supervisor']) {
      expect(permissionsOf([role])).not.toContain(Permission.socialCorporationWrite);
    }
  });

  it("opens economie's wallets with its capability roles only (ADR 0023 › Economie)", () => {
    expect(permissionsOf(['economie:wallet:read'])).toEqual([Permission.economieWalletRead]);
    expect(permissionsOf(['economie:politics:read'])).toEqual([Permission.economiePoliticsRead]);
    expect(permissionsOf(['admin'])).not.toContain(Permission.economieWalletRead);
  });

  it("opens economie's settings with its capability roles, managing implying reading", () => {
    expect(permissionsOf(['economie:corporation:read'])).toEqual([
      Permission.economieCorporationRead,
    ]);
    expect(permissionsOf(['economie:corporation:manage'])).toEqual([
      Permission.economieCorporationRead,
      Permission.economieCorporationManage,
    ]);
    expect(permissionsOf(['economie:politics:manage'])).toEqual([
      Permission.economiePoliticsRead,
      Permission.economiePoliticsManage,
    ]);
    expect(permissionsOf(['supervisor'])).not.toContain(Permission.economiePoliticsManage);
  });

  it("opens money movements with economie's capability roles only (step O.3)", () => {
    expect(permissionsOf(['economie:wallet:credit'])).toEqual([Permission.economieWalletCredit]);
    expect(permissionsOf(['economie:wallet:debit'])).toEqual([Permission.economieWalletDebit]);
    expect(permissionsOf(['economie:money:issue'])).toEqual([Permission.economieMoneyIssue]);
    expect(permissionsOf(['supervisor', 'economie:wallet:read'])).not.toContain(
      Permission.economieWalletCredit,
    );
  });

  it("opens missions with mission's capability roles only, writing implying reading", () => {
    expect(permissionsOf(['mission:read'])).toEqual([Permission.missionRead]);
    expect(permissionsOf(['mission:write'])).toEqual([
      Permission.missionRead,
      Permission.missionWrite,
    ]);
    expect(permissionsOf(['supervisor', 'mission:read'])).not.toContain(Permission.missionWrite);
  });

  it("names the POIs with inventory's capability role only (ADR 0026)", () => {
    expect(permissionsOf(['inventory:read'])).toEqual([Permission.inventoryRead]);
    expect(permissionsOf(['supervisor', 'mission:read'])).not.toContain(Permission.inventoryRead);
  });
});
