/**
 * Structured application logger (PRD-215, AC-1 / AC-1a).
 *
 * Wraps pino (fast, async JSON, low overhead) and routes EVERY structured
 * payload through `lib/redact.ts` `sanitizeForLogging` before it reaches the
 * transport — so emails / names / phones / addresses / KYC links / Dr Green
 * payloads / credentials are stripped at the log boundary. pino's own `redact`
 * paths are ALSO configured from the same `SENSITIVE_FIELDS` set
 * (`pinoRedactPaths()`), giving two independent layers that share one source of
 * truth and can never drift apart.
 *
 * Levels are environment-aware: `debug` is silenced in production
 * (`LOG_LEVEL` overrides). Use `logger.child({ correlationId })` (or the
 * `requestLogger()` helper) for per-request correlation so the same id appears
 * in `apiError` client responses and the server log.
 *
 * NOTE: this is the ONE module where writing through pino's console transport
 * is intended — all other prod code should call `logger.*`, never `console.*`.
 */

import pino, { type Logger, type LoggerOptions } from "pino";
import { sanitizeForLogging, pinoRedactPaths } from "@/lib/redact";

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";

/**
 * Resolve the active level:
 *  - explicit `LOG_LEVEL` wins (so ops can dial verbosity without a redeploy)
 *  - production defaults to `info` (debug off — AC-1)
 *  - everything else defaults to `debug`
 *  - tests stay quiet unless asked
 */
function resolveLevel(): string {
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  if (fromEnv) return fromEnv;
  if (IS_TEST) return process.env.LOG_LEVEL_TEST?.toLowerCase() ?? "silent";
  return IS_PRODUCTION ? "info" : "debug";
}

const baseOptions: LoggerOptions = {
  level: resolveLevel(),
  // Second-layer redaction at the pino boundary, driven from the SAME field set
  // as sanitizeForLogging (single source of truth — pinoRedactPaths()).
  redact: {
    paths: pinoRedactPaths(),
    censor: "[REDACTED]",
  },
  // Stable, transport-agnostic level label; pretty-printing is a deploy concern,
  // not a code one, so we emit plain JSON everywhere.
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  base: { service: "budstacks" },
};

const root: Logger = pino(baseOptions);

/**
 * Run a structured payload through `sanitizeForLogging` so nested PII the pino
 * `redact` paths might miss (deeper nesting, renamed keys) is still stripped.
 * Returns a plain object pino can serialise; non-object payloads pass through.
 */
function sanitizeContext(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (context === undefined || context === null) return undefined;
  return sanitizeForLogging(context);
}

/**
 * The app-facing logger surface. Each method takes an OPTIONAL structured
 * context object (redacted) plus a human message. Keeping the message free of
 * interpolated PII is the caller's job; the context object is sanitised for you.
 */
export interface AppLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  /** Derive a child logger that stamps every line with these bound fields. */
  child(bindings: Record<string, unknown>): AppLogger;
  /** Underlying pino level — exposed for level-gating assertions/tests. */
  readonly level: string;
}

function emit(
  pinoLogger: Logger,
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  const safe = sanitizeContext(context);
  if (safe) {
    pinoLogger[level](safe, message);
  } else {
    pinoLogger[level](message);
  }
}

/**
 * Wrap a pino `Logger` in the redacting `AppLogger` surface. Child loggers
 * carry their parent's bound fields (e.g. a correlation id) automatically.
 */
function wrap(pinoLogger: Logger): AppLogger {
  return {
    get level() {
      return pinoLogger.level;
    },
    debug: (message, context) => emit(pinoLogger, "debug", message, context),
    info: (message, context) => emit(pinoLogger, "info", message, context),
    warn: (message, context) => emit(pinoLogger, "warn", message, context),
    error: (message, context) => emit(pinoLogger, "error", message, context),
    child: (bindings) => wrap(pinoLogger.child(sanitizeForLogging(bindings))),
  };
}

/** Application-wide singleton logger. */
export const logger: AppLogger = wrap(root);

/**
 * Per-request child logger carrying a correlation id (AC-1). Pass the same id
 * you return to the client via `apiError` so server + client logs line up.
 */
export function requestLogger(
  correlationId: string,
  extra?: Record<string, unknown>,
): AppLogger {
  return logger.child({ correlationId, ...(extra ?? {}) });
}
