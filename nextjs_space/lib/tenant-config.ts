import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { DoctorGreenConfig } from "@/lib/doctor-green-api";

/**
 * Retrieves and decrypts the Dr Green credentials for a specific tenant.
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

  const decryptedSecret = decrypt(tenant.drGreenSecretKey);

  if (!decryptedSecret) {
    throw new Error(
      "Failed to decrypt Dr Green Secret Key. Please update your settings.",
    );
  }

  return {
    apiKey: tenant.drGreenApiKey,
    secretKey: decryptedSecret,
  };
}
