import { NextResponse } from "next/server";
import crypto from "crypto";
import { requestLogger } from "@/lib/logger";

/**
 * Centralized API error response helper.
 *
 * SECURITY (H_e1-5): Closes information disclosure via error responses.
 * Production responses NEVER expose stack traces, raw error messages,
 * Prisma constraint names, file paths, or internal hostnames. Each 5xx
 * response carries a correlation ID that pairs with the server-side log
 * so support can trace incidents without leaking internals to clients.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Typed API error — throw from route handlers for safe, specific error
 * responses. Pass-through messages are presumed already vetted for
 * client display.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly safeForClient: boolean = true,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiErrorOptions {
  /** Logical route name for log correlation. Recommended. */
  route?: string;
  /** HTTP status. Defaults to 500. */
  status?: number;
  /**
   * Pre-vetted message safe to return to the client. If omitted, prod
   * returns a generic message.
   */
  safeMessage?: string;
  /** Extra structured fields to include in the server log only. */
  logContext?: Record<string, unknown>;
}

/**
 * Sanitize a stack trace for dev-only display — strips absolute paths
 * down to the project-relative segment, keeps top frames.
 */
function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, 6)
    .map((line) => line.replace(/\(\/[^)]*?\/(?=app|lib|components|src)/g, "("))
    .join("\n");
}

/**
 * Return a sanitized error response.
 *
 * Behavior:
 * - ApiError instances pass through their .message (presumed safe).
 * - 4xx without safeMessage → generic "Invalid request"
 * - 5xx without safeMessage → generic "An internal error occurred"
 * - Always includes a correlationId for server-side log lookup.
 * - Dev mode also includes the original message + sanitized stack as
 *   `details` for local debugging only.
 */
export function apiError(
  error: unknown,
  opts: ApiErrorOptions = {},
): NextResponse {
  // ApiError pass-through (already-vetted messages)
  if (error instanceof ApiError && error.safeForClient) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const status = opts.status ?? (error instanceof ApiError ? error.status : 500);
  const correlationId = crypto.randomUUID();
  const errMsg = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack : undefined;
  const route = opts.route ?? "api";

  // Server log keeps full context — not surfaced to client. Routed through the
  // redacting structured logger (AC-1b) with the same correlationId returned to
  // the client, so support can pair the response with the server log. The
  // logger sanitises logContext, so a caller can't accidentally log PII here.
  requestLogger(correlationId).error(`[${route}] error`, {
    status,
    message: errMsg,
    ...opts.logContext,
    stack: errStack,
  });

  const isClientError = status >= 400 && status < 500;

  const body: { error: string; correlationId: string; details?: string } = {
    error: opts.safeMessage
      ? opts.safeMessage
      : isClientError
        ? "Invalid request"
        : "An internal error occurred",
    correlationId,
  };

  if (!IS_PRODUCTION) {
    const sanitized = sanitizeStack(errStack);
    body.details = sanitized ? `${errMsg}\n${sanitized}` : errMsg;
  }

  return NextResponse.json(body, { status });
}

/**
 * Return a 400 response for input-validation failures with a vetted
 * client-facing message. Shorter than calling apiError for the common
 * Zod / type-guard rejection path.
 */
export function apiValidationError(
  message: string,
  route?: string,
): NextResponse {
  return apiError(new Error(message), {
    route,
    status: 400,
    safeMessage: message,
  });
}
