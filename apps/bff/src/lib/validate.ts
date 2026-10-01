import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { z } from 'zod';
import { ErrorCode } from '@dyingstar-admin/schemas';
import { ApiError } from './errors';

type Target = 'json' | 'query' | 'param';

/** `@hono/zod-validator` answering with the BFF error body on invalid input. */
export const validate = <T extends z.ZodType, Tg extends Target>(target: Tg, schema: T) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ApiError(
        400,
        ErrorCode.validation,
        `Invalid ${target}`,
        z.treeifyError(result.error),
      );
    }
  });

/** Validates the query against a schema only known at request time (e.g. allowed types). */
export function parseQuery<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new ApiError(400, ErrorCode.validation, 'Invalid query', z.treeifyError(result.error));
  }
  return result.data;
}
