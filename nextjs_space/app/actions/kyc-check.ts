"use server";

import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { fetchClient, fetchClientByEmail } from "@/lib/doctor-green-api";
import { logger } from "@/lib/logger";

export type KycStatus = {
    isLoggedIn: boolean;
    kycVerified: boolean; // Computed from status==ACTIVE && verified==true
    status: string; // 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'NO_ID' | 'ERROR' | 'GUEST' | 'NO_TENANT' | 'API_ERROR'
    message?: string;
};

export async function checkUserKycStatus(): Promise<KycStatus> {
    try {
        const clerkUser = await getCurrentUser();
        if (!clerkUser) {
            return { isLoggedIn: false, kycVerified: false, status: "GUEST" };
        }

        // Fetch full user from DB to get drGreenClientId
        let dbUser = await prisma.users.findUnique({
            where: { id: clerkUser.id },
            select: { id: true, drGreenClientId: true, tenantId: true }
        });

        // Fallback: If user not found by ID (e.g. legacy/local user with different UUID), find by email
        if (!dbUser && clerkUser.email) {
            dbUser = await prisma.users.findUnique({
                where: { email: clerkUser.email },
                select: { id: true, drGreenClientId: true, tenantId: true }
            });
        }

        if (!dbUser || !dbUser.drGreenClientId) {
            // Guard: Ensure we have both tenantId and email before querying
            const tenantId = dbUser?.tenantId;
            if (!tenantId || !clerkUser.email) {
                return { isLoggedIn: true, kycVerified: false, status: "NO_ID" };
            }

            // If no Client ID, check if they at least have a pending questionnaire
            // This avoids the confusing "NO_ID" error for users awaiting verification
            const questionnaire = await prisma.consultation_questionnaires.findFirst({
                where: {
                    tenantId: tenantId,
                    email: { equals: clerkUser.email, mode: 'insensitive' }
                },
                select: { id: true }
            });

            if (questionnaire) {
                return { isLoggedIn: true, kycVerified: false, status: "PENDING" };
            }

            return { isLoggedIn: true, kycVerified: false, status: "NO_ID" };
        }

        if (!dbUser.tenantId) {
            // Should not happen for authenticated tenant users context
            // If it does, we can attempts to fallback or fail
            return { isLoggedIn: true, kycVerified: false, status: "NO_TENANT" };
        }

        // Check if user has a verified consultation locally first (DB source of truth override)
        // This allows manual verification or cached verification to work even if API is down
        const questionnaire = await prisma.consultation_questionnaires.findFirst({
            where: {
                tenantId: dbUser.tenantId,
                email: { equals: clerkUser.email, mode: 'insensitive' }
            },
            orderBy: [
                { isKycVerified: 'desc' },
                { createdAt: 'desc' }
            ],
            select: { isKycVerified: true, adminApproval: true }
        });

        // If explicitly verified in local DB, trust it
        if (questionnaire?.isKycVerified) {
            return {
                isLoggedIn: true,
                kycVerified: true,
                status: "ACTIVE"
            };
        }

        // Fetch Config and check Dr Green API
        try {
            const config = await getTenantDrGreenConfig(dbUser.tenantId);

            // Fetch Client from API — fall back to email lookup if ID is stale/unknown
            let client;
            try {
                client = await fetchClient(dbUser.drGreenClientId, config);
            } catch (idErr) {
                logger.warn("[KYC] ID lookup failed, trying email fallback", {
                    userId: dbUser.id,
                    drGreenClientId: dbUser.drGreenClientId,
                    error: idErr instanceof Error ? idErr.message : String(idErr),
                });
                const byEmail = clerkUser.email ? await fetchClientByEmail(clerkUser.email, config) : null;
                if (!byEmail) throw idErr;
                client = byEmail;
                // Backfill stored clientId if it drifted
                if (byEmail.id && byEmail.id !== dbUser.drGreenClientId) {
                    try {
                        await prisma.users.update({
                            where: { id: dbUser.id },
                            data: { drGreenClientId: byEmail.id },
                        });
                        logger.info("[KYC] Backfilled drGreenClientId", {
                            userId: dbUser.id,
                            from: dbUser.drGreenClientId,
                            to: byEmail.id,
                        });
                    } catch (updateErr) {
                        logger.error("[KYC] Failed to backfill drGreenClientId", {
                            userId: dbUser.id,
                            error: updateErr instanceof Error ? updateErr.message : String(updateErr),
                        });
                    }
                }
            }

            // Dr Green API returns: isActive (bool), isKYCVerified (bool), adminApproval (string)
            // Dashboard shows "Verified" as soon as Dr Green has approved the client.
            // isActive alone is not required — Dr Green may approve KYC before flipping active.
            const isVerified =
                client.isKYCVerified === true || client.adminApproval === 'VERIFIED';

            // AC-2: log a non-PII identifier (local user id + Dr Green client id)
            // and the boolean states — never the email.
            logger.info("[KYC] verification check", {
                userId: dbUser.id,
                drGreenClientId: dbUser.drGreenClientId,
                isActive: client.isActive,
                isKYCVerified: client.isKYCVerified,
                adminApproval: client.adminApproval,
                verified: isVerified,
            });

            // Persist verified status locally so we never need to check again.
            //
            // If there's no questionnaire row under the user's current tenant
            // (e.g. the user was moved between flagship stores — their
            // consultation still lives under the original tenant), migrate the
            // row to the current tenant so the cache actually writes. Without
            // this, checkout keeps hitting the Dr Green paginated scan and
            // fails once the client list exceeds a few thousand.
            if (isVerified) {
                const current = await prisma.consultation_questionnaires.updateMany({
                    where: {
                        tenantId: dbUser.tenantId,
                        email: { equals: clerkUser.email, mode: 'insensitive' },
                    },
                    data: {
                        isKycVerified: true,
                        adminApproval: "APPROVED",
                        updatedAt: new Date(),
                    },
                });

                if (current.count === 0) {
                    // No row under the current tenant. Find the user's
                    // questionnaire under any tenant by email and move it.
                    const orphan = await prisma.consultation_questionnaires.findFirst({
                        where: { email: { equals: clerkUser.email, mode: 'insensitive' } },
                        orderBy: [{ isKycVerified: 'desc' }, { createdAt: 'desc' }],
                        select: { id: true, tenantId: true },
                    });

                    if (orphan) {
                        await prisma.consultation_questionnaires.update({
                            where: { id: orphan.id },
                            data: {
                                tenantId: dbUser.tenantId,
                                isKycVerified: true,
                                adminApproval: "APPROVED",
                                updatedAt: new Date(),
                            },
                        });
                        logger.info("[KYC] Migrated questionnaire to current tenant", {
                            userId: dbUser.id,
                            fromTenantId: orphan.tenantId,
                            toTenantId: dbUser.tenantId,
                        });
                    } else {
                        logger.warn("[KYC] verified but no questionnaire row in any tenant — cache will not persist", {
                            userId: dbUser.id,
                            tenantId: dbUser.tenantId,
                        });
                    }
                } else {
                    logger.info("[KYC] verified, cached locally", { userId: dbUser.id });
                }
            }

            // Map Dr Green fields to our status format.
            // ACTIVE if approved (even if Dr Green hasn't flipped isActive yet),
            // otherwise reflect the client's active state.
            const status = isVerified ? 'ACTIVE' : (client.isActive ? 'ACTIVE' : 'INACTIVE');

            return {
                isLoggedIn: true,
                kycVerified: isVerified,
                status,
            };
        } catch (configOrApiError) {
            const errMsg = configOrApiError instanceof Error ? configOrApiError.message : String(configOrApiError);
            logger.error("[KYC] check failed", { error: errMsg });
            return {
                isLoggedIn: true,
                kycVerified: false,
                status: "API_ERROR",
                message: `Dr Green API error: ${errMsg}`,
            };
        }

    } catch (error) {
        logger.error("[KYC] system error", {
            error: error instanceof Error ? error.message : String(error),
        });
        return { isLoggedIn: false, kycVerified: false, status: "ERROR" };
    }
}
