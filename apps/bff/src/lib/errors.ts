import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ErrorCode, type ApiErrorBody } from '@dyingstar-admin/schemas';

/** Error carrying the HTTP status and the JSON body sent to the browser. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  toBody(): ApiErrorBody {
    return this.details === undefined
      ? { error: this.code, message: this.message }
      : { error: this.code, message: this.message, details: this.details };
  }
}

export const notFound = (message: string) => new ApiError(404, ErrorCode.notFound, message);
