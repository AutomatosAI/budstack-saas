/**
 * Server-side client for the Automatos partner-provisioning plane
 * (automatos-ai `POST /api/verticals/budstacks/provision`, PR #627).
 *
 * Auth is the server-to-server `AUTOMATOS_PARTNER_API_KEY` env — never a
 * value from tenant-writable settings. The orchestrator side fails closed
 * (503 unset / 401 wrong), and so do we: no env → no call.
 */

export interface ProvisionResult {
  api_key: string | null;
  key_minted: boolean;
  agents_installed: number;
  is_new: boolean;
}

const DEFAULT_API_URL = "https://api.automatos.app";
const REQUEST_TIMEOUT_MS = 15_000;

export function automatosApiUrl(): string {
  return (process.env.AUTOMATOS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

export function partnerKey(): string | null {
  const key = (process.env.AUTOMATOS_PARTNER_API_KEY || "").trim();
  return key || null;
}

/**
 * The tenant's storefront hostnames for the public key's origin allowlist:
 * platform subdomain + custom domain + its www twin. Pure — unit-tested.
 */
export function buildTenantDomains(
  subdomain: string,
  customDomain: string | null | undefined,
  baseDomain: string = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io",
): string[] {
  const domains = [`${subdomain}.${baseDomain}`];
  const host = (customDomain || "")
    .split("://", 2)
    .pop()!
    .trim()
    .replace(/\/.*$/, "");
  if (host) {
    const apex = host.startsWith("www.") ? host.slice(4) : host;
    domains.push(apex, `www.${apex}`);
  }
  const seen = new Set<string>();
  return domains.filter((d) => !(seen.has(d) || (seen.add(d), false)));
}

async function callOrchestrator(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<Response> {
  const key = partnerKey();
  if (!key) {
    throw new Error("AUTOMATOS_PARTNER_API_KEY is not configured");
  }
  return fetch(`${automatosApiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function provisionTenant(input: {
  tenantId: string;
  businessName: string;
  domains: string[];
}): Promise<ProvisionResult> {
  const res = await callOrchestrator("/api/verticals/budstacks/provision", "POST", {
    external_id: input.tenantId,
    name: input.businessName,
    metadata: { domains: input.domains },
  });
  if (!res.ok) {
    throw new Error(`Automatos provisioning failed (${res.status})`);
  }
  return (await res.json()) as ProvisionResult;
}

/** Fire-and-forget domains re-sync; callers log failures, never block on them. */
export async function syncTenantDomains(input: {
  tenantId: string;
  domains: string[];
}): Promise<void> {
  const res = await callOrchestrator(
    "/api/verticals/budstacks/provision/domains",
    "PATCH",
    { external_id: input.tenantId, domains: input.domains },
  );
  if (!res.ok) {
    throw new Error(`Automatos domains re-sync failed (${res.status})`);
  }
}
