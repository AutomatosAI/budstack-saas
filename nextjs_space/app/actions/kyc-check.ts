"use server";

import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { fetchClient } from "@/lib/doctor-green-api";

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
            select: { drGreenClientId: true, tenantId: true }
        });

        // Fallback: If user not found by ID (e.g. legacy/local user with different UUID), find by email
        if (!dbUser && clerkUser.email) {
            dbUser = await prisma.users.findUnique({
                where: { email: clerkUser.email },
                select: { drGreenClientId: true, tenantId: true }
            });
        }

        if (!dbUser || !dbUser.drGreenClientId) {
            // If no Client ID, check if they at least have a pending questionnaire
            // This avoids the confusing "NO_ID" error for users awaiting verification
            const questionnaire = await prisma.consultation_questionnaires.findFirst({
                where: {
                    tenantId: dbUser?.tenantId,
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

        // Fetch Config
        try {
            const config = await getTenantDrGreenConfig(dbUser.tenantId);

            // Fetch Client from API
            const client = await fetchClient(dbUser.drGreenClientId, config);

            // STATUS must be ACTIVE and verified must be true to shop
            const isVerified = client.status === 'ACTIVE' && client.verified;

            return {
                isLoggedIn: true,
                kycVerified: isVerified,
                status: client.status
            };
        } catch (configOrApiError) {
            console.error("KYC Check API/Config Error", configOrApiError);
            // If credentials are bad or API is down, fail safe
            return { isLoggedIn: true, kycVerified: false, status: "API_ERROR" };
        }

    } catch (error) {
        console.error("KYC Check System Error", error);
        return { isLoggedIn: false, kycVerified: false, status: "ERROR" };
    }
}
