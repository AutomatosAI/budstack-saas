/**
 * Railway GraphQL API client for custom domain management.
 *
 * Required env vars:
 *   RAILWAY_API_TOKEN        – Bearer token with project-level access
 *   RAILWAY_PROJECT_ID       – Project ID for budstack-saas
 *   RAILWAY_SERVICE_ID       – Service ID for budstack-saas
 *   RAILWAY_ENVIRONMENT_ID   – Target environment (staging / production)
 */

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

function getConfig() {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const serviceId = process.env.RAILWAY_SERVICE_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;

  if (!token) throw new Error('RAILWAY_API_TOKEN is not set');
  if (!projectId) throw new Error('RAILWAY_PROJECT_ID is not set');
  if (!serviceId) throw new Error('RAILWAY_SERVICE_ID is not set');
  if (!environmentId) throw new Error('RAILWAY_ENVIRONMENT_ID is not set');

  return { token, projectId, serviceId, environmentId };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

async function railwayGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const { token } = getConfig();

  const res = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Railway API HTTP ${res.status}: ${text}`);
  }

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message).join('; ');
    throw new Error(`Railway API error: ${messages}`);
  }

  if (!json.data) {
    throw new Error('Railway API returned no data');
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RailwayDnsRecord {
  hostlabel: string;
  requiredValue: string;
  status: string;
  /** "CNAME" | "A" | "AAAA" | "TXT" | "ALIAS" — only present if Railway returned it. */
  recordType?: string;
  /** "ACME_VALIDATION" | "TRAFFIC" — Railway's purpose tag for the record. */
  purpose?: string;
  /** The DNS zone the record belongs to (usually the apex). */
  zone?: string;
}

export interface RailwayDomain {
  id: string;
  domain: string;
  dnsRecords: RailwayDnsRecord[];
}

export interface RailwayDomainListItem {
  id: string;
  domain: string;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add a custom domain to the Railway service.
 * Returns the created domain's ID and DNS record info.
 */
export async function addCustomDomain(
  domain: string,
): Promise<RailwayDomain> {
  const { projectId, serviceId, environmentId } = getConfig();

  const mutation = `
    mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status {
          dnsRecords {
            hostlabel
            requiredValue
            recordType
            purpose
            zone
            status
          }
        }
      }
    }
  `;

  // Railway nests dnsRecords under status — flatten for our interface
  const data = await railwayGraphQL<{ customDomainCreate: { id: string; domain: string; status: { dnsRecords: RailwayDnsRecord[] } } }>(
    mutation,
    {
      input: {
        domain,
        projectId,
        serviceId,
        environmentId,
      },
    },
  );

  const result = data.customDomainCreate;
  return {
    id: result.id,
    domain: result.domain,
    dnsRecords: result.status?.dnsRecords || [],
  };
}

/**
 * Remove a custom domain from Railway by its domain resource ID.
 */
export async function removeCustomDomain(domainId: string): Promise<void> {
  const mutation = `
    mutation CustomDomainDelete($id: String!) {
      customDomainDelete(id: $id)
    }
  `;

  await railwayGraphQL<{ customDomainDelete: boolean }>(mutation, {
    id: domainId,
  });
}

/**
 * List all custom domains attached to the service + environment.
 * Useful for debugging and admin views.
 */
export async function listCustomDomains(): Promise<RailwayDomainListItem[]> {
  const { serviceId, environmentId } = getConfig();

  const query = `
    query CustomDomains($serviceId: String!, $environmentId: String!) {
      customDomains(serviceId: $serviceId, environmentId: $environmentId) {
        id
        domain
      }
    }
  `;

  const data = await railwayGraphQL<{
    customDomains: RailwayDomainListItem[];
  }>(query, { serviceId, environmentId });

  return data.customDomains;
}
