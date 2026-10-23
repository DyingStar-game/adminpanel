/**
 * Fills the back team's minikube `social` (and `economie`, `mission`) with test data (`make seed-social`, after
 * `make up K8S=1`). Their databases are recreated with the stack, so it is safe to run again:
 * what already exists (profile, friendship, organisation, report, sanction) is kept and reported
 * as skipped.
 *
 * The players are Keycloak users of `docker/keycloak/k8s-partial-import.json` (`player-*`, fixed
 * ids, password = user name): import it first. Each one signs in through the realm's public
 * `dyingstar-dev` client (password grant), which registers them in `social` (`GET /api/me`).
 */
import {
  type CreateCorporation,
  type CreatePoliticalEntity,
  type CreateReport,
  type IssueSanctionData,
  type ProfilePatch,
  zCreateCorporation,
  zCreatePoliticalEntity,
  zCreateReport,
  zIssueSanctionBody,
  zProfilePatch,
} from '../src/social';
import { zCreatePoi } from '../src/inventory';
import { type CreateMissionAsAccepted, zCreateMissionAsAccepted } from '../src/mission';

const SOCIAL_URL = process.env.SOCIAL_URL;
const REALM_URL = process.env.OIDC_DISCOVERY_URL;
if (!SOCIAL_URL || !REALM_URL) {
  throw new Error(
    'SOCIAL_URL and OIDC_DISCOVERY_URL are unset: recreate the container with `make up K8S=1`.',
  );
}

type ReportBody = Omit<CreateReport, 'targetId' | 'targetType'>;

const PLAYERS: Record<string, ProfilePatch> = {
  'player-kira': {
    displayName: 'Kira Vance',
    biography: 'Freight pilot, ten years of runs between the moons.',
    rpSheet: {
      characterName: 'Kira Vance',
      alignment: 'lawful',
      story: 'Grew up in a hauling family.',
    },
  },
  'player-orin': {
    displayName: 'Orin Takeda',
    biography: 'Miner, quiet, always the first one on site.',
    rpSheet: { characterName: 'Orin Takeda', alignment: 'neutral' },
  },
  'player-mara': { displayName: 'Mara Ostrowski', biography: 'Medic, runs a small clinic.' },
  'player-silas': {
    displayName: 'Silas Ferro',
    biography: 'Mechanic who rebuilds wrecked trucks.',
  },
  'player-juno': { displayName: 'Juno Okafor', biography: 'Trader, buys low and sells far.' },
  'player-tess': { displayName: 'Tess Lindqvist' },
  // Troublemakers: the targets of the reports and sanctions below.
  'player-dax': { displayName: 'Dax Moreau', biography: 'Not here to make friends.' },
  'player-pell': {
    displayName: 'Pell Huxley',
    rpSheet: { characterName: 'Pell', alignment: 'chaotic' },
  },
};

/** Pairs made friends: the first asks, the second asks back (`social` accepts the reverse request). */
const FRIENDS: [string, string][] = [
  ['player-kira', 'player-orin'],
  ['player-kira', 'player-mara'],
  ['player-orin', 'player-juno'],
  ['player-mara', 'player-tess'],
  ['player-silas', 'player-juno'],
];
/** Requests left pending. */
const PENDING: [string, string][] = [['player-tess', 'player-kira']];

/** Reporter, target, report: open reports for the moderation screens. */
const REPORTS: [string, string, ReportBody][] = [
  [
    'player-kira',
    'player-dax',
    { reason: 'harassment', message: 'Insults me on the radio every time we meet.' },
  ],
  [
    'player-mara',
    'player-dax',
    { reason: 'offensive_name', message: 'His truck is named after a slur.' },
  ],
  ['player-tess', 'player-dax', { reason: 'harassment' }],
  [
    'player-orin',
    'player-pell',
    { reason: 'griefing', message: 'Blocked the mine entrance with his truck for an hour.' },
  ],
  [
    'player-silas',
    'player-pell',
    { reason: 'cheating', message: 'Drives through the cliff near the base.' },
  ],
  [
    'player-juno',
    'player-pell',
    { reason: 'scam', message: 'Took the payment and never delivered.' },
  ],
  ['player-dax', 'player-kira', { reason: 'other', message: 'She reported me first.' }],
];

/** Staff user, target, sanction (`dev-moderator` for warnings and mutes, `dev-admin` above). */
const SANCTIONS: [string, string, IssueSanctionData['body']][] = [
  ['dev-moderator', 'player-dax', { type: 'warning', reason: 'Insults on the radio' }],
  [
    'dev-moderator',
    'player-dax',
    { type: 'mute', reason: 'Insults again after a warning', durationHours: 24 },
  ],
  [
    'dev-admin',
    'player-pell',
    { type: 'suspension', reason: 'Scam on a delivery', durationHours: 72 },
  ],
];

const tokens = new Map<string, string>();
async function token(username: string): Promise<string> {
  const known = tokens.get(username);
  if (known) return known;
  const res = await fetch(`${REALM_URL}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: 'dyingstar-dev',
      grant_type: 'password',
      username,
      password: username,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Keycloak refused ${username} (${res.status} ${await res.text()}): import docker/keycloak/k8s-partial-import.json first.`,
    );
  }
  const { access_token } = (await res.json()) as { access_token: string };
  tokens.set(username, access_token);
  return access_token;
}

async function social(username: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${SOCIAL_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token(username)}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // A proxy's error page (Traefik's 502 while social starts) is text, not JSON.
  let data: unknown = text || null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // Kept as text, shown by `expect`.
  }
  return { status: res.status, data };
}

/** Waits for social to answer: after a restart it applies its migrations before listening. */
async function waitForSocial(timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const status = await fetch(`${SOCIAL_URL}/api/health`).then(
      (res) => res.status,
      () => 0,
    );
    if (status === 200) return;
    if (Date.now() > until) throw new Error(`social is not answering (last status ${status})`);
    console.log(`  … social not ready yet (${status || 'unreachable'}), waiting`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

function expect(what: string, status: number, data: unknown, ok: number[], skip: number[] = []) {
  if (ok.includes(status)) console.log(`  ✓ ${what}`);
  else if (skip.includes(status)) console.log(`  · ${what}: already there (${status})`);
  else throw new Error(`${what}: social answered ${status} ${JSON.stringify(data)}`);
}

const ids = new Map<string, string>();

/** The moderation accounts of `k8s-partial-import.json` (password = user name). */
const STAFF = ['dev-moderator', 'dev-admin', 'ynotna'];

await waitForSocial();

console.log('Staff');
// `social` creates a profile on an account's first `GET /api/me` only. Without it, the panel
// cannot name the staff, and `social` refuses their reputation changes (accepting or dismissing
// a report, adjusting reputation): `reputation_events.actor_id` must be a profile.
for (const username of STAFF) {
  const me = await social(username, 'GET', '/api/me');
  expect(`${username} registered`, me.status, me.data, [200]);
}

console.log('Players');
for (const [username, profile] of Object.entries(PLAYERS)) {
  const me = await social(username, 'GET', '/api/me');
  // 403: suspended by a previous run, already registered.
  if (me.status === 403) {
    // The Keycloak subject is the `social` player id.
    const [, payload = ''] = (await token(username)).split('.');
    const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string };
    ids.set(username, sub);
    console.log(`  · ${username}: suspended, profile kept`);
    continue;
  }
  expect(`${username} registered`, me.status, me.data, [200]);
  ids.set(username, (me.data as { playerId: string }).playerId);
  const patched = await social(username, 'PATCH', '/api/me', zProfilePatch.parse(profile));
  expect(`${username} profile`, patched.status, patched.data, [200]);
}
function id(username: string): string {
  const playerId = ids.get(username);
  if (!playerId) throw new Error(`${username} is not in PLAYERS`);
  return playerId;
}

console.log('Friends');
for (const [a, b] of FRIENDS) {
  const ask = await social(a, 'POST', '/api/friends/requests', { playerId: id(b) });
  expect(`${a} → ${b}`, ask.status, ask.data, [200, 201], [409]);
  const back = await social(b, 'POST', '/api/friends/requests', { playerId: id(a) });
  expect(`${b} → ${a} (accepted)`, back.status, back.data, [200, 201], [409]);
}
for (const [a, b] of PENDING) {
  const ask = await social(a, 'POST', '/api/friends/requests', { playerId: id(b) });
  expect(`${a} → ${b} (pending)`, ask.status, ask.data, [200, 201], [409]);
}

/**
 * Political entities: head, entity, members the head appoints (default office), higher level.
 * Created before the corporations, which take one as their political home.
 */
const POLITICS: [string, CreatePoliticalEntity, string[], string?][] = [
  [
    'player-tess',
    { type: 'country', name: 'Free Colonies', description: 'Test country of the seed.' },
    ['player-kira'],
  ],
  [
    'player-mara',
    { type: 'commune', name: 'New Haven', description: 'Test commune of the seed.' },
    ['player-orin', 'player-juno', 'player-pell'],
    'Free Colonies',
  ],
];

/** Corporations: CEO, corporation, members joining it (open ones), holding, political home. */
const CORPORATIONS: [
  string,
  CreateCorporation,
  string[],
  { parent?: string; politics?: string },
][] = [
  [
    'player-kira',
    { name: 'Vance Freight', ticker: 'VFR', recruitment: 'open', description: 'Hauling.' },
    ['player-orin', 'player-mara'],
    { politics: 'New Haven' },
  ],
  [
    'player-juno',
    { name: 'Okafor Trading', ticker: 'OKT', recruitment: 'open' },
    ['player-silas'],
    { parent: 'Vance Freight', politics: 'New Haven' },
  ],
  ['player-dax', { name: 'Moreau Raiders', ticker: 'MRD', recruitment: 'closed' }, [], {}],
];

/** Id of the organisation of that exact name, from `social`'s directory (any player may read). */
async function find(kind: 'corporations' | 'politics', name: string): Promise<string | null> {
  const res = await social('player-kira', 'GET', `/api/${kind}?search=${encodeURIComponent(name)}`);
  expect(`${kind} search`, res.status, res.data, [200]);
  const found = (res.data as { items: { id: string; name: string }[] }).items;
  return found.find((o) => o.name === name)?.id ?? null;
}

/** The organisation's id, created by `owner` when it does not exist yet. */
async function ensure(
  kind: 'corporations' | 'politics',
  owner: string,
  body: CreateCorporation | CreatePoliticalEntity,
): Promise<string> {
  const existing = await find(kind, body.name);
  if (existing) {
    console.log(`  · ${body.name}: already there`);
    return existing;
  }
  const res = await social(owner, 'POST', `/api/${kind}`, body);
  expect(`${body.name} by ${owner}`, res.status, res.data, [201]);
  return (res.data as { id: string }).id;
}

console.log('Political entities');
const politics = new Map<string, string>();
for (const [head, entity, members, parent] of POLITICS) {
  const entityId = await ensure('politics', head, zCreatePoliticalEntity.parse(entity));
  politics.set(entity.name, entityId);
  for (const member of members) {
    const res = await social(head, 'POST', `/api/politics/${entityId}/members`, {
      playerId: id(member),
    });
    expect(`  ${member} in ${entity.name}`, res.status, res.data, [201], [409]);
  }
  const parentId = parent && politics.get(parent);
  if (parentId) {
    const res = await social(head, 'PUT', `/api/politics/${entityId}/parent`, { parentId });
    expect(`  ${entity.name} under ${parent}`, res.status, res.data, [200]);
  }
}

console.log('Corporations');
const corporations = new Map<string, string>();
for (const [ceo, corporation, members, links] of CORPORATIONS) {
  const corporationId = await ensure('corporations', ceo, zCreateCorporation.parse(corporation));
  corporations.set(corporation.name, corporationId);
  for (const member of members) {
    const res = await social(member, 'POST', `/api/corporations/${corporationId}/join`);
    expect(`  ${member} joins ${corporation.name}`, res.status, res.data, [200], [409]);
  }
  const parentId = links.parent && corporations.get(links.parent);
  if (parentId) {
    const res = await social(ceo, 'PUT', `/api/corporations/${corporationId}/parent`, {
      parentId,
    });
    expect(`  ${corporation.name} under ${links.parent}`, res.status, res.data, [200]);
  }
  const politicalEntityId = links.politics && politics.get(links.politics);
  if (politicalEntityId) {
    const res = await social(ceo, 'PUT', `/api/corporations/${corporationId}/politics`, {
      politicalEntityId,
    });
    expect(`  ${corporation.name} in ${links.politics}`, res.status, res.data, [200]);
  }
}

console.log('Reports');
for (const [reporter, target, report] of REPORTS) {
  const body = zCreateReport.parse({ ...report, targetType: 'player', targetId: id(target) });
  const res = await social(reporter, 'POST', '/api/reports', body);
  expect(`${reporter} reports ${target} (${report.reason})`, res.status, res.data, [201], [409]);
}

console.log('Sanctions');
for (const [staff, target, sanction] of SANCTIONS) {
  const record = await social(staff, 'GET', `/api/admin/players/${id(target)}`);
  expect(`${target} record`, record.status, record.data, [200]);
  const existing = (record.data as { sanctions: { type: string; reason: string }[] }).sanctions;
  if (existing.some((s) => s.type === sanction.type && s.reason === sanction.reason)) {
    console.log(`  · ${target} ${sanction.type}: already there`);
    continue;
  }
  const res = await social(
    staff,
    'POST',
    `/api/admin/players/${id(target)}/sanctions`,
    zIssueSanctionBody.parse(sanction),
  );
  expect(`${target} ${sanction.type} by ${staff}`, res.status, res.data, [201]);
}

// ── economie (ADR 0024 step O): wallets as svc-admin, its internal API being for services only.
const ECONOMIE_URL = process.env.ECONOMIE_URL;
const SVC_ADMIN_SECRET = process.env.SVC_ADMIN_CLIENT_SECRET;
const SVC_ADMIN_ID = process.env.SVC_ADMIN_CLIENT_ID ?? 'svc-admin';

/** Starting balances (deposits) and a salary each, idempotent through their `externalId`. */
const STARTING_CREDITS: Record<string, number> = {
  'player-kira': 4_000,
  'player-orin': 2_500,
  'player-mara': 3_200,
  'player-silas': 1_800,
  'player-juno': 6_000,
  'player-tess': 900,
  'player-dax': 150,
  'player-pell': 40,
};
const TREASURIES: Record<string, number> = { 'Vance Freight': 25_000, 'Okafor Trading': 12_000 };

async function serviceToken(): Promise<string> {
  const res = await fetch(`${REALM_URL}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SVC_ADMIN_ID,
      client_secret: SVC_ADMIN_SECRET ?? '',
    }),
  });
  if (!res.ok)
    throw new Error(`Keycloak refused ${SVC_ADMIN_ID} (${res.status} ${await res.text()})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

if (ECONOMIE_URL && SVC_ADMIN_SECRET) {
  console.log('Economie');
  const bearer = await serviceToken();
  const economie = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${ECONOMIE_URL}/api/internal${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = text || null;
    try {
      data = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      // Kept as text, shown by `expect`.
    }
    return { status: res.status, data };
  };
  /** Opens the holder's account, then credits it once (replays answer 409). */
  const fund = async (holder: string, id: string, amount: number, type: string, key: string) => {
    const opened = await economie('PUT', `/${holder}/${id}/wallet`);
    expect(`${key} account`, opened.status, opened.data, [200, 201]);
    const credited = await economie('POST', `/${holder}/${id}/wallet/credit`, {
      amount,
      type,
      externalId: `seed-${key}`,
      reference: 'make seed-social',
    });
    expect(`${key} +${amount} (${type})`, credited.status, credited.data, [200, 201], [409]);
  };

  for (const [username, amount] of Object.entries(STARTING_CREDITS)) {
    await fund('players', id(username), amount, 'deposit', `${username}-start`);
  }
  await fund('players', id('player-orin'), 450, 'salary', 'player-orin-salary');
  await fund('players', id('player-mara'), 300, 'mission_reward', 'player-mara-mission');
  for (const [name, amount] of Object.entries(TREASURIES)) {
    const corporationId = corporations.get(name);
    if (corporationId)
      await fund('corporations', corporationId, amount, 'deposit', `${name}-start`);
  }
  // A commune that taxes, a country that may issue money (economie's own settings).
  const commune = politics.get('New Haven');
  const country = politics.get('Free Colonies');
  if (commune) {
    await fund('politics', commune, 1_500, 'deposit', 'New Haven-start');
    const set = await economie('PUT', `/politics/${commune}/settings`, {
      corporateTaxBps: 500,
      incomeTaxBps: 200,
    });
    expect('New Haven taxes', set.status, set.data, [200]);
  }
  if (country) {
    await fund('politics', country, 50_000, 'deposit', 'Free Colonies-start');
    const set = await economie('PUT', `/politics/${country}/settings`, {
      allowMinting: true,
      mintCeiling: 100_000,
    });
    expect('Free Colonies minting', set.status, set.data, [200]);
  }
  // economie keeps its own fiscal homes and political members, which the game server sets
  // (step O.2): mirrored from social, so that an assessment finds taxpayers (upserts).
  for (const [, corporation, , links] of CORPORATIONS) {
    const corporationId = corporations.get(corporation.name);
    const home = links.politics ? politics.get(links.politics) : undefined;
    if (!corporationId || !home) continue;
    const set = await economie('PUT', `/corporations/${corporationId}/affiliation`, {
      politicalEntityId: home,
    });
    expect(`${corporation.name} fiscal home ${links.politics}`, set.status, set.data, [200]);
  }
  for (const [head, entity, members] of POLITICS) {
    const entityId = politics.get(entity.name);
    if (!entityId) continue;
    for (const [member, role] of [[head, 'head'], ...members.map((m) => [m, 'member'])]) {
      const set = await economie('PUT', `/politics/${entityId}/members/${id(member ?? '')}`, {
        role,
      });
      expect(`${entity.name} ${role} ${member} (economie)`, set.status, set.data, [200]);
    }
  }
} else {
  console.log('Economie: skipped (ECONOMIE_URL or SVC_ADMIN_CLIENT_SECRET unset: make up K8S=1)');
}

// ── mission (ADR 0024 step O): missions created as svc-admin, as the game server does through
// its internal API. Each has its own `scriptId`, unique in `mission`: a rerun answers 409.
const MISSION_URL = process.env.MISSION_URL;

/**
 * What happens to a mission once created, in order, as the game server would do it: a player
 * takes it, the issuer confirms its `manual` objective at `confirm` (index in creation order), it
 * is handed in without paying (`settle: false`, so no money moves; `partial` for its weighted
 * progress), cancelled, or declared an event with its places (`mission` ignores `isEvent` at
 * creation, question 20 of the lot 2 plan). The other kinds progress from the players' states
 * the game server sends, measured against `inventory`'s POIs: none here.
 */
type Step =
  | { event: number }
  | { assign: string }
  | { confirm: number }
  | { complete: string; partial?: boolean }
  | 'cancel';

/**
 * POIs the objectives point at (`kinds/objectives/`: a `{ kind: 'poi', poiId }` zone), created in
 * `inventory` as the game's (`system` owner) through its internal API (`inventory:poi:manage`,
 * held by `svc-admin`) and found again by name on a rerun. On SandBox (Tarsis III), metres from
 * its centre about 4 km above its wiki radius; the relay station in open space. A mission's own
 * zones are checked against `inventory`: none uses a POI.
 */
const SEED_POIS = {
  foundryBay: {
    name: 'Foundry loading bay',
    scene: 'tarsis_3/new-haven',
    at: [-3_828_872.1, 2_444_118.3, 4_451_474.4],
    radiusM: 40,
  },
  clinic: {
    name: 'Ostrowski clinic',
    scene: 'tarsis_3/new-haven',
    at: [-3_830_410.2, 2_443_201.7, 4_450_655.9],
  },
  depot: { name: 'Vance depot', scene: 'tarsis_3', at: [-3_874_453.7, 2_474_828.3, 4_394_705.1] },
  drillSite: {
    name: 'Drill site 7',
    scene: 'tarsis_3',
    at: [-3_787_869.0, 2_361_899.4, 4_530_240.5],
    radiusM: 120,
  },
  craterRim: {
    name: 'Crater rim',
    scene: 'tarsis_3',
    at: [4_372_129.0, 1_656_808.7, -4_311_504.8],
  },
  craterFloor: {
    name: 'Crater floor',
    scene: 'tarsis_3',
    at: [4_370_805.6, 1_655_301.2, -4_310_498.3],
  },
  relayStation: { name: 'Relay station', scene: 'space', at: [12_000_000, 0, 3_000_000] },
  mainSquare: {
    name: 'New Haven main square',
    scene: 'tarsis_3/new-haven',
    at: [-3_829_640.8, 2_443_660.0, 4_451_070.1],
    radiusM: 60,
  },
} satisfies Record<
  string,
  { name: string; scene: string; at: [number, number, number]; radiusM?: number }
>;
type SeedPoi = keyof typeof SEED_POIS;
/** The game's owner of the seed's POIs in `inventory` (any UUID: `system` holders are opaque). */
const POI_OWNER = '5eed0000-0000-4000-8000-000000000001';

/** A mission's body; `requires` names the seed missions to complete first (their `scriptId`). */
type SeedMission = Omit<CreateMissionAsAccepted, 'scriptId' | 'requiresMissionIds'> & {
  requires?: string[];
};

/**
 * Missions of each status and shape the panel lists: script id, body, then its steps. Each
 * objective's `params` follows its kind (`deliver_material` and `transport` a `goodType` and POIs,
 * `visit` a POI, `manual` none).
 */
const missions = (
  poi: (key: SeedPoi) => { kind: 'poi'; poiId: string },
): [string, SeedMission, Step[]][] => [
  [
    'seed.ore-delivery',
    {
      title: 'Iron ore for New Haven',
      description: 'The foundry runs short: bring ore to its loading bay.',
      category: 'delivery',
      rewards: [{ type: 'credits', currency: 'credits', amount: 1_500 }],
      zones: [{ kind: 'system', system: 'tarsis' }],
      maxAssignees: 3,
      allowPartial: true,
      objectives: [
        {
          type: 'deliver_material',
          title: 'Deliver 10 t of iron ore',
          targetQuantity: 10,
          unit: 't',
          params: { goodType: 'iron_ore', zone: poi('foundryBay') },
        },
        {
          type: 'manual',
          title: 'Before the night shift',
          isBonus: true,
          bonusReward: { type: 'standing', domain: 'delivery', amount: 5 },
        },
      ],
    },
    [],
  ],
  [
    'seed.water-run',
    {
      title: 'Water for the clinic',
      description: 'Mara needs clean water before the next shift.',
      category: 'delivery',
      rewards: [{ type: 'credits', currency: 'credits', amount: 800 }],
      maxAssignees: 2,
      objectives: [
        {
          type: 'deliver_material',
          title: 'Deliver 20 barrels of water',
          targetQuantity: 20,
          unit: 'barrels',
          params: { goodType: 'water_barrel', zone: poi('clinic') },
        },
      ],
    },
    [{ assign: 'player-orin' }, { assign: 'player-juno' }],
  ],
  [
    'seed.parts-run',
    {
      title: 'Escort the drill parts',
      category: 'transport',
      issuerType: 'corporation',
      rewards: [
        { type: 'credits', currency: 'credits', amount: 4_000 },
        { type: 'item', itemId: 'drill_bit', quantity: 2 },
      ],
      prerequisites: [{ kind: 'min_reputation', params: { min: 10 } }],
      assignmentDeadlineHours: 48,
      objectives: [
        {
          type: 'transport',
          title: 'Bring the parts to the drill site',
          params: { goodType: 'drill_parts', source: poi('depot'), zone: poi('drillSite') },
        },
      ],
    },
    [],
  ],
  [
    'seed.first-survey',
    {
      title: 'The first survey',
      kind: 'scenario',
      category: 'exploration',
      rewards: [{ type: 'credits', currency: 'credits', amount: 250 }],
      objectives: [
        { type: 'manual', title: 'Meet the surveyor', order: 0 },
        {
          type: 'visit',
          title: 'Reach the crater rim',
          order: 1,
          weight: 2,
          params: { zone: poi('craterRim') },
        },
      ],
    },
    [{ assign: 'player-kira' }, { confirm: 0 }],
  ],
  [
    'seed.crater-depths',
    {
      title: "The crater's depths",
      kind: 'scenario',
      category: 'exploration',
      requires: ['seed.first-survey'],
      rewards: [
        { type: 'credits', currency: 'credits', amount: 400 },
        { type: 'standing', domain: 'exploration', amount: 10 },
      ],
      objectives: [
        { type: 'visit', title: 'Reach the crater floor', params: { zone: poi('craterFloor') } },
      ],
    },
    [],
  ],
  [
    'seed.wreck-salvage',
    {
      title: 'Strip the old hauler',
      category: 'mining',
      rewards: [{ type: 'credits', currency: 'credits', amount: 600 }],
      allowPartial: true,
      objectives: [
        { type: 'manual', title: 'Bring back its engine block', weight: 3 },
        { type: 'manual', title: 'Bring back its fuel cells' },
      ],
    },
    [{ assign: 'player-silas' }, { confirm: 0 }, { complete: 'player-silas', partial: true }],
  ],
  [
    'seed.beacon-check',
    {
      title: 'Check the beacon',
      category: 'divers',
      autoComplete: false,
      rewards: [{ type: 'standing', domain: 'divers', amount: 3 }],
      objectives: [{ type: 'manual', title: 'Report the beacon working' }],
    },
    [{ assign: 'player-mara' }, { confirm: 0 }, { complete: 'player-mara' }],
  ],
  [
    'seed.relay-station',
    {
      title: 'Clear the relay station',
      category: 'exploration',
      groupClaimable: true,
      maxAssignees: 4,
      objectives: [
        {
          type: 'visit',
          title: 'Enter the relay station',
          params: { zone: poi('relayStation') },
        },
      ],
    },
    [],
  ],
  [
    'seed.founders-day',
    {
      title: "Founders' Day parade",
      description: 'Everyone is welcome on the main square.',
      category: 'exploration',
      rewards: [{ type: 'credits', currency: 'credits', amount: 50 }],
      objectives: [
        { type: 'visit', title: 'Join the parade', params: { zone: poi('mainSquare') } },
      ],
    },
    [{ event: 500 }],
  ],
  [
    'seed.spare-battery',
    {
      title: 'Buy my spare battery',
      category: 'delivery',
      rewards: [{ type: 'credits', currency: 'credits', amount: 300 }],
      objectives: [{ type: 'manual', title: 'Hand over a battery' }],
    },
    ['cancel'],
  ],
];

const INVENTORY_URL = process.env.INVENTORY_URL;

/**
 * The seed's POIs in `inventory`, created once (found again by name among the `system` owner's):
 * their ids by key. Without `INVENTORY_URL`, placeholders `inventory` does not hold.
 */
async function seedPois(bearer: string): Promise<Record<SeedPoi, string>> {
  const keys = Object.keys(SEED_POIS) as SeedPoi[];
  if (!INVENTORY_URL) {
    console.log('  · POIs: placeholders (INVENTORY_URL unset: make up K8S=1)');
    return Object.fromEntries(
      keys.map((key, i) => [
        key,
        `a1f0c3d2-${String(i + 1).padStart(4, '0')}-4c5e-9a7b-5e3d0c0f0000`,
      ]),
    ) as Record<SeedPoi, string>;
  }
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${INVENTORY_URL}/api/internal${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, data: text ? (JSON.parse(text) as unknown) : null };
  };
  const owned = await call('GET', `/holders/system/${POI_OWNER}/pois?limit=100`);
  expect('inventory POIs', owned.status, owned.data, [200]);
  const byName = new Map(
    (owned.data as { items: { id: string; name: string }[] }).items.map((p) => [p.name, p.id]),
  );
  const ids: Partial<Record<SeedPoi, string>> = {};
  for (const key of keys) {
    const { name, scene, at, ...rest } = SEED_POIS[key];
    const known = byName.get(name);
    if (known) {
      console.log(`  · POI ${name}: already there`);
      ids[key] = known;
      continue;
    }
    const body = zCreatePoi.parse({
      owner: { type: 'system', id: POI_OWNER },
      name,
      system: 'tarsis',
      scene,
      x: at[0],
      y: at[1],
      z: at[2],
      visibility: 'public',
      ...rest,
    });
    const created = await call('POST', '/pois', body);
    expect(`POI ${name}`, created.status, created.data, [201]);
    ids[key] = (created.data as { id: string }).id;
  }
  return ids as Record<SeedPoi, string>;
}

if (MISSION_URL && SVC_ADMIN_SECRET) {
  console.log('Mission');
  const bearer = await serviceToken();
  const mission = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${MISSION_URL}/api/internal${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, data: text ? (JSON.parse(text) as unknown) : null };
  };
  // The seed's missions already there (a rerun), by `scriptId`: the chains point at them.
  const seeded = new Map<string, string>();
  for (let offset = 0; ; offset += 100) {
    const page = await mission('GET', `/missions?limit=100&offset=${offset}`);
    expect('mission catalogue', page.status, page.data, [200]);
    const { missions, total } = page.data as {
      missions: { id: string; scriptId: string | null }[];
      total: number;
    };
    for (const row of missions) if (row.scriptId) seeded.set(row.scriptId, row.id);
    if (offset + 100 >= total) break;
  }
  const poiIds = await seedPois(bearer);
  const place = (key: SeedPoi) => ({ kind: 'poi' as const, poiId: poiIds[key] });
  for (const [scriptId, { requires = [], ...spec }, steps] of missions(place)) {
    // The corporation's mission is issued by Vance Freight (`social`'s id).
    const issuerId =
      spec.issuerType === 'corporation' ? corporations.get('Vance Freight') : undefined;
    const requiresMissionIds = requires.flatMap((required) => seeded.get(required) ?? []);
    const body = zCreateMissionAsAccepted.parse({
      ...spec,
      scriptId,
      ...(issuerId ? { issuerId } : {}),
      ...(requiresMissionIds.length > 0 ? { requiresMissionIds } : {}),
    });
    const created = await mission('POST', '/missions', body);
    expect(`mission ${spec.title}`, created.status, created.data, [201], [409]);
    // Steps only after a creation: a rerun leaves an existing mission as it is.
    if (created.status !== 201) continue;
    const { mission: row, objectives } = created.data as {
      mission: { id: string };
      objectives: { id: string }[];
    };
    seeded.set(scriptId, row.id);
    const path = `/missions/${row.id}`;
    for (const step of steps) {
      const [what, done] =
        step === 'cancel'
          ? ['cancelled', await mission('POST', `${path}/cancel`)]
          : 'event' in step
            ? [
                `an event of ${step.event} places`,
                await mission('POST', `${path}/event`, { enabled: true, maxAssignees: step.event }),
              ]
            : 'assign' in step
              ? [
                  `taken by ${step.assign}`,
                  await mission('POST', `${path}/assign`, { playerId: id(step.assign) }),
                ]
              : 'confirm' in step
                ? [
                    `objective ${step.confirm} confirmed`,
                    await mission(
                      'POST',
                      `${path}/objectives/${objectives[step.confirm]?.id}/confirm`,
                    ),
                  ]
                : [
                    `${step.partial ? 'partly handed in' : 'completed'} by ${step.complete}, unpaid`,
                    await mission('POST', `${path}/complete`, {
                      playerId: id(step.complete),
                      settle: false,
                      partial: step.partial ?? false,
                    }),
                  ];
      expect(`  ${spec.title}: ${what}`, done.status, done.data, [200, 201]);
    }
  }
} else {
  console.log('Mission: skipped (MISSION_URL or SVC_ADMIN_CLIENT_SECRET unset: make up K8S=1)');
}

console.log(`Done: ${ids.size} players in ${SOCIAL_URL}`);
