/**
 * Shared TypeScript types for DyingStar Admin (frontend + backend API contracts).
 * Only public DTOs belong here; internal cluster URLs stay in backend `ServerConfig`.
 */

/** 3D vector used in persistence object data. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Arbitrary persistence payload with common optional game fields. */
export interface ObjectData {
  name?: string;
  parent_id?: string;
  scenename?: string;
  position?: Vec3;
  rotation?: Vec3;
  [key: string]: unknown;
}

/** Single persisted game object returned by the persistence API. */
export interface ItemResponse {
  object_type: string;
  object_uuid: string;
  object_data: ObjectData;
}

/** Request body for creating a persistence item. */
export interface CreateItemRequest {
  object_type: string;
  object_uuid?: string | null;
  object_data: ObjectData;
}

/** Request body for updating a persistence item. */
export interface PutItemRequest {
  object_type?: string;
  object_data: ObjectData;
}

/** Paginated list of persistence items. */
export interface PaginatedItemsResponse {
  items: ItemResponse[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Server metadata exposed to the frontend.
 * Does not include internal service URLs (persistence, WebSocket, Keycloak).
 */
export interface ServerPublic {
  id: string;
  name: string;
  url: string;
}

export type MissionType = 'exploration' | 'combat' | 'delivery' | 'social';
export type MissionStatus = 'draft' | 'active' | 'completed' | 'archived';

/** Single mission objective step. */
export interface MissionObjective {
  id: string;
  description: string;
  completed: boolean;
}

/** Mission reward entry. */
export interface MissionReward {
  id: string;
  type: string;
  amount: number;
}

/** Mission entity (temporary file-backed storage in backend). */
export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  status: MissionStatus;
  assignedTo?: string;
  objectives: MissionObjective[];
  rewards: MissionReward[];
  createdAt: string;
  updatedAt: string;
}

/** Keycloak user summary for the admin UI. */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  roles: string[];
  firstName?: string;
  lastName?: string;
}

/** In-memory admin activity log entry. */
export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
  serverId?: string;
}

/** Active Horizon instance reported by service-resourcesdynamic. */
export interface HorizonInstanceInfo {
  id: string;
  status: string;
  host?: string;
  port?: number;
}

/** Dashboard / status aggregate metrics. */
export interface StatusResponse {
  /** Active Horizon instances for the server in `X-Server-Id` (mesh). */
  activeHorizonCount: number;
  /** Active Horizon count keyed by configured server display name. */
  activeHorizonByServer: Record<string, number>;
  /** Instance details for the active server (when `X-Server-Id` is set). */
  horizonInstances: HorizonInstanceInfo[];
  /** True when service-resourcesdynamic responded successfully for at least one server. */
  resourcesDynamicReachable: boolean;
  connectedPlayers: number;
  playersByServer: Record<string, number>;
  itemsCount: number;
  /** @deprecated Use activeHorizonCount */
  godotProcesses?: number;
}

/** Result of a backend connectivity ping to one service. */
export interface ServicePing {
  ok: boolean;
  latencyMs: number;
}

/** Connectivity probe results for the active server (BFF-only checks). */
export interface ConnectivityResponse {
  persistence: ServicePing;
  auth: ServicePing;
  realtime: ServicePing;
  /** service-resourcesdynamic (dynamic mesh). */
  mesh: ServicePing;
  /** Optional horizon HTTP endpoint when configured. */
  horizon: ServicePing;
}

/** Ban record stored in backend memory (until Keycloak integration). */
export interface BanRecord {
  id: string;
  userId: string;
  username: string;
  reason: string;
  bannedAt: string;
  bannedBy: string;
  expiresAt?: string;
  permanent: boolean;
}

/** Prop descriptor file metadata from the horizonserver GitHub repo. */
export interface PropDescriptor {
  name: string;
  path: string;
  content?: Record<string, unknown>;
}

/** Standard API error JSON shape. */
export interface ApiError {
  error: string;
  message: string;
  status: number;
}
