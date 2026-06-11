import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import { DoctorGreenConfig } from "@/lib/drgreen/doctor-green-api";
import { logger } from "@/lib/logger";

/**
 * Retrieves Dr Green credentials for a specific tenant.
 *
 * Credentials (key + secret): tenant DB keys first, else env DRGREEN_API_KEY /
 * DRGREEN_SECRET_KEY. platform_config has no key/secret columns, so those only
 * ever come from the tenant or env.
 *
 * API URL precedence: per-tenant override > Platform Settings
 * (platform_config.drGreenApiUrl) > env DRGREEN_API_URL. Platform Settings
 * override env *by design* — see the super-admin Platform Settings screen
 * ("these settings override environment variables"). The old code had this
 * backwards (env first), so a leftover DRGREEN_API_URL env var silently
 * shadowed the super-admin URL.
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

  // URL: per-tenant override > Platform Settings default > env fallback.
  const platformConfig = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });
  const resolvedApiUrl =
    tenant.drGreenApiUrl ||
    platformConfig?.drGreenApiUrl ||
    process.env.DRGREEN_API_URL ||
    undefined;

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

    logger.info(`[DrGreen Config] Using tenant DB credentials for ${tenantId}`);
    return {
      apiKey: finalApiKey,
      secretKey: finalSecretKey,
      apiUrl: resolvedApiUrl,
    };
  }

  // 2. Fall back to env var credentials (platform-wide shared keys)
  const envApiKey = process.env.DRGREEN_API_KEY;
  const envSecretKey = process.env.DRGREEN_SECRET_KEY;

  if (envApiKey && envSecretKey) {
    logger.info(`[DrGreen Config] Using env var credentials (fallback for tenant ${tenantId})`);
    return { apiKey: envApiKey, secretKey: envSecretKey, apiUrl: resolvedApiUrl };
  }

  // 3. No credentials anywhere
  throw new Error(
    "MISSING_CREDENTIALS: Dr Green API credentials are not configured for this store.",
  );
}
