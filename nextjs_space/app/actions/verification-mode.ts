"use server";

import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import {
  getTenantVerificationMode,
  isSaIdUploadEnabled,
  type VerificationMode,
} from "@/lib/verification-mode";

export type StoreVerificationMode = {
  mode: VerificationMode;
  /** Budstacks mirror of Dr Green's SA_ID_ENABLED — gates showing the ID flow. */
  idUploadEnabled: boolean;
};

/**
 * The current customer's tenant verification mode, for client components that
 * need to decide between the KYC/consultation flow and the ID-upload flow.
 * Defaults to KYC on any uncertainty so the ID path is never shown by mistake.
 */
export async function getMyVerificationMode(): Promise<StoreVerificationMode> {
  const idUploadEnabled = isSaIdUploadEnabled();
  try {
    const clerkUser = await getCurrentUser();
    if (!clerkUser?.email) return { mode: "KYC", idUploadEnabled };

    const dbUser = await prisma.users.findUnique({
      where: { email: clerkUser.email },
      select: { tenantId: true },
    });
    if (!dbUser?.tenantId) return { mode: "KYC", idUploadEnabled };

    const tenant = await prisma.tenants.findUnique({
      where: { id: dbUser.tenantId },
      select: { countryCode: true, settings: true },
    });

    return { mode: getTenantVerificationMode(tenant ?? {}), idUploadEnabled };
  } catch {
    return { mode: "KYC", idUploadEnabled };
  }
}
