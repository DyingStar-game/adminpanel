import { ApiError } from '@/lib/api';

/** Message for a failed `social` call: its own role check (403), or it is unreachable. */
export const moderationErrorKey = (error: unknown) =>
  error instanceof ApiError && error.status === 403
    ? 'moderation.forbidden'
    : 'moderation.unavailable';
