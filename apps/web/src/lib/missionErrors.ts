import { ApiError } from '@/lib/api';

/** Message for a failed `mission` call: the account's right (403), or it is unreachable. */
export const missionErrorKey = (error: unknown) =>
  error instanceof ApiError && error.status === 403 ? 'missions.forbidden' : 'missions.unavailable';
