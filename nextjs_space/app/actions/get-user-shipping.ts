"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export interface ShippingAddress {
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

export async function getUserShippingAddress(): Promise<ShippingAddress | null> {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    // 1. Find the user in our DB to get their ID
    // Try finding by Clerk ID first
    let dbUser = await prisma.users.findUnique({
        where: { id: user.id },
    });

    // If not found by Clerk ID, try email
    if (!dbUser && user.emailAddresses?.[0]?.emailAddress) {
        dbUser = await prisma.users.findUnique({
            where: { email: user.emailAddresses[0].emailAddress },
        });
    }

    if (!dbUser) {
        return null;
    }

    // Guard: Ensure tenantId and email exist before querying
    if (!dbUser.tenantId || !dbUser.email) {
        return null;
    }

    // 2. Try to find the latest consultation questionnaire for this user
    // Filter by BOTH email AND tenantId to prevent cross-tenant data leaks
    const questionnaire = await prisma.consultation_questionnaires.findFirst({
        where: {
            tenantId: dbUser.tenantId,
            email: dbUser.email,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    if (questionnaire) {
        return {
            address1: questionnaire.addressLine1 || "",
            address2: questionnaire.addressLine2 || "",
            city: questionnaire.city || "",
            state: questionnaire.state || "",
            postalCode: questionnaire.postalCode || "",
            country: questionnaire.country || "",
        };
    }

    // 3. Fallback to user.address JSON if available
    if (dbUser.address) {
        const addr = dbUser.address as any;
        return {
            address1: addr.address1 || addr.line1 || "",
            address2: addr.address2 || addr.line2 || "",
            city: addr.city || "",
            state: addr.state || "",
            postalCode: addr.postalCode || addr.zip || "",
            country: addr.country || "",
        };
    }

    return null;
}
