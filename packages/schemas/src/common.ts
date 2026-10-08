import { z } from 'zod';

/**
 * Item UUID as stored by persistence: 8-4-4-4-12 hex groups.
 * Not restricted to RFC 4122 versions/variants — live data contains other variants.
 */
export const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');

/** Error body returned by every BFF route. */
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

/** Stable error codes of the BFF API. */
export const ErrorCode = {
  validation: 'VALIDATION_ERROR',
  serverRequired: 'SERVER_REQUIRED',
  unknownServer: 'UNKNOWN_SERVER',
  notFound: 'NOT_FOUND',
  alreadyExists: 'ALREADY_EXISTS',
  unknownObjectType: 'UNKNOWN_OBJECT_TYPE',
  editConflict: 'EDIT_CONFLICT',
  duplicateTooLarge: 'DUPLICATE_TOO_LARGE',
  duplicatePartial: 'DUPLICATE_PARTIAL',
  mapTooLarge: 'MAP_TOO_LARGE',
  upstreamRejected: 'UPSTREAM_REJECTED',
  upstreamError: 'UPSTREAM_ERROR',
  upstreamTimeout: 'UPSTREAM_TIMEOUT',
  upstreamUnreachable: 'UPSTREAM_UNREACHABLE',
  unauthenticated: 'UNAUTHENTICATED',
  accessDenied: 'ACCESS_DENIED',
  forbidden: 'FORBIDDEN',
  forbiddenOrigin: 'FORBIDDEN_ORIGIN',
  internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
