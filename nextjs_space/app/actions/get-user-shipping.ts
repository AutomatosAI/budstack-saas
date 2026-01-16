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

    // 2. Try to find the latest consultation questionnaire for this user
    // This usually contains the most verified address
    // We need to match by email since questionnaires might not always have the linked user ID or might be linked differently
    // But ideally we check by User relation if we had it, but schema says 'tenantId' and fields. 
    // Wait, schema for `consultation_questionnaires` does NOT have a relation to `users`? 
    // It has `email`. Let's use email.

    const questionnaire = await prisma.consultation_questionnaires.findFirst({
        where: {
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
