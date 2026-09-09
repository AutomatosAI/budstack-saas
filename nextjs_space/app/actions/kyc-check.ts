"use server";

import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { fetchClient, fetchClientByEmail } from "@/lib/drgreen/doctor-green-api";
import { canonicalAdminApproval } from "@/lib/drgreen/approval-status";
import { logger } from "@/lib/logger";

export type KycStatus = {
    isLoggedIn: boolean;
    kycVerified: boolean; // Computed from status==ACTIVE && verified==true
    status: string; // 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'NO_ID' | 'REJECTED' | 'ERROR' | 'GUEST' | 'NO_TENANT' | 'API_ERROR'
    message?: string;
    // PRD-220 Part B — inline ID-document upload outcome for ID-upload
    // tenants: 'UPLOADED' | 'UPLOAD_FAILED' | null. Only meaningful while
    // unverified; drives the dashboard re-upload CTA.
    idDocumentStatus?: string | null;
    // Dr Green verification path: 'KYC' = legacy First-AML, 'ID' = SA
    // ID-upload. Only set when the live client read succeeded. Drives the
    // dashboard's switch-to-ID offer for stuck legacy AML clients on
    // ID-upload tenants.
    verificationType?: 'KYC' | 'ID' | null;
};

// Narrow Dr Green's string field to the two values the UI branches on;
// anything unexpected reads as null so no CTA renders off a bad value.
function narrowVerificationType(value: unknown): 'KYC' | 'ID' | null {
    return value === 'KYC' || value === 'ID' ? value : null;
}

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
                select: { id: true, idDocumentStatus: true }
            });

            if (questionnaire) {
                return {
                    isLoggedIn: true,
                    kycVerified: false,
                    status: "PENDING",
                    idDocumentStatus: questionnaire.idDocumentStatus ?? null,
                };
            }

            return { isLoggedIn: true, kycVerified: false, status: "NO_ID" };
        }

        if (!dbUser.tenantId) {
            // Should not happen for authenticated tenant users context
            // If it does, we can attempts to fallback or fail
            return { isLoggedIn: true, kycVerified: false, status: "NO_TENANT" };
        }

        // Read the local row for idDocumentStatus ONLY. Dr Green owns whether a
        // client is verified; this table does not get a vote.
        //
        // This used to short-circuit: `if (questionnaire?.isKycVerified) return
        // { kycVerified: true }` — returning ACTIVE without ever calling Dr
        // Green. Because the block below only ever wrote `true` and never
        // `false`, that made the flag a one-way latch: once set, the API was
        // never consulted again and the two systems could drift apart forever.
        //
        // Observed 2026-07-29: a client showed "You're verified — start
        // shopping" from this flag while Dr Green production had no such client
        // at all. The user only found out at checkout, where the order failed
        // with a 500. Verification state must be answered by the system that
        // owns it, at the moment it is asked.
        const questionnaire = await prisma.consultation_questionnaires.findFirst({
            where: {
                tenantId: dbUser.tenantId,
                email: { equals: clerkUser.email, mode: 'insensitive' }
            },
            orderBy: [
                { isKycVerified: 'desc' },
                { createdAt: 'desc' }
            ],
            select: { isKycVerified: true, adminApproval: true, idDocumentStatus: true }
        });
        const idDocumentStatus = questionnaire?.idDocumentStatus ?? null;

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

            // A rejected ID/KYC submission — surface it distinctly so the
            // dashboard can show the reason + a re-upload CTA rather than a
            // misleading "being reviewed" pending banner. The client simply
            // re-uploads a valid ID; they do NOT need to create a new account.
            //
            // Deliberately NOT an early return any more: it used to skip the
            // mirror below, so a client who was verified once and later
            // REJECTED kept `isKycVerified = true` in our table — still reading
            // as verified on every other surface.
            const rejected = !isVerified && client.adminApproval === "REJECTED";

            // MIRROR Dr Green's answer into the local row — it is not consulted
            // above and carries no authority here. It is kept in step because
            // other surfaces still read it: /api/consultation/status and
            // components/shop/RestrictedRegionGate.
            //
            // Written in BOTH directions. Previously this only ever wrote
            // `true`, so a client who was verified once stayed "verified" in
            // BudStacks forever — even after Dr Green stopped recognising them.
            // Mirroring `false` is what lets the drift correct itself.
            //
            // If there's no questionnaire row under the user's current tenant
            // (e.g. the user was moved between flagship stores — their
            // consultation still lives under the original tenant), migrate the
            // row to the current tenant so the mirror actually writes.
            {
                // Mirror Dr Green's adminApproval verbatim (canonicalised to
                // the VERIFIED|PENDING|REJECTED enum — the legacy "APPROVED"
                // literal this block used to write is what let the products
                // gate and the dashboard disagree). Unknown values leave the
                // stored field untouched.
                const mirroredApproval = canonicalAdminApproval(client.adminApproval);
                const current = await prisma.consultation_questionnaires.updateMany({
                    where: {
                        tenantId: dbUser.tenantId,
                        email: { equals: clerkUser.email, mode: 'insensitive' },
                    },
                    data: {
                        isKycVerified: isVerified,
                        ...(mirroredApproval ? { adminApproval: mirroredApproval } : {}),
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
                                // Mirror Dr Green here too. Hardcoding `true`
                                // on this path would re-create the latch for
                                // any user whose row lives under another tenant.
                                isKycVerified: isVerified,
                                ...(mirroredApproval ? { adminApproval: mirroredApproval } : {}),
                                updatedAt: new Date(),
                            },
                        });
                        logger.info("[KYC] Migrated questionnaire to current tenant", {
                            userId: dbUser.id,
                            fromTenantId: orphan.tenantId,
                            toTenantId: dbUser.tenantId,
                            verified: isVerified,
                        });
                    } else {
                        logger.warn("[KYC] no questionnaire row in any tenant — local mirror not written", {
                            userId: dbUser.id,
                            tenantId: dbUser.tenantId,
                            verified: isVerified,
                        });
                    }
                } else {
                    logger.info("[KYC] local mirror updated from Dr Green", {
                        userId: dbUser.id,
                        verified: isVerified,
                    });
                }
            }

            if (rejected) {
                return {
                    isLoggedIn: true,
                    kycVerified: false,
                    status: "REJECTED",
                    message: client.rejectionNote || undefined,
                    idDocumentStatus,
                    verificationType: narrowVerificationType(client.verificationType),
                };
            }

            // Map Dr Green fields to our status format.
            // ACTIVE if approved (even if Dr Green hasn't flipped isActive yet),
            // otherwise reflect the client's active state.
            const status = isVerified ? 'ACTIVE' : (client.isActive ? 'ACTIVE' : 'INACTIVE');

            return {
                isLoggedIn: true,
                kycVerified: isVerified,
                status,
                idDocumentStatus: isVerified ? null : idDocumentStatus,
                verificationType: narrowVerificationType(client.verificationType),
            };
        } catch (configOrApiError) {
            const errMsg = configOrApiError instanceof Error ? configOrApiError.message : String(configOrApiError);
            logger.error("[KYC] check failed", { error: errMsg });
            return {
                isLoggedIn: true,
                kycVerified: false,
                status: "API_ERROR",
                message: `Dr Green API error: ${errMsg}`,
                idDocumentStatus,
            };
        }

    } catch (error) {
        logger.error("[KYC] system error", {
            error: error instanceof Error ? error.message : String(error),
        });
        return { isLoggedIn: false, kycVerified: false, status: "ERROR" };
    }
}
