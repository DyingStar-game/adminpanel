/**
 * Fills the back team's minikube `social` with test players (`make seed-social`, after
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
  return { status: res.status, data: text ? (JSON.parse(text) as unknown) : null };
}

function expect(what: string, status: number, data: unknown, ok: number[], skip: number[] = []) {
  if (ok.includes(status)) console.log(`  ✓ ${what}`);
  else if (skip.includes(status)) console.log(`  · ${what}: already there (${status})`);
  else throw new Error(`${what}: social answered ${status} ${JSON.stringify(data)}`);
}

const ids = new Map<string, string>();

/** The moderation accounts of `k8s-partial-import.json` (password = user name). */
const STAFF = ['dev-moderator', 'dev-admin', 'ynotna'];

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

console.log(`Done: ${ids.size} players in ${SOCIAL_URL}`);
