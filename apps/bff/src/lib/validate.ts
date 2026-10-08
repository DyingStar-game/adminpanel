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

/**
 * Query strings carry text: whole numbers become numbers before the contract's schemas
 * (`limit`, `offset`, `id`), which expect integers.
 */
export const fromQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (raw) =>
      Object.fromEntries(
        Object.entries(raw as Record<string, string>).map(([key, value]) => [
          key,
          /^\d+$/.test(value) ? Number(value) : value,
        ]),
      ),
    schema,
  );

/**
 * JSON-safe copy of a payload parsed with a generated contract: its `int64` fields are `BigInt`
 * (`z.coerce.bigint()`), which JSON cannot write. Numbers when safe, else strings (the SPA reads
 * both back with the same schema).
 */
export const jsonSafe = <T>(data: T): unknown =>
  JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      typeof value === 'bigint'
        ? value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
          ? Number(value)
          : value.toString()
        : value,
    ),
  );
