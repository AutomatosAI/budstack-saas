/**
 * Cloudflare for SaaS (Custom Hostnames) API client.
 *
 * Mirrors the shape of lib/railway-api.ts so provisioning call sites change
 * minimally when USE_CLOUDFLARE_DOMAINS flips on. Railway stays the compute
 * origin; this only manages the per-tenant hostname + its DV certificate.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN        – token scoped to the SaaS zone (Custom Hostnames: Edit, DNS: Edit)
 *   CLOUDFLARE_ZONE_ID          – the dedicated SaaS zone id
 *   CLOUDFLARE_SAAS_ANYCAST_IPS – comma-separated anycast A/AAAA IPs tenants set at their apex
 *   CLOUDFLARE_DCV_ID           – account DCV-delegation id for _acme-challenge CNAMEs
 */

import { subdomainLabel } from '@/lib/domain-utils';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

function getConfig() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const anycastIps = process.env.CLOUDFLARE_SAAS_ANYCAST_IPS;
  const dcvId = process.env.CLOUDFLARE_DCV_ID;

  if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is not set');
  if (!zoneId) throw new Error('CLOUDFLARE_ZONE_ID is not set');
  if (!anycastIps) throw new Error('CLOUDFLARE_SAAS_ANYCAST_IPS is not set');
  if (!dcvId) throw new Error('CLOUDFLARE_DCV_ID is not set');

  return {
    apiToken,
    zoneId,
    anycastIps: anycastIps.split(',').map((s) => s.trim()).filter(Boolean),
    dcvId,
  };
}

// ---------------------------------------------------------------------------
// Wire types (raw Cloudflare v4 envelope + result shapes)
// ---------------------------------------------------------------------------

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
  result?: T | null;
}

interface CfValidationRecord {
  txt_name?: string;
  txt_value?: string;
  cname?: string;
  cname_target?: string;
}

interface CfSsl {
  status?: string;
  validation_records?: CfValidationRecord[];
}

interface CfCustomHostnameResult {
  id: string;
  hostname: string;
  status: string;
  ssl?: CfSsl;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A DNS record the tenant must add at their registrar to validate the cert. */
export interface CloudflareDcvRecord {
  /** "txt" | "cname" — Cloudflare's validation method for this hostname. */
  type: string;
  name: string;
  value: string;
}

export interface CloudflareCustomHostname {
  id: string;
  hostname: string;
  /** Custom-hostname lifecycle status: "pending" | "active" | "blocked" | ... */
  status: string;
  /** Certificate status: "initializing" | "pending_validation" | "active" | ... */
  sslStatus: string;
  validationRecords: CloudflareDcvRecord[];
}

/** A concrete DNS record the tenant adds at their registrar (UI-facing). */
export interface TenantDnsInstruction {
  type: 'A' | 'AAAA' | 'CNAME';
  /** Registrar-relative name: "@" (apex), "shop", "_acme-challenge", ... */
  host: string;
  value: string;
  purpose: string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function cloudflareFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const { apiToken } = getConfig();

  const res = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
      ...(init.headers || {}),
    },
  });

  let json: CloudflareEnvelope<T> | undefined;
  try {
    json = (await res.json()) as CloudflareEnvelope<T>;
  } catch {
    // non-JSON body (gateway error page, etc.)
  }

  // Surface Cloudflare's own message; never echo the token. The CF envelope
  // returns success=false (often with HTTP 200) on logical errors.
  if (!json) {
    throw new Error(`Cloudflare API error: HTTP ${res.status} (non-JSON response)`);
  }
  if (!res.ok || !json.success) {
    const messages =
      (json.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare API error: ${messages}`);
  }
  if (json.result === undefined || json.result === null) {
    throw new Error('Cloudflare API returned no result');
  }

  return json.result;
}

function mapValidationRecords(ssl: CfSsl | undefined): CloudflareDcvRecord[] {
  const records = ssl?.validation_records;
  if (!Array.isArray(records)) return [];
  return records.flatMap<CloudflareDcvRecord>((r) => {
    if (r.txt_name && r.txt_value) {
      return [{ type: 'txt', name: r.txt_name, value: r.txt_value }];
    }
    if (r.cname && r.cname_target) {
      return [{ type: 'cname', name: r.cname, value: r.cname_target }];
    }
    return [];
  });
}

function toCustomHostname(r: CfCustomHostnameResult): CloudflareCustomHostname {
  return {
    id: r.id,
    hostname: r.hostname,
    status: r.status,
    sslStatus: r.ssl?.status || 'unknown',
    validationRecords: mapValidationRecords(r.ssl),
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Register a tenant hostname as a Cloudflare custom hostname with a DV cert
 * validated by delegated DCV (txt). Returns the id + status + the records the
 * tenant must add.
 */
export async function createCustomHostname(
  hostname: string,
): Promise<CloudflareCustomHostname> {
  const { zoneId } = getConfig();

  const result = await cloudflareFetch<CfCustomHostnameResult>(
    `/zones/${zoneId}/custom_hostnames`,
    {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: { min_tls_version: '1.2' },
        },
      }),
    },
  );

  return toCustomHostname(result);
}

/** Fetch the current lifecycle + SSL status of a custom hostname by id. */
export async function getCustomHostnameStatus(
  id: string,
): Promise<CloudflareCustomHostname> {
  const { zoneId } = getConfig();

  const result = await cloudflareFetch<CfCustomHostnameResult>(
    `/zones/${zoneId}/custom_hostnames/${id}`,
    { method: 'GET' },
  );

  return toCustomHostname(result);
}

export type CustomHostnameVerification = 'verified' | 'pending' | 'misconfigured';

/**
 * Collapse a custom hostname's lifecycle + SSL status into our 3-state domain
 * verification result (pure — safe to unit test). "verified" requires the cert
 * to be live; explicit terminal/error states are "misconfigured"; everything
 * else (still validating/issuing) is "pending".
 */
export function summarizeCustomHostnameStatus(
  status: string,
  sslStatus: string,
): CustomHostnameVerification {
  if (sslStatus === 'active') return 'verified';
  if (
    status === 'blocked' ||
    status === 'moved' ||
    status === 'deleted' ||
    sslStatus === 'validation_failed' ||
    sslStatus === 'validation_timed_out' ||
    sslStatus === 'issuance_timed_out' ||
    sslStatus === 'deployment_timed_out'
  ) {
    return 'misconfigured';
  }
  return 'pending';
}

/**
 * Compute the registrar DNS records a tenant must add to route a custom domain
 * through Cloudflare for SaaS and validate its certificate. Pure config read —
 * safe to call from a server component to render setup instructions.
 *
 *   Routing: A/AAAA records to the SaaS anycast IPs. Cloudflare for SaaS accepts
 *            A/AAAA on any hostname — apex or subdomain — so this sidesteps the
 *            apex-CNAME problem that blocks one.com / healingbuds.co.za.
 *   Cert:    one DCV-delegation CNAME, _acme-challenge.<host> →
 *            <host>.<DCV_ID>.dcv.cloudflare.com (static; survives renewals).
 */
export function buildTenantDnsInstructions(
  domain: string,
): TenantDnsInstruction[] {
  const { anycastIps, dcvId } = getConfig();
  const label = subdomainLabel(domain);
  const routingHost = label ?? '@';

  const routing: TenantDnsInstruction[] = anycastIps.map((ip) => ({
    type: ip.includes(':') ? 'AAAA' : 'A',
    host: routingHost,
    value: ip,
    purpose: 'Routes traffic to Cloudflare (proxied to the Railway origin)',
  }));

  const dcv: TenantDnsInstruction = {
    type: 'CNAME',
    host: label ? `_acme-challenge.${label}` : '_acme-challenge',
    value: `${domain}.${dcvId}.dcv.cloudflare.com`,
    purpose: 'Delegates SSL certificate validation to Cloudflare (one-time)',
  };

  return [...routing, dcv];
}

/** Remove a custom hostname by id (used on domain change/removal). */
export async function deleteCustomHostname(id: string): Promise<void> {
  const { zoneId } = getConfig();

  await cloudflareFetch<{ id: string }>(
    `/zones/${zoneId}/custom_hostnames/${id}`,
    { method: 'DELETE' },
  );
}
