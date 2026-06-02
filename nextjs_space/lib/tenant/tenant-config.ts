import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import { DoctorGreenConfig } from "@/lib/drgreen/doctor-green-api";

/**
 * Retrieves Dr Green credentials for a specific tenant.
 *
 * Priority (multi-tenant):
 *   1. Tenant DB: drGreenApiKey + drGreenSecretKey (each tenant's own keys)
 *   2. Environment variables: DRGREEN_API_KEY + DRGREEN_SECRET_KEY (platform fallback)
 *
 * Each tenant must configure their own Dr Green keys for correct
 * country-specific pricing and order routing.
 */
export async function getTenantDrGreenConfig(
  tenantId: string,
): Promise<DoctorGreenConfig> {
  // 1. Check tenant DB credentials FIRST (each tenant owns their keys)
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

  if (tenant.drGreenApiKey && tenant.drGreenSecretKey) {
    // Tenant has their own keys — use them
    // Encrypted values are either legacy (iv:authTag:ciphertext, 3 parts)
    // or v2 (v2:iv:authTag:ciphertext, 4 parts with v2 prefix). Both
    // must be decrypted; a raw v2 string treated as plaintext breaks signing.
    const isEncryptedValue = (value: string) => {
      const parts = value.split(":");
      return parts.length === 3 || (parts.length === 4 && parts[0] === "v2");
    };
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

    console.log(`[DrGreen Config] Using tenant DB credentials for ${tenantId}`);
    return {
      apiKey: finalApiKey,
      secretKey: finalSecretKey,
      apiUrl: apiUrl || undefined,
    };
  }

  // 2. Fall back to env var credentials (platform-wide shared keys)
  const envApiKey = process.env.DRGREEN_API_KEY;
  const envSecretKey = process.env.DRGREEN_SECRET_KEY;

  if (envApiKey && envSecretKey) {
    const apiUrl = process.env.DRGREEN_API_URL || undefined;
    console.log(`[DrGreen Config] Using env var credentials (fallback for tenant ${tenantId})`);
    return { apiKey: envApiKey, secretKey: envSecretKey, apiUrl };
  }

  // 3. No credentials anywhere
  throw new Error(
    "MISSING_CREDENTIALS: Dr Green API credentials are not configured for this store.",
  );
}
