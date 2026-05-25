/** Base URL for the BFF backend (sole gateway to K8s services). */
const API_URL = import.meta.env.VITE_API_URL || '';

/** HTTP error thrown when an API response is not successful. */
export class ApiError extends Error {
  /**
   * @param message - Human-readable error message
   * @param status - HTTP status code
   * @param code - Optional application error code
   */
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Performs a JSON API request through the BFF, optionally scoped to a game server.
 *
 * @param path - API path or absolute URL
 * @param options - Fetch options plus optional `serverId` sent as `X-Server-Id`
 * @returns Parsed JSON body, or `undefined` for 204 No Content
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { serverId?: string | null } = {},
): Promise<T> {
  const { serverId, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (serverId) headers.set('X-Server-Id', serverId);

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
