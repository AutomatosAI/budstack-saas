/**
 * `X-DRG-Client` — the capability header every Dr Green call carries (BS-204).
 *
 * Dr Green applies strict validation (Phase 2 US-202) only to callers that
 * declare themselves; legacy WordPress plugins send nothing and get soft mode,
 * so an old storefront never breaks. The header sits OUTSIDE every signed
 * payload — JSON bodies, query strings and the multipart reconstruction alike
 * — so adding it changes no signature. Dr Green also records it per API key
 * as version telemetry (US-210), which is why the value is sanitised here to
 * the charset it stores (`[A-Za-z0-9./_-]`, at most 64 characters).
 */
import packageJson from "../../package.json";

export const DRG_CLIENT_HEADER = "X-DRG-Client";
export const DRG_CLIENT_NAME = "budstacks";

const DRG_CLIENT_MAX_LENGTH = 64;
const UNSAFE_CHARS = /[^A-Za-z0-9./_-]/g;
const FALLBACK_VERSION = "0.0.0";

/** APP_VERSION when set (a release override), else the package.json version. */
export function resolveAppVersion(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): string {
  const fromEnv = env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  return packageJson.version || FALLBACK_VERSION;
}

export function drgClientHeaderValue(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): string {
  const raw = `${DRG_CLIENT_NAME}/${resolveAppVersion(env)}`;
  return raw.replace(UNSAFE_CHARS, "-").slice(0, DRG_CLIENT_MAX_LENGTH);
}

/** A new headers object with the capability header added; input untouched. */
export function withDrgClientHeader(
  headers: Record<string, string>,
): Record<string, string> {
  return { [DRG_CLIENT_HEADER]: drgClientHeaderValue(), ...headers };
}
