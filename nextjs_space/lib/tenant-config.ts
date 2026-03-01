import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { DoctorGreenConfig } from "@/lib/doctor-green-api";

/**
 * Retrieves and decrypts the Dr Green credentials for a specific tenant.
 * Also fetches the API URL from tenant config (priority) or platform config (fallback).
 * Throws an error if credentials are missing or invalid.
 */
export async function getTenantDrGreenConfig(
  tenantId: string,
): Promise<DoctorGreenConfig> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      drGreenApiKey: true,
      drGreenSecretKey: true,
      drGreenApiUrl: true, // Tenant-level override
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

  // Auto-detect swapped keys: if apiKey looks like a PEM/base64-PEM and secretKey is short,
  // the admin pasted them in the wrong fields. Swap silently.
  let finalApiKey = decryptedApiKey;
  let finalSecretKey = decryptedSecret;

  const looksLikePEM = (v: string) =>
    v.includes("-----BEGIN ") || v.startsWith("LS0tLS"); // LS0tLS = base64("-----")

  if (looksLikePEM(finalApiKey) && !looksLikePEM(finalSecretKey)) {
    console.warn(`[DrGreen Config] Keys appear swapped for tenant ${tenantId} — auto-correcting (apiKey has PEM, secretKey is short token)`);
    [finalApiKey, finalSecretKey] = [finalSecretKey, finalApiKey];
  }

  // Get API URL: tenant override > env var > platform config DB
  const platformConfig = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });
  let apiUrl = tenant.drGreenApiUrl || process.env.DRGREEN_API_URL || platformConfig?.drGreenApiUrl || undefined;

  return {
    apiKey: finalApiKey,
    secretKey: finalSecretKey,
    apiUrl: apiUrl || undefined,
  };
}
