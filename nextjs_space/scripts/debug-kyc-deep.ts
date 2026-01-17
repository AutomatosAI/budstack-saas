
import { prisma } from "../lib/db";

async function main() {
    const email = process.env.DEBUG_KYC_EMAIL;
    const clerkId = process.env.DEBUG_KYC_CLERK_ID;

    if (!email || !clerkId) {
        console.error("ERROR: Missing required environment variables:");
        console.error("  - DEBUG_KYC_EMAIL");
        console.error("  - DEBUG_KYC_CLERK_ID");
        process.exitCode = 1;
        return;
    }

    // Log redacted values for security
    console.log(`Checking user: ${email.substring(0, 3)}***${email.substring(email.lastIndexOf('@'))}`);

    // 1. Check User
    const user = await prisma.users.findUnique({
        where: { id: clerkId }
    });
    console.log("User found by ID:", user ? "YES" : "NO");
    if (user) {
        console.log(`User stored email: ${user.email.substring(0, 3)}***`);
    }

    // 2. Check Questionnaires by Email
    const byEmail = await prisma.consultation_questionnaires.findMany({
        where: { email: email }
    });
    console.log(`Found ${byEmail.length} questionnaires by EMAIL.`);

    const all = await prisma.consultation_questionnaires.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${all.length} total questionnaires in DB.`);

    all.forEach((q: any) => {
        console.log(`--- Q ID: ${q.id.substring(0, 8)}*** ---`);
        console.log(`  Email: [REDACTED]`);
        console.log(`  TenantId: ${q.tenantId?.substring(0, 8)}***`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
