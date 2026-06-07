/**
 * Namecheap API Client
 * Manages DNS records for tenant subdomains
 */

interface NamecheapConfig {
  apiKey: string;
  apiUser: string;
  username: string;
  clientIp: string;
  baseDomain: string;
}

interface DnsRecord {
  type: "CNAME" | "A" | "TXT";
  hostname: string;
  address: string;
  ttl?: number;
}

export class NamecheapAPI {
  private config: NamecheapConfig;
  private baseUrl = "https://api.namecheap.com/xml.response";

  constructor(config: NamecheapConfig) {
    this.config = config;
  }

  /**
   * Create a subdomain CNAME record for a new tenant
   */
  async createTenantSubdomain(subdomain: string): Promise<boolean> {
    try {
      // First, get existing DNS records
      const existingRecords = await this.getHostRecords();

      // Add new CNAME record for the subdomain
      const newRecord: DnsRecord = {
        type: "CNAME",
        hostname: subdomain,
        address: this.config.baseDomain,
        ttl: 1800,
      };

      // Add the new record to existing records
      const updatedRecords = [...existingRecords, newRecord];

      // Update all records
      const result = await this.setHostRecords(updatedRecords);

      return result;
    } catch (error) {
      console.error("Error creating tenant subdomain:", error);
      return false;
    }
  }

  /**
   * Delete a subdomain CNAME record
   */
  async deleteTenantSubdomain(subdomain: string): Promise<boolean> {
    try {
      // Get existing DNS records
      const existingRecords = await this.getHostRecords();

      // Filter out the subdomain record
      const updatedRecords = existingRecords.filter(
        (record) => record.hostname !== subdomain,
      );

      // Update all records
      const result = await this.setHostRecords(updatedRecords);

      return result;
    } catch (error) {
      console.error("Error deleting tenant subdomain:", error);
      return false;
    }
  }

  /**
   * Get all DNS host records for the domain
   */
  private async getHostRecords(): Promise<DnsRecord[]> {
    const params = new URLSearchParams({
      ApiUser: this.config.apiUser,
      ApiKey: this.config.apiKey,
      UserName: this.config.username,
      Command: "namecheap.domains.dns.getHosts",
      ClientIp: this.config.clientIp,
      SLD: this.config.baseDomain.split(".")[0],
      TLD: this.config.baseDomain.split(".")[1],
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    const xmlText = await response.text();

    // Parse XML response (simplified - in production use proper XML parser)
    const records: DnsRecord[] = [];
    const hostRegex =
      /<host[^>]*HostName="([^"]*)"[^>]*Type="([^"]*)"[^>]*Address="([^"]*)"[^>]*TTL="([^"]*)"[^>]*\/>/g;
    let match;

    while ((match = hostRegex.exec(xmlText)) !== null) {
      records.push({
        hostname: match[1],
        type: match[2] as any,
        address: match[3],
        ttl: parseInt(match[4]),
      });
    }

    return records;
  }

  /**
   * Set DNS host records for the domain
   */
  private async setHostRecords(records: DnsRecord[]): Promise<boolean> {
    const params = new URLSearchParams({
      ApiUser: this.config.apiUser,
      ApiKey: this.config.apiKey,
      UserName: this.config.username,
      Command: "namecheap.domains.dns.setHosts",
      ClientIp: this.config.clientIp,
      SLD: this.config.baseDomain.split(".")[0],
      TLD: this.config.baseDomain.split(".")[1],
    });

    // Add each record as a numbered parameter
    records.forEach((record, index) => {
      const i = index + 1;
      params.append(`HostName${i}`, record.hostname);
      params.append(`RecordType${i}`, record.type);
      params.append(`Address${i}`, record.address);
      params.append(`TTL${i}`, (record.ttl || 1800).toString());
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    const xmlText = await response.text();

    // Check if successful
    return xmlText.includes('Status="OK"');
  }

  /**
   * Check if a subdomain already exists
   */
  async subdomainExists(subdomain: string): Promise<boolean> {
    try {
      const records = await this.getHostRecords();
      return records.some((record) => record.hostname === subdomain);
    } catch (error) {
      console.error("Error checking subdomain existence:", error);
      return false;
    }
  }
}

/**
 * Get configured Namecheap API client
 */
export function getNamecheapClient(username: string): NamecheapAPI {
  const config: NamecheapConfig = {
    apiKey: process.env.NAMECHEAP_API_KEY!,
    apiUser: username,
    username: username,
    clientIp: process.env.NAMECHEAP_CLIENT_IP!,
    baseDomain: process.env.NEXT_PUBLIC_BASE_DOMAIN!,
  };

  return new NamecheapAPI(config);
}
