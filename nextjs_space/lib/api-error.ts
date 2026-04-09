import { NextResponse } from "next/server";

/**
 * Safe error responses — prevents leaking internal details in production.
 * In development, returns full error message for debugging.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const SAFE_ERROR_MAP: Record<string, { status: number; message: string }> = {
  "Unauthorized": { status: 401, message: "Unauthorized" },
  "Forbidden": { status: 403, message: "Forbidden" },
  "Not found": { status: 404, message: "Not found" },
  "Validation error": { status: 400, message: "Invalid request data" },
  "Rate limited": { status: 429, message: "Too many requests" },
};

export function apiError(
  error: unknown,
  fallbackMessage = "Internal server error",
  fallbackStatus = 500,
): NextResponse {
  // Known safe errors — always return as-is
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : String(error);

  // Check for mapped safe messages
  for (const [key, mapped] of Object.entries(SAFE_ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status },
      );
    }
  }

  // In production, return generic message — don't leak internals
  if (IS_PRODUCTION) {
    return NextResponse.json(
      { error: fallbackMessage },
      { status: fallbackStatus },
    );
  }

  // In development, return full error for debugging
  return NextResponse.json(
    { error: message },
    { status: fallbackStatus },
  );
}

/**
 * Typed API error — throw from route handlers for safe, specific error responses.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
