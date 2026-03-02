import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { DoctorGreenConfig } from "@/lib/doctor-green-api";

/**
 * Retrieves Dr Green credentials for a specific tenant.
 *
 * Priority (matches healingbudstacks template pattern):
 *   1. Environment variables: DRGREEN_API_KEY + DRGREEN_SECRET_KEY
 *   2. Tenant DB: drGreenApiKey + drGreenSecretKey (encrypted)
 *
 * The template always uses env vars. Env-var override ensures the same
 * credential scope that the working template has (production keys that
 * can write shipping + create carts + create orders).
 */
export async function getTenantDrGreenConfig(
  tenantId: string,
): Promise<DoctorGreenConfig> {
  // 1. Env-var credentials take priority (matches template approach)
  const envApiKey = process.env.DRGREEN_API_KEY;
  const envSecretKey = process.env.DRGREEN_SECRET_KEY;

  if (envApiKey && envSecretKey) {
    const apiUrl = process.env.DRGREEN_API_URL || undefined;
    console.log(`[DrGreen Config] Using env var credentials (template pattern)`);
    return { apiKey: envApiKey, secretKey: envSecretKey, apiUrl };
  }

  // 2. Fall back to tenant DB credentials
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      drGreenApiKey: true,
      drGreenSecretKey: true,
      drGreenApiUrl: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  if (!tenant.drGreenApiKey || !tenant.drGreenSecretKey) {
    throw new Error(
      "Dr Green API credentials are not configured for this store.",
    );
  }

  const isEncryptedValue = (value: string) => value.split(":").length === 3;
  const decryptedApiKey = isEncryptedValue(tenant.drGreenApiKey)
    ? decrypt(tenant.drGreenApiKey)
    : tenant.drGreenApiKey;
  const decryptedSecret = isEncryptedValue(tenant.drGreenSecretKey)
    ? decrypt(tenant.drGreenSecretKey)
    : tenant.drGreenSecretKey;

  if (!decryptedApiKey || !decryptedSecret) {
    throw new Error("Failed to decrypt Dr Green credentials. Please update your settings.");
  }

  let finalApiKey = decryptedApiKey;
  let finalSecretKey = decryptedSecret;

  const looksLikePEM = (v: string) =>
    v.includes("-----BEGIN ") || v.startsWith("LS0tLS");

  if (looksLikePEM(finalApiKey) && !looksLikePEM(finalSecretKey)) {
    console.warn(`[DrGreen Config] Keys appear swapped for tenant ${tenantId} — auto-correcting`);
    [finalApiKey, finalSecretKey] = [finalSecretKey, finalApiKey];
  }

  const platformConfig = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });
  const apiUrl = process.env.DRGREEN_API_URL || tenant.drGreenApiUrl || platformConfig?.drGreenApiUrl || undefined;

  return {
    apiKey: finalApiKey,
    secretKey: finalSecretKey,
    apiUrl: apiUrl || undefined,
  };
}
