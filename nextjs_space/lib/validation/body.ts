import type { ZodType, ZodTypeDef } from "zod";
import { ApiError } from "@/lib/api-error";

/**
 * JSON request-body parser with a hard size cap and optional Zod validation
 * (PRD-204 AC-6). Replaces bare `await req.json()` so every body route rejects
 * oversized or malformed payloads uniformly, before any work is done.
 *
 * - Over the byte cap → ApiError 413 ("Request body too large").
 * - Unparseable JSON → ApiError 400.
 * - Schema mismatch (when a schema is supplied) → ApiError 400.
 *
 * Read the body via `.text()` (not `.json()`) so we can measure its byte size
 * before parsing. Callers must not also call `req.json()` — the stream is
 * single-use.
 */

const DEFAULT_MAX_BYTES = 256 * 1024; // 256 KB

export interface ParseJsonBodyOptions {
  /** Maximum allowed body size in bytes. Defaults to 256 KB. */
  maxBytes?: number;
}

/**
 * The schema's INPUT is `unknown`, not `T`. What arrives here is whatever
 * `JSON.parse` produced, so a schema that preprocesses its input before
 * validating (US-011's contentJson runs a depth guard first) is as valid at this
 * boundary as a plain object schema. `ZodSchema<T>` fixes input === output and
 * silently degrades those to `T = unknown` at the call site.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  schema?: ZodType<T, ZodTypeDef, unknown>,
  opts: ParseJsonBodyOptions = {},
): Promise<T> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new ApiError("Request body too large", 413);
  }

  let parsed: unknown;
  try {
    parsed = raw === "" ? undefined : JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid request", 400);
  }

  if (!schema) {
    return parsed as T;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ApiError("Invalid request", 400);
  }
  return result.data;
}
